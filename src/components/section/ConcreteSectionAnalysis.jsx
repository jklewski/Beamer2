/**
 * ConcreteSectionAnalysis – interactive moment-curvature analysis panel.
 *
 * Shows:
 *  1. Three-panel SVG: cross-section | stress diagram | strain diagram
 *  2. Strain slider (positive AND negative moment)
 *  3. Force equilibrium strip
 *  4. Moment-curvature envelope
 *
 * Negative moment: compression at bottom, tension at top.
 * Handled by re-solving with top/bottom bars swapped (flip = true).
 */
import { useMemo, useEffect } from 'react'
import { solveConcreteMomentCurvature } from '../../utils/concreteSectionSolver.js'
import MomentCurvatureSVG, { MK_W } from '../svg/MomentCurvatureSVG.jsx'

// ── EC2 Sargin stress for SVG rendering ───────────────────────────────────────
function makeSigC(fc) {
  const f_cm  = fc * 1e6
  const eps_c1 = 0.7 * Math.pow(fc, 0.31) * 1e-3
  const k_sar  = 1.05 * 30e9 * eps_c1 / f_cm
  const eps_cu = 3.5e-3
  return (eps) => {
    if (eps <= 0) return 0
    const n = Math.min(eps, eps_cu) / eps_c1
    return fc * (k_sar * n - n * n) / ((k_sar - 2) * n + 1)  // MPa
  }
}

// ── Evenly-spaced bar x-positions (mm from left) ──────────────────────────────
function barXPos(n, dia_mm, b_mm, cover_mm) {
  if (n <= 0) return []
  const xMin = cover_mm + dia_mm / 2
  const xMax = b_mm - cover_mm - dia_mm / 2
  if (n === 1) return [b_mm / 2]
  return Array.from({ length: n }, (_, i) => xMin + i * (xMax - xMin) / (n - 1))
}

// ── Three-panel section SVG ────────────────────────────────────────────────────
/**
 * flip = false → positive moment (compression at top)
 * flip = true  → negative moment (compression at bottom)
 *
 * When flip=true, result was solved with bars swapped, so:
 *   result.d_m   = effective depth of flipped "bottom" bars = original top bars
 *   result.d_p_m = depth of flipped "top" bars = original bottom bars
 *   NA[k]        = neutral axis from flipped top = from BOTTOM of original
 *
 * We undo the flip in SVG coordinates so the section always looks the same
 * (bottom bars at bottom, top bars at top), but the compression zone and
 * stress/strain diagrams appear at the bottom.
 */
