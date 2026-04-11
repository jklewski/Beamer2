/**
 * SteelSectionAnalysis – interactive moment-curvature analysis for steel I-sections.
 * Layout and visual style mirrors ConcreteSectionAnalysis exactly.
 *
 * Strain convention (matches steelSectionSolver):
 *   y     – from BOTTOM (0 = bottom, h = top)
 *   eps_top – top-fibre strain (compression, positive)
 *   eps(y)  = eps_top * (y - y_NA) / (h - y_NA)
 */
import { useMemo, useEffect } from 'react'
import { solveSteelMomentCurvature } from '../../utils/steelSectionSolver.js'
import MomentCurvatureSVG from '../svg/MomentCurvatureSVG.jsx'
import { IPE_SECTIONS, HEA_SECTIONS, HEB_SECTIONS, HEM_SECTIONS } from '../../data/sections.js'

const FAMILY_MAP = {
  IPE: IPE_SECTIONS,
  HEA: HEA_SECTIONS,
  HEB: HEB_SECTIONS,
  HEM: HEM_SECTIONS,
}

// ── I-section outline path (with optional fillet arcs) ───────────────────────

function buildISectionPath(tX, tY, b, h, tf, tw, R_mm, sc) {
  const R  = R_mm ?? 0
  const Rp = R * sc   // radius in px
  const hw = b / 2

  if (Rp < 0.5) {
    // Sharp corners – simple polygon
    return [
      `M ${tX(0)},${tY(h)}`,
      `L ${tX(b)},${tY(h)}`,
      `L ${tX(b)},${tY(h - tf)}`,
      `L ${tX(hw + tw / 2)},${tY(h - tf)}`,
      `L ${tX(hw + tw / 2)},${tY(tf)}`,
      `L ${tX(b)},${tY(tf)}`,
      `L ${tX(b)},${tY(0)}`,
      `L ${tX(0)},${tY(0)}`,
      `L ${tX(0)},${tY(tf)}`,
      `L ${tX(hw - tw / 2)},${tY(tf)}`,
      `L ${tX(hw - tw / 2)},${tY(h - tf)}`,
      `L ${tX(0)},${tY(h - tf)}`,
      'Z',
    ].join(' ')
  }

  // With fillet arcs. tY() flips the vertical axis (y-from-bottom → SVG y-down),
  // so all four inner-corner arcs are counterclockwise in screen space → sweep=0.
  return [
    `M ${tX(0)},${tY(h)}`,
    `L ${tX(b)},${tY(h)}`,
    `L ${tX(b)},${tY(h - tf)}`,
    `L ${tX(hw + tw / 2 + R)},${tY(h - tf)}`,
    `A ${Rp},${Rp} 0 0 0 ${tX(hw + tw / 2)},${tY(h - tf - R)}`,
    `L ${tX(hw + tw / 2)},${tY(tf + R)}`,
    `A ${Rp},${Rp} 0 0 0 ${tX(hw + tw / 2 + R)},${tY(tf)}`,
    `L ${tX(b)},${tY(tf)}`,
    `L ${tX(b)},${tY(0)}`,
    `L ${tX(0)},${tY(0)}`,
    `L ${tX(0)},${tY(tf)}`,
    `L ${tX(hw - tw / 2 - R)},${tY(tf)}`,
    `A ${Rp},${Rp} 0 0 0 ${tX(hw - tw / 2)},${tY(tf + R)}`,
    `L ${tX(hw - tw / 2)},${tY(h - tf - R)}`,
    `A ${Rp},${Rp} 0 0 0 ${tX(hw - tw / 2 - R)},${tY(h - tf)}`,
    `L ${tX(0)},${tY(h - tf)}`,
    'Z',
  ].join(' ')
}

// ── Three-panel section SVG ───────────────────────────────────────────────────

