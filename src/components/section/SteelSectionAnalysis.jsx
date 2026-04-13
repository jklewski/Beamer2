/**
 * SteelSectionAnalysis – interactive moment-curvature analysis for steel I-sections.
 *
 * Supports positive (sagging) and negative (hogging) moment via bidirectional slider.
 * For symmetric I-sections the M-K curve is identical for both signs; the section
 * class is also the same (only the compressed flange/web is classified per EC3, but
 * for symmetric sections both flanges are equal).
 *
 * Strain convention (matches steelSectionSolver):
 *   y       – from BOTTOM (0 = bottom, h = top)
 *   eps_top – top-fibre strain (compression, positive) in positive-moment mode
 */
import { useMemo, useEffect } from 'react'
import { solveSteelMomentCurvature } from '../../utils/steelSectionSolver.js'
import MomentCurvatureSVG, { MK_W } from '../svg/MomentCurvatureSVG.jsx'
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
  const Rp = R * sc
  const hw = b / 2

  if (Rp < 0.5) {
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

/**
 * flip=false → positive moment, compression at top
 * flip=true  → negative moment, compression at bottom
 * For symmetric I-sections the stress/strain magnitudes are identical;
 * only which end is compressed changes.
 */
function SteelSectionDiagram({ result, sec, k, flip }) {
  const { h, b, tf, tw, y_NA, eps_s_arr, fy_MPa } = result
  const R   = sec?.R ?? 0
  const E_s = 200e3

  const eps_top = eps_s_arr[k] ?? 0
  const na_mm   = y_NA[k] ?? h / 2
  const hw_na   = h - na_mm   // distance from NA to top (solver convention)

  // Strain/stress at height y_b from bottom (solver convention)
  const epsAtY = y_b => hw_na > 0 ? eps_top * (y_b - na_mm) / hw_na : 0
  const sigAtY = y_b => Math.max(-fy_MPa, Math.min(fy_MPa, E_s * epsAtY(y_b)))

  // ── Layout ──────────────────────────────────────────────────────────────────
  const MAX_W = 90, MAX_H = 190
  const sc    = Math.min(MAX_W / b, MAX_H / h)
  const sec_w = b  * sc
  const sec_h = h  * sc

  const topY  = 28
  const p1l   = 28
  const p1r   = p1l + sec_w
  const secCx = p1l + sec_w / 2
  const p2z   = p1r + 100
  const p3z   = p2z + 150
  const SVG_W = Math.ceil(p3z + 90)
  const SVG_H = Math.ceil(topY + sec_h + 34)
  const botY  = topY + sec_h

  // tY: y from bottom → SVG y (high y_b = near top of SVG)
  const tY = y_b => topY + (1 - y_b / h) * sec_h
  const tX = x_mm => p1l + x_mm * sc

  // NA in SVG coords — same formula regardless of flip (na_mm is from bottom)
  // In positive mode na_mm ≈ h/2, in flip mode (symmetric section) same
  const naFromTop_mm = flip ? (h - na_mm) : na_mm  // mm from SVG top
  const naY = tY(flip ? na_mm : na_mm)              // SVG y of NA
  // For symmetric section na_mm = h/2 so naY is always the center.
  // We keep the general form in case of future asymmetric sections.

  const sectionPath = buildISectionPath(tX, tY, b, h, tf, tw, R, sc)

  // ── Stress polygons ─────────────────────────────────────────────────────────
  const sigScale = 80 / fy_MPa
  const N_pts    = 40

  let compPoly, tensPoly

  if (!flip) {
    // Compression at top: walk from y_b=h down to y_b=na_mm
    const cPts = Array.from({ length: N_pts + 1 }, (_, i) => {
      const y_b = h - i * hw_na / N_pts
      const sig = Math.max(0, sigAtY(y_b))
      return `${(p2z + sig * sigScale).toFixed(1)},${tY(y_b).toFixed(1)}`
    })
    compPoly = [`${p2z},${tY(h)}`, ...cPts, `${p2z},${naY}`].join(' ')

    // Tension at bottom: walk from y_b=na_mm down to y_b=0
    const tPts = Array.from({ length: N_pts + 1 }, (_, i) => {
      const y_b = na_mm - i * na_mm / N_pts
      const sig = Math.min(0, sigAtY(y_b))
      return `${(p2z + sig * sigScale).toFixed(1)},${tY(y_b).toFixed(1)}`
    })
    tensPoly = [`${p2z},${naY}`, ...tPts, `${p2z},${tY(0)}`].join(' ')
  } else {
    // Compression at bottom: walk from y_b=0 up to y_b=na_mm
    // sigAtY(y_b < na_mm) is negative in solver convention → negate for display
    const cPts = Array.from({ length: N_pts + 1 }, (_, i) => {
      const y_b = na_mm * i / N_pts   // 0 → na_mm
      const sig = Math.max(0, -sigAtY(y_b))
      return `${(p2z + sig * sigScale).toFixed(1)},${tY(y_b).toFixed(1)}`
    })
    compPoly = [`${p2z},${tY(0)}`, ...cPts, `${p2z},${naY}`].join(' ')

    // Tension at top: walk from y_b=na_mm up to y_b=h
    // sigAtY(y_b > na_mm) is positive in solver convention → negate for leftward display
    const tPts = Array.from({ length: N_pts + 1 }, (_, i) => {
      const y_b = na_mm + hw_na * i / N_pts   // na_mm → h
      const sig = Math.min(0, -sigAtY(y_b))
      return `${(p2z + sig * sigScale).toFixed(1)},${tY(y_b).toFixed(1)}`
    })
    tensPoly = [`${p2z},${naY}`, ...tPts, `${p2z},${tY(h)}`].join(' ')
  }

  // ── Strain diagram ──────────────────────────────────────────────────────────
  const eps_at_top = epsAtY(h)   //  positive (compression in +M mode)
  const eps_at_bot = epsAtY(0)   //  negative (tension in +M mode)

  const strainMax  = Math.max(Math.abs(eps_top), Math.abs(eps_at_bot), 1e-4) * 1.15
  const strainScPx = 55 / strainMax
  const tX3 = eps => p3z + eps * strainScPx

  // In +M mode: compressed fibre (top) → right; tensioned fibre (bot) → left
  // In -M mode: compressed fibre (bot) → right; tensioned fibre (top) → left
  // We display compression rightward and tension leftward in both cases.
  const strainTopX = !flip ? tX3(eps_at_top)  : tX3(-eps_at_top)   // top fibre x
  const strainBotX = !flip ? tX3(eps_at_bot)  : tX3(-eps_at_bot)   // bot fibre x

  // ── Annotation helpers ──────────────────────────────────────────────────────
  const dimRight      = p1r + 6
  const dimRightText  = p1r + 9
  const tfTop = tY(tf), tfBot = tY(0), tfMid = (tfTop + tfBot) / 2
  const webMidY = tY(h / 2)
  const twLeft  = tX(b / 2 - tw / 2), twRight = tX(b / 2 + tw / 2)
  const twLabelY = webMidY + 9
  const hasR = R > 0
  const rLabelX = tX(b / 2 + tw / 2 + R) + 3
  const rLabelY = tY(tf + R) + 3

  const dc    = '#9ca3af'
  const blk   = '#374151'
  const compC = '#1e3a5f'
  const tensC = '#b91c1c'
  const fs    = 9

  // ── Which flange is compressed (for tinting in panel 1) ────────────────────
  const compTopFlange = !flip
  const compTintY = compTopFlange ? topY + 1 : tY(tf) + 1
  const compTintH = tf * sc - 2

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width={SVG_W} height={SVG_H}
      style={{ fontFamily: 'sans-serif', overflow: 'visible' }}>

      {/* ── Panel labels ── */}
      <text x={p1l + sec_w / 2}    y={14} textAnchor="middle" fontSize={fs} fill={dc}>Section</text>
      <text x={p2z + 40}           y={14} textAnchor="middle" fontSize={fs} fill={dc}>Stress</text>
      <text x={p3z + 10}           y={14} textAnchor="middle" fontSize={fs} fill={dc}>Strain</text>

      {/* ── PANEL 1: I-section shape ── */}
      <path d={sectionPath} fill="#d1dce8" stroke={blk} strokeWidth={1.2} strokeLinejoin="round" />

      {/* Compressed flange tint */}
      {eps_top > 0 && (
        <rect x={p1l + 1} y={compTintY} width={sec_w - 2} height={compTintH}
          fill="rgba(30,58,95,0.18)" />
      )}

      {/* Neutral axis */}
      {na_mm > 0 && na_mm < h && (
        <line x1={p1l - 5} y1={naY} x2={p1r + 5} y2={naY}
          stroke={dc} strokeWidth={0.9} strokeDasharray="3,2" />
      )}

      {/* h dimension */}
      <line x1={p1l - 12} y1={topY} x2={p1l - 12} y2={botY} stroke={dc} strokeWidth={0.7} />
      <line x1={p1l - 15} y1={topY} x2={p1l - 9}  y2={topY} stroke={dc} strokeWidth={0.7} />
      <line x1={p1l - 15} y1={botY} x2={p1l - 9}  y2={botY} stroke={dc} strokeWidth={0.7} />
      <text x={p1l - 14} y={(topY + botY) / 2 + 3} textAnchor="end" fontSize={8} fill={dc}
        transform={`rotate(-90, ${p1l - 14}, ${(topY + botY) / 2 + 3})`}>h={h}</text>

      {/* b dimension */}
      <line x1={p1l} y1={botY + 8} x2={p1r} y2={botY + 8} stroke={dc} strokeWidth={0.7} />
      <line x1={p1l} y1={botY + 5} x2={p1l} y2={botY + 11} stroke={dc} strokeWidth={0.7} />
      <line x1={p1r} y1={botY + 5} x2={p1r} y2={botY + 11} stroke={dc} strokeWidth={0.7} />
      <text x={p1l + sec_w / 2} y={botY + 20} textAnchor="middle" fontSize={8} fill={dc}>b={b}</text>

      {/* tf dimension */}
      <line x1={dimRight} y1={tfBot} x2={dimRight} y2={tfTop} stroke={dc} strokeWidth={0.7} />
      <line x1={dimRight - 2} y1={tfBot} x2={dimRight + 2} y2={tfBot} stroke={dc} strokeWidth={0.7} />
      <line x1={dimRight - 2} y1={tfTop} x2={dimRight + 2} y2={tfTop} stroke={dc} strokeWidth={0.7} />
      <text x={dimRightText} y={tfMid + 3} fontSize={7.5} fill={dc}>tf={tf}</text>

      {/* tw dimension */}
      <line x1={twLeft} y1={webMidY} x2={twRight} y2={webMidY} stroke={dc} strokeWidth={0.7} />
      <line x1={twLeft}  y1={webMidY - 2} x2={twLeft}  y2={webMidY + 2} stroke={dc} strokeWidth={0.7} />
      <line x1={twRight} y1={webMidY - 2} x2={twRight} y2={webMidY + 2} stroke={dc} strokeWidth={0.7} />
      <text x={secCx} y={twLabelY} textAnchor="middle" fontSize={7.5} fill={dc}>tw={tw}</text>

      {/* R label */}
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
          {/* NA depth label — on whichever side has space */}
          <text x={p2z + 4} y={naY + (flip ? -5 : 10)} fontSize={8} fill={compC}>
            x={(flip ? h - na_mm : na_mm).toFixed(0)} mm
          </text>
          {/* ±f_yd limit labels */}
          <text x={p2z + fy_MPa * sigScale}
            y={!flip ? topY - 4 : botY + 11}
            textAnchor="middle" fontSize={7.5} fill={compC}>+f_yd</text>
          <text x={p2z - fy_MPa * sigScale}
            y={!flip ? botY + 11 : topY - 4}
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
              `${strainTopX.toFixed(1)},${topY}`,
              `${strainBotX.toFixed(1)},${botY}`,
              `${p3z},${botY}`,
            ].join(' ')}
            fill="rgba(30,58,95,0.08)" stroke="none"
          />
          <line x1={strainTopX} y1={topY} x2={strainBotX} y2={botY}
            stroke={compC} strokeWidth={1.5} />
          <circle cx={p3z} cy={naY} r={2.5} fill={dc} />

          {/* Compressed-fibre label */}
          {!flip ? (
            <>
              <text x={tX3(eps_at_top)} y={topY - 6}
                textAnchor="middle" fontSize={7.5} fill={compC}>
                {(eps_top * 1000).toFixed(2)}‰
              </text>
              <text x={tX3(eps_at_bot) - 3} y={botY + 11}
                textAnchor="end" fontSize={7.5} fill={tensC}>
                {(Math.abs(eps_at_bot) * 1000).toFixed(2)}‰
              </text>
            </>
          ) : (
            <>
              <text x={tX3(-eps_at_bot)} y={botY + 11}
                textAnchor="middle" fontSize={7.5} fill={compC}>
                {(Math.abs(eps_at_bot) * 1000).toFixed(2)}‰
              </text>
              <text x={tX3(-eps_at_top) - 3} y={topY - 6}
                textAnchor="end" fontSize={7.5} fill={tensC}>
                {(eps_top * 1000).toFixed(2)}‰
              </text>
            </>
          )}
        </>
      )}

    </svg>
  )
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
      h: sec.h, b: sec.b, tf: sec.tf, tw: sec.tw, R: sec.R ?? 0,
      Wy: sec.Wy, Zy: sec.Zy, fy,
    })
  }, [family, profile, fy]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (result) onStrainChange(0)
  }, [result]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!result || !sec) {
    return <div style={{ padding: '2rem', color: '#6b7280' }}>Select a valid profile.</div>
  }

  const nSteps = result.numSteps - 1

  // For class 3+, cap interaction and display at the elastic limit
  const capSteps = result.sectionClass >= 3 ? result.elasticIndex : nSteps
  const clampedStrainIndex = Math.max(-capSteps, Math.min(capSteps, strainIndex))

  const flip = clampedStrainIndex < 0
  const k    = Math.min(Math.max(0, Math.abs(clampedStrainIndex)), nSteps)

  const eps_top = result.eps_s_arr[k] ?? 0
  const M_val   = result.Mc[k] * (flip ? -1 : 1)

  const chipStyle = (color) => ({
    padding: '1px 7px', borderRadius: 3, fontWeight: 600,
    background: color + '22', color, border: `1px solid ${color}66`,
    whiteSpace: 'nowrap', fontFamily: 'monospace',
  })

  // ── Bidirectional M-K ────────────────────────────────────────────────────────
  const negMc        = result.Mc.slice(1).reverse().map(m => -m)
  const negCurvature = result.curvature.slice(1).reverse().map(v => -v)
  const combinedMc        = [...negMc, ...result.Mc]
  const combinedCurvature = [...negCurvature, ...result.curvature]
  const activeIndex        = negMc.length + (flip ? -k : k)

  // Valid drag range: for class 3+, limit to elastic portion
  const validRange = result.sectionClass >= 3 ? {
    min: negMc.length - result.elasticIndex,
    max: negMc.length + result.elasticIndex,
  } : null

  const hr = <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: 0, width: '100%' }} />

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* ── 3-panel section diagram ── */}
      <div style={{ padding: '1rem 1.5rem' }}>
        <SteelSectionDiagram result={result} sec={sec} k={k} flip={flip} />
      </div>

      {hr}

      {/* ── Info row ── */}
      <div style={{ padding: '0.5rem 1.5rem', width: MK_W, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
          <span style={{ color: '#6b7280' }}>ε = <strong style={{ color: '#374151' }}>{(eps_top * 1000).toFixed(2)} ‰</strong></span>
          <span style={{ color: '#d1d5db' }}>·</span>
          <span style={{ color: '#6b7280' }}>M = <strong style={{ color: '#374151' }}>{M_val.toFixed(1)} kNm</strong></span>
          {result.sectionClass >= 3 && (
            <>
              <span style={{ flex: 1 }} />
              <span style={chipStyle('#b45309')}>Class {result.sectionClass} — elastic only</span>
            </>
          )}
        </div>
      </div>

      {/* ── M-K diagram ── */}
      <div style={{ padding: '0.25rem 0 0.75rem' }}>
        <MomentCurvatureSVG
          Mc={combinedMc}
          curvature={combinedCurvature}
          activeIndex={activeIndex}
          onActiveChange={idx => onStrainChange(idx - negMc.length)}
          validRange={validRange}
        />
      </div>

    </div>
  )
}
