/**
 * GlulamSectionAnalysis – interactive bending analysis for rectangular glulam sections.
 *
 * Linear elastic model (Eurocode 5):
 *   σ(y) = M · (y − h/2) / I   (compression positive, y from bottom)
 *   fmd  = kmod · fmk / γM
 *   M_Rd = fmd · W              (design bending capacity)
 *
 * kmod from EC5 Table 3.1, depending on climate class and load duration.
 */
import { useMemo, useEffect } from 'react'
import { GLULAM } from '../../data/materials.js'
import MomentCurvatureSVG from '../svg/MomentCurvatureSVG.jsx'

// ── EC5 kmod table (Table 3.1, glulam) ───────────────────────────────────────
const KMOD = {
  CC1: { permanent: 0.60, longTerm: 0.70, mediumTerm: 0.80, shortTerm: 0.90, instantaneous: 1.10 },
  CC2: { permanent: 0.56, longTerm: 0.65, mediumTerm: 0.75, shortTerm: 0.85, instantaneous: 1.00 },
  CC3: { permanent: 0.50, longTerm: 0.55, mediumTerm: 0.65, shortTerm: 0.70, instantaneous: 0.90 },
}

const LOAD_LABELS = {
  permanent:     'Permanent',
  longTerm:      'Long-term',
  mediumTerm:    'Medium-term',
  shortTerm:     'Short-term',
  instantaneous: 'Instantaneous',
}

// ── Solver ───────────────────────────────────────────────────────────────────

function solveGlulam({ grade, b, h, cc = 'CC2', loadDuration = 'mediumTerm', numSteps = 50 }) {
  const mat   = GLULAM[grade] ?? GLULAM['GL28h']
  const kmod  = KMOD[cc]?.[loadDuration] ?? 0.75
  const fmd   = kmod * mat.fmk / mat.gamma_M   // MPa
  const E     = mat.E0mean                      // MPa

  const I     = (b * h ** 3) / 12              // mm⁴
  const W     = (b * h ** 2) / 6               // mm³
  const EI    = E * I                           // N·mm²

  const M_Rd = fmd * W * 1e-6                  // kNm

  // Linear sweep from 0 to M_Rd
  const Mc        = Array.from({ length: numSteps }, (_, i) => M_Rd * i / (numSteps - 1))
  const curvature = Mc.map(M => (M * 1e6 / EI) * 1e3)   // m⁻¹

  return {
    numSteps,
    Mc,
    curvature,
    M_Rd,
    fmd,
    fmk: mat.fmk,
    kmod,
    E,
    I,
    W,
    grade,
    b, h,
    cc,
    loadDuration,
  }
}

// ── Three-panel section SVG ───────────────────────────────────────────────────