function SteelSectionDiagram({ result, sec, k }) {
  const { h, b, tf, tw, y_NA, eps_s_arr, fy_MPa } = result
  const R   = sec?.R ?? 0
  const E_s = 200e3

  const eps_top = eps_s_arr[k] ?? 0
  const na_mm   = y_NA[k] ?? h / 2
  const hw_na   = h - na_mm

  const epsAtY = y_b => hw_na > 0 ? eps_top * (y_b - na_mm) / hw_na : 0
  const sigAtY = y_b => Math.max(-fy_MPa, Math.min(fy_MPa, E_s * epsAtY(y_b)))

  // ── Layout ──────────────────────────────────────────────────────────────────
  const MAX_W = 90, MAX_H = 190
  const sc    = Math.min(MAX_W / b, MAX_H / h)
  const sec_w = b  * sc
  const sec_h = h  * sc
  const tf_px = tf * sc
  const tw_px = tw * sc

  const topY  = 28
  const p1l   = 28
  const p1r   = p1l + sec_w
  const secCx = p1l + sec_w / 2

  // Extra gap between panels vs. concrete to give breathing room
  const p2z   = p1r + 100    // zero-stress axis (was 80)
  const p3z   = p2z + 150    // zero-strain axis (was 130)

  const SVG_W = Math.ceil(p3z + 90)
  const SVG_H = Math.ceil(topY + sec_h + 34)
  const botY  = topY + sec_h

  const tY = y_b => topY + (1 - y_b / h) * sec_h
  const tX = x_mm => p1l + x_mm * sc

  const naY = tY(na_mm)

  // ── I-section path ──────────────────────────────────────────────────────────
  const sectionPath = buildISectionPath(tX, tY, b, h, tf, tw, R, sc)

  // ── Stress polygons ─────────────────────────────────────────────────────────
  const sigScale = 80 / fy_MPa
  const N_pts = 40

  const compPts = Array.from({ length: N_pts + 1 }, (_, i) => {
    const y_b = h - i * hw_na / N_pts
    const sig = Math.max(0, sigAtY(y_b))
    return `${(p2z + sig * sigScale).toFixed(1)},${tY(y_b).toFixed(1)}`
  })
  const compPoly = [`${p2z},${tY(h)}`, ...compPts, `${p2z},${naY}`].join(' ')

  const tensPts = Array.from({ length: N_pts + 1 }, (_, i) => {
    const y_b = na_mm - i * na_mm / N_pts
    const sig = Math.min(0, sigAtY(y_b))
    return `${(p2z + sig * sigScale).toFixed(1)},${tY(y_b).toFixed(1)}`
  })
  const tensPoly = [`${p2z},${naY}`, ...tensPts, `${p2z},${tY(0)}`].join(' ')

  // ── Strain diagram ──────────────────────────────────────────────────────────
  const eps_bot    = epsAtY(0)
  const strainMax  = Math.max(Math.abs(eps_top), Math.abs(eps_bot), 1e-4) * 1.15
  const strainScPx = 55 / strainMax
  const tX3 = eps => p3z + eps * strainScPx

  const dc    = '#9ca3af'
  const blk   = '#374151'
  const compC = '#1e3a5f'
  const tensC = '#b91c1c'
  const fs    = 9

  // ── Annotation helpers ──────────────────────────────────────────────────────
  // Small dimension bracket: vertical, right of section
  const dimRight = p1r + 6    // x of bracket line
  const dimRightText = p1r + 9

  // tf: right side of bottom flange
  const tfTop = tY(tf)
  const tfBot = tY(0)
  const tfMid = (tfTop + tfBot) / 2

  // tw: horizontal bracket in mid-web
  const webMidY = tY(h / 2)
  const twLeft  = tX(b / 2 - tw / 2)
  const twRight = tX(b / 2 + tw / 2)
  const twLabelY = webMidY + 9

  // R: label near bottom-right inner fillet corner center
  const hasR = R > 0
  const rLabelX = tX(b / 2 + tw / 2 + R) + 3
  const rLabelY = tY(tf + R) + 3

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width={SVG_W} height={SVG_H}
      style={{ fontFamily: 'sans-serif', overflow: 'visible' }}>

      {/* ── Panel labels ── */}
      <text x={p1l + sec_w / 2}    y={14} textAnchor="middle" fontSize={fs} fill={dc}>Section</text>
      <text x={p2z + 40}           y={14} textAnchor="middle" fontSize={fs} fill={dc}>Stress</text>
      <text x={p3z + 10}           y={14} textAnchor="middle" fontSize={fs} fill={dc}>Strain</text>

      {/* ── PANEL 1: I-section shape ── */}
      <path d={sectionPath} fill="#d1dce8" stroke={blk} strokeWidth={1.2} strokeLinejoin="round" />

      {/* Neutral axis */}
      {na_mm > 0 && na_mm < h && (
        <line x1={p1l - 5} y1={naY} x2={p1r + 5} y2={naY}
          stroke={dc} strokeWidth={0.9} strokeDasharray="3,2" />
      )}

      {/* ── h dimension (left side) ── */}
      <line x1={p1l - 12} y1={topY} x2={p1l - 12} y2={botY} stroke={dc} strokeWidth={0.7} />
      <line x1={p1l - 15} y1={topY} x2={p1l - 9}  y2={topY} stroke={dc} strokeWidth={0.7} />
      <line x1={p1l - 15} y1={botY} x2={p1l - 9}  y2={botY} stroke={dc} strokeWidth={0.7} />
      <text x={p1l - 14} y={(topY + botY) / 2 + 3} textAnchor="end" fontSize={8} fill={dc}
        transform={`rotate(-90, ${p1l - 14}, ${(topY + botY) / 2 + 3})`}>h={h}</text>

      {/* ── b dimension (bottom) ── */}
      <line x1={p1l} y1={botY + 8} x2={p1r} y2={botY + 8} stroke={dc} strokeWidth={0.7} />
      <line x1={p1l} y1={botY + 5} x2={p1l} y2={botY + 11} stroke={dc} strokeWidth={0.7} />
      <line x1={p1r} y1={botY + 5} x2={p1r} y2={botY + 11} stroke={dc} strokeWidth={0.7} />
      <text x={p1l + sec_w / 2} y={botY + 20} textAnchor="middle" fontSize={8} fill={dc}>b={b}</text>

      {/* ── tf dimension (right of bottom flange) ── */}
      <line x1={dimRight} y1={tfBot} x2={dimRight} y2={tfTop} stroke={dc} strokeWidth={0.7} />
      <line x1={dimRight - 2} y1={tfBot} x2={dimRight + 2} y2={tfBot} stroke={dc} strokeWidth={0.7} />
      <line x1={dimRight - 2} y1={tfTop} x2={dimRight + 2} y2={tfTop} stroke={dc} strokeWidth={0.7} />
      <text x={dimRightText} y={tfMid + 3} fontSize={7.5} fill={dc}>tf={tf}</text>

      {/* ── tw dimension (horizontal bracket in web) ── */}
      <line x1={twLeft} y1={webMidY} x2={twRight} y2={webMidY} stroke={dc} strokeWidth={0.7} />
      <line x1={twLeft}  y1={webMidY - 2} x2={twLeft}  y2={webMidY + 2} stroke={dc} strokeWidth={0.7} />
      <line x1={twRight} y1={webMidY - 2} x2={twRight} y2={webMidY + 2} stroke={dc} strokeWidth={0.7} />
      <text x={secCx} y={twLabelY} textAnchor="middle" fontSize={7.5} fill={dc}>tw={tw}</text>

      {/* ── R label (near bottom-right inner fillet) ── */}
      {hasR && (
        <text x={rLabelX} y={rLabelY} fontSize={7.5} fill={dc}>R={R}</text>
      )}

      {/* ── PANEL 2: Stress ── */}
      <line x1={p2z} y1={topY - 5} x2={p2z} y2={botY + 5} stroke={dc} strokeWidth={0.9} />
      <line x1={p2z - 3} y1={topY} x2={p2z + 3} y2={topY} stroke={dc} strokeWidth={0.9} />
      <line x1={p2z - 3} y1={botY} x2={p2z + 3} y2={botY} stroke={dc} strokeWidth={0.9} />

      {eps_top > 0 && (
        <>
          <polygon points={compPoly} fill="rgba(30,58,95,0.22)"  stroke={compC} strokeWidth={1.2} />
          <polygon points={tensPoly} fill="rgba(185,28,28,0.15)" stroke={tensC} strokeWidth={1.2} />
          <text x={p2z + 4} y={naY + 10} fontSize={8} fill={compC}>
            x={(h - na_mm).toFixed(0)} mm
          </text>
          <text x={p2z + fy_MPa * sigScale} y={topY - 4}
            textAnchor="middle" fontSize={7.5} fill={compC}>+f_yd</text>
          <text x={p2z - fy_MPa * sigScale} y={botY + 11}
            textAnchor="middle" fontSize={7.5} fill={tensC}>−f_yd</text>
        </>
      )}

      {/* ── PANEL 3: Strain ── */}
      <line x1={p3z} y1={topY - 5} x2={p3z} y2={botY + 5} stroke={dc} strokeWidth={0.9} />
      <line x1={p3z - 3} y1={topY} x2={p3z + 3} y2={topY} stroke={dc} strokeWidth={0.9} />
      <line x1={p3z - 3} y1={botY} x2={p3z + 3} y2={botY} stroke={dc} strokeWidth={0.9} />

      {eps_top > 0 && (
        <>
          <polygon
            points={[
              `${p3z},${topY}`,
              `${tX3(eps_top).toFixed(1)},${topY}`,
              `${tX3(eps_bot).toFixed(1)},${botY}`,
              `${p3z},${botY}`,
            ].join(' ')}
            fill="rgba(30,58,95,0.08)" stroke="none"
          />
          <line x1={tX3(eps_top)} y1={topY} x2={tX3(eps_bot)} y2={botY}
            stroke={compC} strokeWidth={1.5} />
          <circle cx={p3z} cy={naY} r={2.5} fill={dc} />
          <text x={tX3(eps_top)} y={topY - 6}
            textAnchor="middle" fontSize={7.5} fill={compC}>
            {(eps_top * 1000).toFixed(2)}‰
          </text>
          <text x={tX3(eps_bot) - 3} y={botY + 11}
            textAnchor="end" fontSize={7.5} fill={tensC}>
            {(Math.abs(eps_bot) * 1000).toFixed(2)}‰
          </text>
        </>
      )}

    </svg>
  )
}