function SectionDiagram({ section, result, k, flip }) {
  const { b, h, fc, n_bot, dia_bot, n_top, dia_top, cover } = section

  const xn_m    = result.NA[k]        // NA from "top" of solved section
  const xn_mm   = xn_m * 1000

  // In flip mode: NA measured from bottom in original coords
  const naFromTop_mm = flip ? (h - xn_mm) : xn_mm

  const eps_max = result.eps_c_out[k]   // compressive fibre strain
  const eps_s   = result.eps_s1_out[k]  // tension steel strain
  const cracked = result.crackCheck[k]

  const sigC = makeSigC(fc)

  // ── Layout constants ───────────────────────────────────────────────────────
  const MAX_W = 90, MAX_H = 190
  const sc     = Math.min(MAX_W / b, MAX_H / h)
  const sec_w  = b * sc
  const sec_h  = h * sc

  const topY   = 28
  const p1l    = 28
  const p1r    = p1l + sec_w
  const p2z    = p1r + 80
  const p3z    = p2z + 130
  const SVG_W  = Math.ceil(p3z + 90)
  const SVG_H  = Math.ceil(topY + sec_h + 34)

  // tY maps mm-from-top → SVG y (top = small y)
  const tY  = (y_mm) => topY + y_mm * sc
  const tX1 = (x_mm) => p1l  + x_mm * sc
  const botY = topY + sec_h
  const naY  = tY(naFromTop_mm)

  // Bar positions in original orientation (bottom bars at bottom)
  const xBotAll = barXPos(n_bot, dia_bot, b, cover)
  const xTop    = barXPos(n_top, dia_top, b, cover)
  const yBotMM  = h - cover - dia_bot / 2   // mm from top
  const yTopMM  = cover + dia_top / 2        // mm from top

  // Effective depth of tension steel in original coords (mm from top)
  // result.d_m is from "top" of flipped section = from bottom of original
  const d_tension_mm    = flip ? (h - result.d_m * 1000) : result.d_m * 1000
  const d_compr_mm      = flip ? (h - result.d_p_m * 1000) : result.d_p_m * 1000

  // ── Stress polygon (Sargin compression block) ──────────────────────────────
  const N_pts    = 40
  const sigScPx  = 80 / fc

  let stressPoly
  if (!flip) {
    // Compression at top: walk from topY → naY
    const pts = Array.from({ length: N_pts + 1 }, (_, i) => {
      const y_mm = naFromTop_mm * i / N_pts
      const eps  = eps_max > 0 ? eps_max * (1 - i / N_pts) : 0
      return `${(p2z + sigC(eps) * sigScPx).toFixed(1)},${tY(y_mm).toFixed(1)}`
    })
    stressPoly = [`${p2z},${topY}`, ...pts, `${p2z},${naY}`].join(' ')
  } else {
    // Compression at bottom: walk from botY → naY
    const pts = Array.from({ length: N_pts + 1 }, (_, i) => {
      const y_mm = h - xn_mm * i / N_pts   // from h (bottom) toward NA
      const eps  = eps_max > 0 ? eps_max * (1 - i / N_pts) : 0
      return `${(p2z + sigC(eps) * sigScPx).toFixed(1)},${tY(y_mm).toFixed(1)}`
    })
    stressPoly = [`${p2z},${botY}`, ...pts, `${p2z},${naY}`].join(' ')
  }

  // ── Strain diagram ──────────────────────────────────────────────────────────
  const strainMax  = Math.max(eps_max, eps_s, 1e-4) * 1.15
  const strainScPx = 55 / strainMax
  const tX3 = (eps) => p3z + eps * strainScPx

  // Convention: compression → left of zero axis (negative eps), tension → right (positive eps)
  // flip=false (+M): top=compression(left), bottom=tension(right)
  // flip=true  (-M): top=tension(right),    bottom=compression(left)
  const [strainTopX, strainBotX] = !flip
    ? [tX3(-eps_max), tX3(eps_s)]
    : [tX3(eps_s),    tX3(-eps_max)]

  const dc    = '#9ca3af'
  const blk   = '#374151'
  const compC = '#1e3a5f'
  const tensC = '#b91c1c'
  const fs    = 9

  // Which side are compression and tension bars on?
  const tensionBotBars  = !flip   // true → bottom bars are tension
  const tensionTopBars  = flip    // true → top bars are tension

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width={SVG_W} height={SVG_H}
      style={{ fontFamily: 'sans-serif', overflow: 'visible' }}>

      {/* Panel labels */}
      <text x={p1l + sec_w/2} y={14} textAnchor="middle" fontSize={fs} fill={dc}>Section</text>
      <text x={p2z + 40}      y={14} textAnchor="middle" fontSize={fs} fill={dc}>Stress</text>
      <text x={p3z + 10}      y={14} textAnchor="middle" fontSize={fs} fill={dc}>Strain</text>

      {/* ── PANEL 1: Cross-section ── */}
      <rect x={p1l} y={topY} width={sec_w} height={sec_h}
        fill="#d1dce8" stroke={blk} strokeWidth={1.5} />

      {/* Compression zone tint */}
      {xn_mm > 0 && !flip && (
        <rect x={p1l + 1} y={topY + 1}
          width={sec_w - 2} height={Math.max(0, naY - topY - 1)}
          fill="rgba(30,58,95,0.12)" />
      )}
      {xn_mm > 0 && flip && (
        <rect x={p1l + 1} y={naY}
          width={sec_w - 2} height={Math.max(0, botY - naY - 1)}
          fill="rgba(30,58,95,0.12)" />
      )}

      {/* Neutral axis */}
      {naFromTop_mm > 0 && naFromTop_mm < h && (
        <line x1={p1l - 5} y1={naY} x2={p1r + 5} y2={naY}
          stroke={dc} strokeWidth={0.9} strokeDasharray="3,2" />
      )}

      {/* Bottom bars — tension when !flip, compression when flip */}
      {xBotAll.map((x, i) => (
        <circle key={`bt${i}`} cx={tX1(x)} cy={tY(yBotMM)}
          r={Math.max(2, dia_bot * sc / 2)}
          fill={tensionBotBars ? tensC : compC} />
      ))}

      {/* Top bars — compression when !flip, tension when flip */}
      {xTop.map((x, i) => (
        <circle key={`tp${i}`} cx={tX1(x)} cy={tY(yTopMM)}
          r={Math.max(1.5, dia_top * sc / 2)}
          fill={tensionTopBars ? tensC : compC} />
      ))}

      {/* h dimension */}
      <line x1={p1l - 12} y1={topY}  x2={p1l - 12} y2={botY}  stroke={dc} strokeWidth={0.7} />
      <line x1={p1l - 15} y1={topY}  x2={p1l - 9}  y2={topY}  stroke={dc} strokeWidth={0.7} />
      <line x1={p1l - 15} y1={botY}  x2={p1l - 9}  y2={botY}  stroke={dc} strokeWidth={0.7} />
      <text x={p1l - 14} y={(topY + botY) / 2 + 3} textAnchor="end" fontSize={8} fill={dc}
        transform={`rotate(-90, ${p1l - 14}, ${(topY + botY) / 2 + 3})`}>h={h}</text>

      {/* b dimension */}
      <line x1={p1l}  y1={botY + 8} x2={p1r} y2={botY + 8} stroke={dc} strokeWidth={0.7} />
      <line x1={p1l}  y1={botY + 5} x2={p1l} y2={botY + 11} stroke={dc} strokeWidth={0.7} />
      <line x1={p1r}  y1={botY + 5} x2={p1r} y2={botY + 11} stroke={dc} strokeWidth={0.7} />
      <text x={p1l + sec_w/2} y={botY + 20} textAnchor="middle" fontSize={8} fill={dc}>b={b}</text>

      {/* ── PANEL 2: Stress ── */}
      <line x1={p2z} y1={topY - 5} x2={p2z} y2={botY + 5} stroke={dc} strokeWidth={0.9} />
      <line x1={p2z - 3} y1={topY} x2={p2z + 3} y2={topY} stroke={dc} strokeWidth={0.9} />
      <line x1={p2z - 3} y1={botY} x2={p2z + 3} y2={botY} stroke={dc} strokeWidth={0.9} />

      {eps_max > 0 && xn_mm > 0 && (
        <>
          <polygon points={stressPoly} fill="rgba(30,58,95,0.22)" stroke={compC} strokeWidth={1.2} />
          <text x={p2z + 4} y={naY + (flip ? -5 : 10)} fontSize={8} fill={compC}>
            x={xn_mm.toFixed(0)} mm
          </text>
        </>
      )}

      {/* Tension steel stress marker */}
      {result.sigma_s_out[k] > 0 && (
        <>
          <line x1={p2z} y1={tY(d_tension_mm)}
            x2={p2z - result.sigma_s_out[k] * 0.08} y2={tY(d_tension_mm)}
            stroke={tensC} strokeWidth={2} />
          <circle cx={p2z - result.sigma_s_out[k] * 0.08} cy={tY(d_tension_mm)} r={2.5} fill={tensC} />
          <text x={p2z - result.sigma_s_out[k] * 0.08 - 3} y={tY(d_tension_mm) - 3}
            textAnchor="end" fontSize={7.5} fill={tensC}>
            {result.sigma_s_out[k].toFixed(0)} MPa
          </text>
        </>
      )}

      {/* Compression steel stress marker (only if bars exist on that side) */}
      {(flip ? n_bot : n_top) > 0 && result.sigma_sp_out[k] > 0 && (
        <>
          <line x1={p2z} y1={tY(d_compr_mm)}
            x2={p2z + result.sigma_sp_out[k] * 0.08} y2={tY(d_compr_mm)}
            stroke={compC} strokeWidth={2} />
          <circle cx={p2z + result.sigma_sp_out[k] * 0.08} cy={tY(d_compr_mm)} r={2.5} fill={compC} />
        </>
      )}

      {/* ── PANEL 3: Strain ── */}
      <line x1={p3z} y1={topY - 5} x2={p3z} y2={botY + 5} stroke={dc} strokeWidth={0.9} />
      <line x1={p3z - 3} y1={topY} x2={p3z + 3} y2={topY} stroke={dc} strokeWidth={0.9} />
      <line x1={p3z - 3} y1={botY} x2={p3z + 3} y2={botY} stroke={dc} strokeWidth={0.9} />

      {eps_max > 0 && (
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
              <text x={tX3(-eps_max)} y={topY - 6}
                textAnchor="middle" fontSize={7.5} fill={compC}>
                {(eps_max * 1000).toFixed(2)}‰
              </text>
              <circle cx={tX3(eps_s)} cy={tY(d_tension_mm)} r={2} fill={tensC} />
              <text x={tX3(eps_s) + 3} y={tY(d_tension_mm) + 3}
                fontSize={7.5} fill={tensC}>{(eps_s * 1000).toFixed(2)}‰</text>
            </>
          ) : (
            <>
              <text x={tX3(-eps_max)} y={botY + 13}
                textAnchor="middle" fontSize={7.5} fill={compC}>
                {(eps_max * 1000).toFixed(2)}‰
              </text>
              <circle cx={tX3(eps_s)} cy={tY(d_tension_mm)} r={2} fill={tensC} />
              <text x={tX3(eps_s) + 3} y={tY(d_tension_mm) - 3}
                fontSize={7.5} fill={tensC}>{(eps_s * 1000).toFixed(2)}‰</text>
            </>
          )}
        </>
      )}

    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ConcreteSectionAnalysis({ section, strainIndex, onStrainChange }) {
  const sectionDeps = [
    section.b, section.h, section.fc, section.fy,
    section.n_bot, section.dia_bot, section.n_top, section.dia_top, section.cover,
  ]

  // Positive moment: compression at top, tension bars at bottom
  const resultPos = useMemo(
    () => solveConcreteMomentCurvature(section),
    sectionDeps, // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Negative moment: compression at bottom — swap top/bottom bars
  const resultNeg = useMemo(
    () => solveConcreteMomentCurvature({
      ...section,
      n_bot:   section.n_top,
      dia_bot: section.dia_top,
      n_top:   section.n_bot,
      dia_top: section.dia_bot,
    }),
    sectionDeps, // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Reset slider to zero (no load) when section changes
  useEffect(() => {
    onStrainChange(0)
  }, [resultPos]) // eslint-disable-line react-hooks/exhaustive-deps

  const noTopBars = (section.n_top ?? 0) === 0

  // If no top bars: find the first cracking step on the negative side and lock there
  const negCrackIdx = resultNeg.crackCheck.findIndex(Boolean)  // -1 if never cracks
  const nNegMax = noTopBars && negCrackIdx > 0 ? negCrackIdx : resultNeg.numSteps

  const nPos = resultPos.numSteps
  const nNeg = nNegMax

  // Clamp slider if it is currently beyond the new limit
  const clampedIndex = Math.max(-nNeg, Math.min(nPos, strainIndex))

  const flip = clampedIndex < 0
  const k    = flip
    ? Math.min(Math.max(0, -clampedIndex), nNeg)
    : Math.min(Math.max(0,  clampedIndex), nPos)

  const result  = flip ? resultNeg : resultPos
  const cracked = result.crackCheck[k]
  const M_sign  = flip ? -1 : 1
  // After cracking with no top bars: moment is 0
  const M_raw   = (noTopBars && flip && cracked) ? 0 : result.Mc[k]
  const M_val   = M_raw * M_sign

  const Fct = result.Fct_out[k]
  const Fs  = result.Fs_out[k]
  const Fc  = result.Fc_out[k]
  const Fsp = result.Fsp_out[k]

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    fontSize: '0.82rem', flexWrap: 'wrap',
  }

  const chipStyle = (color) => ({
    padding: '1px 7px', borderRadius: 3, fontWeight: 600,
    background: color + '22', color, border: `1px solid ${color}66`,
    whiteSpace: 'nowrap', fontFamily: 'monospace',
  })

  // Combined M-K data: negative side mirrored (truncated at crack if no top bars)
  const negSlice     = resultNeg.Mc.slice(0, nNegMax + 1)
  const negMc        = negSlice.slice(1).reverse().map(m => -m)
  const negCurvature = resultNeg.curvature.slice(0, nNegMax + 1).slice(1).reverse().map(v => -v)
  const combinedMc        = [...negMc, ...resultPos.Mc]
  const combinedCurvature = [...negCurvature, ...resultPos.curvature]
  const activeIndex        = negMc.length + (flip ? -k : k)

  const hr = <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: 0, width: '100%' }} />

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* ── 3-panel section diagram ── */}
      <div style={{ padding: '1rem 1.5rem' }}>
        <SectionDiagram section={section} result={result} k={k} flip={flip} />
      </div>

      {hr}

      {/* ── Info chips ── */}
      <div style={{ padding: '0.5rem 1.5rem', width: MK_W, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#6b7280' }}>ε<sub>c</sub> = <strong style={{ color: '#374151' }}>{(result.eps_c_out[k] * 1000).toFixed(2)} ‰</strong></span>
          <span style={{ color: '#d1d5db' }}>·</span>
          <span style={{ color: '#6b7280' }}>M = <strong style={{ color: '#374151' }}>{M_val.toFixed(1)} kNm</strong></span>
          <span style={{ flex: 1 }} />
          <span style={chipStyle(cracked ? '#b45309' : '#059669')}>{cracked ? 'Cracked' : 'Uncracked'}</span>
          {!cracked && Fct > 0.1 && <span style={chipStyle('#92400e')}>F<sub>ct</sub> {Fct.toFixed(0)} kN</span>}
          <span style={chipStyle('#b91c1c')}>F<sub>s</sub> {Fs.toFixed(0)} kN</span>
          <span style={{ color: '#9ca3af' }}>≈</span>
          <span style={chipStyle('#1e3a5f')}>F<sub>c</sub> {Fc.toFixed(0)} kN</span>
          {Fsp > 0.1 && <span style={chipStyle('#065f46')}>F<sub>sp</sub> {Fsp.toFixed(0)} kN</span>}
        </div>
      </div>

      {/* ── M-K diagram ── */}
      <div style={{ padding: '0.25rem 0 0.75rem' }}>
        <MomentCurvatureSVG
          Mc={combinedMc}
          curvature={combinedCurvature}
          activeIndex={activeIndex}
          onActiveChange={idx => {
            const raw = idx - negMc.length
            onStrainChange(Math.max(-nNeg, Math.min(nPos, raw)))
          }}
          crackCheck={[
            ...resultNeg.crackCheck.slice(1).reverse(),
            ...resultPos.crackCheck,
          ]}
        />
      </div>

    </div>
  )
}