function GlulamSectionDiagram({ result, k }) {
  const { b, h, fmd, E, W } = result

  const M_k      = result.Mc[k] ?? 0             // kNm at slider step
  const sigma_k  = (M_k * 1e6) / W               // MPa at extreme fibre
  const eps_k    = sigma_k / E                    // strain at extreme fibre

  // ── Layout (same constants as ConcreteSectionAnalysis) ──────────────────────
  const MAX_W = 90, MAX_H = 190
  const sc    = Math.min(MAX_W / b, MAX_H / h)
  const sec_w = b * sc
  const sec_h = h * sc

  const topY  = 28
  const p1l   = 28
  const p1r   = p1l + sec_w
  const p2z   = p1r + 80    // zero-stress axis
  const p3z   = p2z + 130   // zero-strain axis
  const SVG_W = Math.ceil(p3z + 90)
  const SVG_H = Math.ceil(topY + sec_h + 34)
  const botY  = topY + sec_h

  // y from BOTTOM → SVG y (top = low SVG y)
  const tY  = y_b  => topY + (1 - y_b / h) * sec_h
  const naY = tY(h / 2)   // always mid-height for rectangular section

  // ── Stress scale ────────────────────────────────────────────────────────────
  const sigScale    = 70 / fmd      // px per MPa so fmd = 70 px
  const strainMax   = Math.max(eps_k, 1e-5) * 1.15
  const strainScPx  = 55 / strainMax
  const tX3 = eps => p3z + eps * strainScPx

  const dc    = '#9ca3af'
  const blk   = '#374151'
  const compC = '#1e3a5f'
  const tensC = '#b91c1c'
  const woodC = '#c4a265'   // warm timber fill
  const fs    = 9

  const hasMoment = M_k > 0.01

  // ── Stress polygons (triangular for linear elastic) ──────────────────────────
  // Compression half (top): walks from y=h (top) down to y=h/2 (NA)
  const compPoly = [
    `${p2z},${tY(h)}`,
    `${(p2z + sigma_k * sigScale).toFixed(1)},${tY(h)}`,
    `${p2z},${naY}`,
  ].join(' ')

  // Tension half (bottom): walks from NA down to y=0 (bottom)
  const tensPoly = [
    `${p2z},${naY}`,
    `${(p2z - sigma_k * sigScale).toFixed(1)},${tY(0)}`,
    `${p2z},${tY(0)}`,
  ].join(' ')

  // ── fmd limit lines ──────────────────────────────────────────────────────────
  const fmdLineX = p2z + fmd * sigScale

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width={SVG_W} height={SVG_H}
      style={{ fontFamily: 'sans-serif', overflow: 'visible' }}>

      {/* ── Panel labels ── */}
      <text x={p1l + sec_w / 2} y={14} textAnchor="middle" fontSize={fs} fill={dc}>Section</text>
      <text x={p2z + 35}        y={14} textAnchor="middle" fontSize={fs} fill={dc}>Stress</text>
      <text x={p3z + 10}        y={14} textAnchor="middle" fontSize={fs} fill={dc}>Strain</text>

      {/* ── PANEL 1: Rectangular cross-section ── */}
      <rect x={p1l} y={topY} width={sec_w} height={sec_h}
        fill={woodC} fillOpacity={0.35} stroke={blk} strokeWidth={1.5} />

      {/* Wood grain lines (decorative) */}
      {Array.from({ length: Math.floor(sec_h / 8) }, (_, i) => (
        <line key={i}
          x1={p1l + 1} y1={topY + (i + 1) * 8}
          x2={p1r - 1} y2={topY + (i + 1) * 8}
          stroke={woodC} strokeWidth={0.4} strokeOpacity={0.7} />
      ))}

      {/* Neutral axis (always at center) */}
      <line x1={p1l - 5} y1={naY} x2={p1r + 5} y2={naY}
        stroke={dc} strokeWidth={0.9} strokeDasharray="3,2" />

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

      {/* ── PANEL 2: Stress ── */}
      <line x1={p2z} y1={topY - 5} x2={p2z} y2={botY + 5} stroke={dc} strokeWidth={0.9} />
      <line x1={p2z - 3} y1={topY} x2={p2z + 3} y2={topY} stroke={dc} strokeWidth={0.9} />
      <line x1={p2z - 3} y1={botY} x2={p2z + 3} y2={botY} stroke={dc} strokeWidth={0.9} />

      {/* fmd dashed limit line */}
      {fmdLineX <= p2z + 80 && (
        <>
          <line x1={fmdLineX} y1={topY - 4} x2={fmdLineX} y2={botY + 4}
            stroke={dc} strokeWidth={0.7} strokeDasharray="3,2" />
          <text x={fmdLineX} y={topY - 6} textAnchor="middle" fontSize={7.5} fill={dc}>f_md</text>
          {/* Mirror for tension side */}
          <line x1={p2z * 2 - fmdLineX} y1={topY - 4} x2={p2z * 2 - fmdLineX} y2={botY + 4}
            stroke={dc} strokeWidth={0.7} strokeDasharray="3,2" />
        </>
      )}

      {hasMoment && (
        <>
          <polygon points={compPoly} fill="rgba(30,58,95,0.22)"  stroke={compC} strokeWidth={1.2} />
          <polygon points={tensPoly} fill="rgba(185,28,28,0.15)" stroke={tensC} strokeWidth={1.2} />
          <text x={p2z + sigma_k * sigScale} y={tY(h) - 5}
            textAnchor="middle" fontSize={7.5} fill={compC}>
            {sigma_k.toFixed(1)} MPa
          </text>
          <text x={p2z - sigma_k * sigScale} y={tY(0) + 11}
            textAnchor="middle" fontSize={7.5} fill={tensC}>
            {sigma_k.toFixed(1)} MPa
          </text>
        </>
      )}

      {/* ── PANEL 3: Strain ── */}
      <line x1={p3z} y1={topY - 5} x2={p3z} y2={botY + 5} stroke={dc} strokeWidth={0.9} />
      <line x1={p3z - 3} y1={topY} x2={p3z + 3} y2={topY} stroke={dc} strokeWidth={0.9} />
      <line x1={p3z - 3} y1={botY} x2={p3z + 3} y2={botY} stroke={dc} strokeWidth={0.9} />

      {hasMoment && (
        <>
          {/* Filled area (two triangles: compression right, tension left) */}
          <polygon
            points={[
              `${p3z},${tY(h)}`,
              `${tX3(eps_k).toFixed(1)},${tY(h)}`,
              `${p3z},${naY}`,
            ].join(' ')}
            fill="rgba(30,58,95,0.08)" stroke="none"
          />
          <polygon
            points={[
              `${p3z},${naY}`,
              `${tX3(-eps_k).toFixed(1)},${tY(0)}`,
              `${p3z},${tY(0)}`,
            ].join(' ')}
            fill="rgba(185,28,28,0.06)" stroke="none"
          />
          {/* Strain line (single straight line top to bottom) */}
          <line
            x1={tX3(eps_k)} y1={tY(h)}
            x2={tX3(-eps_k)} y2={tY(0)}
            stroke={compC} strokeWidth={1.5}
          />
          <circle cx={p3z} cy={naY} r={2.5} fill={dc} />
          <text x={tX3(eps_k)} y={tY(h) - 6}
            textAnchor="middle" fontSize={7.5} fill={compC}>
            {(eps_k * 1000).toFixed(2)}‰
          </text>
          <text x={tX3(-eps_k) - 3} y={tY(0) + 11}
            textAnchor="end" fontSize={7.5} fill={tensC}>
            {(eps_k * 1000).toFixed(2)}‰
          </text>
        </>
      )}

    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GlulamSectionAnalysis({ section, strainIndex, onStrainChange }) {
  const grade        = section?.grade        ?? 'GL28h'
  const b            = section?.b            ?? 140
  const h            = section?.h            ?? 360
  const cc           = section?.cc           ?? 'CC2'
  const loadDuration = section?.loadDuration ?? 'mediumTerm'

  const result = useMemo(() => solveGlulam({ grade, b, h, cc, loadDuration }), [grade, b, h, cc, loadDuration])

  useEffect(() => {
    onStrainChange(result.numSteps - 1)
  }, [result]) // eslint-disable-line react-hooks/exhaustive-deps

  const k       = Math.min(Math.max(0, strainIndex), result.numSteps - 1)
  const M_k     = result.Mc[k] ?? 0
  const util    = result.M_Rd > 0 ? M_k / result.M_Rd : 0
  const utilPct = (util * 100).toFixed(0)

  const chipStyle = (color) => ({
    padding: '1px 7px', borderRadius: 3, fontWeight: 600,
    background: color + '22', color, border: `1px solid ${color}66`,
    whiteSpace: 'nowrap', fontFamily: 'monospace',
  })

  const utilColor = util < 0.75 ? '#059669' : util < 0.95 ? '#b45309' : '#dc2626'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>

      {/* ── 3-panel section diagram ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem 1.5rem' }}>
        <GlulamSectionDiagram result={result} k={k} />
      </div>

      {/* ── Moment slider ── */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
        padding: '0.75rem 1.5rem', width: '100%', maxWidth: 520, boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6,
          fontSize: '0.82rem', color: '#374151' }}>
          <span>M = <strong>{M_k.toFixed(1)} kNm</strong></span>
          <span style={{ color: utilColor, fontWeight: 600 }}>
            η = {utilPct}%
          </span>
          <span>M<sub>Rd</sub> = <strong>{result.M_Rd.toFixed(1)} kNm</strong></span>
        </div>
        <input
          type="range"
          min={0} max={result.numSteps - 1} value={k}
          style={{ width: '100%', cursor: 'pointer' }}
          onChange={e => onStrainChange(parseInt(e.target.value))}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between',
          fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
          <span>M = 0</span>
          <span>M = M<sub>Rd</sub></span>
        </div>
      </div>

      {/* ── Design info strip ── */}
      <div style={{
        background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
        padding: '0.6rem 1.25rem', width: '100%', maxWidth: 520, boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontSize: '0.82rem', flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <span style={chipStyle('#b45309')}>
            k<sub>mod</sub> = {result.kmod.toFixed(2)}
          </span>
          <span style={{ color: '#6b7280' }}>·</span>
          <span style={chipStyle('#1e3a5f')}>
            f<sub>md</sub> = {result.fmd.toFixed(1)} MPa
          </span>
          <span style={{ color: '#6b7280' }}>·</span>
          <span style={chipStyle('#059669')}>
            M<sub>Rd</sub> = {result.M_Rd.toFixed(1)} kNm
          </span>
        </div>
      </div>

      {/* ── M-κ diagram ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem 1.5rem' }}>
        <MomentCurvatureSVG
          Mc={result.Mc}
          curvature={result.curvature}
          activeIndex={k}
          limitLines={[
            { M: result.M_Rd, label: `M_Rd = ${result.M_Rd.toFixed(1)} kNm`, color: '#059669' },
          ]}
        />
      </div>

    </div>
  )
}