// ── Section class chip (same chipStyle as concrete) ───────────────────────────

const CLASS_CHIP_COLOR = {
  1: '#059669',   // green
  2: '#65a30d',   // lime
  3: '#b45309',   // amber
  4: '#dc2626',   // red
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SteelSectionAnalysis({ section, strainIndex, onStrainChange }) {
  const family  = section?.family  ?? 'IPE'
  const profile = section?.profile ?? 'IPE200'
  const fy      = section?.fy      ?? 355

  const familyData = FAMILY_MAP[family] ?? IPE_SECTIONS
  const sec = familyData[profile] ?? Object.values(familyData)[0]

  const result = useMemo(() => {
    if (!sec) return null
    return solveSteelMomentCurvature({
      h: sec.h, b: sec.b, tf: sec.tf, tw: sec.tw,
      Wy: sec.Wy, Zy: sec.Zy, fy,
    })
  }, [family, profile, fy]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (result) onStrainChange(result.numSteps - 1)
  }, [result]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!result || !sec) {
    return <div style={{ padding: '2rem', color: '#6b7280' }}>Select a valid profile.</div>
  }

  const k         = Math.min(Math.max(0, strainIndex), result.numSteps - 1)
  const eps_top   = result.eps_s_arr[k] ?? 0
  const isElastic = k < result.elasticIndex

  // Chip style — identical to concrete
  const chipStyle = (color) => ({
    padding: '1px 7px', borderRadius: 3, fontWeight: 600,
    background: color + '22', color, border: `1px solid ${color}66`,
    whiteSpace: 'nowrap', fontFamily: 'monospace',
  })

  const classColor = CLASS_CHIP_COLOR[result.sectionClass] ?? '#dc2626'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>

      {/* ── 3-panel section diagram ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem 1.5rem' }}>
        <SteelSectionDiagram result={result} sec={sec} k={k} />
      </div>

      {/* ── Strain slider ── */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
        padding: '0.75rem 1.5rem', width: '100%', maxWidth: 520, boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6,
          fontSize: '0.82rem', color: '#374151' }}>
          <span>ε<sub>top</sub> = <strong>{(eps_top * 1000).toFixed(2)} ‰</strong></span>
          <span style={{ color: isElastic ? '#059669' : '#b45309', fontWeight: 600 }}>
            {isElastic ? 'Elastic' : 'Yielded'}
          </span>
          <span>M = <strong>{result.Mc[k].toFixed(1)} kNm</strong></span>
        </div>
        <input
          type="range"
          min={0} max={result.numSteps - 1} value={k}
          style={{ width: '100%', cursor: 'pointer' }}
          onChange={e => onStrainChange(parseInt(e.target.value))}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between',
          fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
          <span>0 ‰</span>
          <span>ε<sub>y</sub> = {(result.eps_y * 1000).toFixed(2)} ‰</span>
        </div>
      </div>

      {/* ── Section class + reference moments ── */}
      <div style={{
        background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
        padding: '0.6rem 1.25rem', width: '100%', maxWidth: 520, boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontSize: '0.82rem', flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <span style={chipStyle(classColor)}>
            Class {result.sectionClass}
          </span>
          <span style={{ color: '#6b7280' }}>·</span>
          <span style={chipStyle('#b45309')}>
            M<sub>el</sub> {result.M_el.toFixed(0)} kNm
          </span>
          <span style={{ color: '#6b7280' }}>·</span>
          <span style={chipStyle('#059669')}>
            M<sub>pl</sub> {result.M_pl.toFixed(0)} kNm
          </span>
        </div>
      </div>

      {/* ── M-K diagram ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem 1.5rem' }}>
        <MomentCurvatureSVG
          Mc={result.Mc}
          curvature={result.curvature}
          activeIndex={k}
          limitLines={[
            { M: result.M_el, label: `M_el = ${result.M_el.toFixed(0)} kNm (Class 3)`,   color: '#f59e0b' },
            { M: result.M_pl, label: `M_pl = ${result.M_pl.toFixed(0)} kNm (Class 1-2)`, color: '#10b981' },
          ]}
        />
      </div>

    </div>
  )
}
