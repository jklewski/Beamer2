/**
 * MomentCurvatureSVG – pure SVG moment-curvature plot.
 *
 * Props:
 *   Mc          – moment values (kNm), index 0 = zero load
 *   curvature   – curvature values (m⁻¹), same length as Mc
 *   activeIndex – index of the currently highlighted point (shows marker)
 *   crackCheck  – boolean[] from solver; used to colour cracked region differently
 */
export default function MomentCurvatureSVG({
  Mc         = [],
  curvature  = [],
  activeIndex = 0,
  crackCheck = [],
}) {
  const W = 520, H = 200
  const x0 = 58, x1 = 500, plotW = x1 - x0
  const y0 = 170, y1 = 18   // SVG y: y0 = bottom axis, y1 = top of plot area

  const plotH = y0 - y1

  const maxM = Math.max(0, ...Mc.filter(isFinite)) * 1.1 || 1
  const maxK = Math.max(0, ...curvature.filter(isFinite)) * 1.1 || 1

  const toX = k  => x0 + (k  / maxK) * plotW
  const toY = M  => y0 - (M  / maxM) * plotH

  // ── Full envelope path ─────────────────────────────────────────────────────
  const pts = Mc.map((M, i) => `${toX(curvature[i]).toFixed(1)},${toY(M).toFixed(1)}`)
  const envelopePath = `M ${x0},${y0} L ${pts.join(' L ')} L ${x1},${y0} Z`

  // ── Active point marker ────────────────────────────────────────────────────
  const ax = toX(curvature[activeIndex] ?? 0)
  const ay = toY(Mc[activeIndex] ?? 0)

  // ── Peak annotation ────────────────────────────────────────────────────────
  const peakM   = Math.max(...Mc.filter(isFinite))
  const peakIdx = Mc.indexOf(peakM)
  const pkx     = toX(curvature[peakIdx] ?? 0)
  const pky     = toY(peakM)

  // First cracking index (where crackCheck first becomes true)
  const crackIdx = crackCheck.findIndex(Boolean)
  const crackX   = crackIdx > 0 ? toX(curvature[crackIdx]) : null

  // ── Axis ticks ─────────────────────────────────────────────────────────────
  const nTicksY = 4
  const yTicks  = Array.from({ length: nTicksY + 1 }, (_, i) => {
    const M = (peakM / nTicksY) * i
    return { M, y: toY(M), label: M.toFixed(0) }
  })
  const nTicksX = 4
  const xTicks  = Array.from({ length: nTicksX + 1 }, (_, i) => {
    const k = (maxK / 1.1 / nTicksX) * i
    return { k, x: toX(k), label: (k * 1000).toFixed(1) }
  })

  const dc  = '#9ca3af'
  const blk = '#374151'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ fontFamily: 'sans-serif' }}>

      {/* ── Cracking line ── */}
      {crackX !== null && (
        <line x1={crackX} y1={y1} x2={crackX} y2={y0}
          stroke="#fcd34d" strokeWidth={1.2} strokeDasharray="4,3" />
      )}

      {/* ── M-K filled area ── */}
      <path d={envelopePath} fill="#bfdbfe" stroke="#2563eb" strokeWidth={1.8}
        fillRule="evenodd" opacity={0.9} />

      {/* ── Axes ── */}
      <line x1={x0} y1={y1 - 4} x2={x0} y2={y0 + 4} stroke={dc} strokeWidth={1} />
      <line x1={x0 - 4} y1={y0} x2={x1 + 4} y2={y0} stroke={dc} strokeWidth={1} />

      {/* Y-axis label */}
      <text x={x0 - 10} y={(y0 + y1) / 2 + 4} textAnchor="middle" fontSize={10} fill={blk}
        transform={`rotate(-90, ${x0 - 10}, ${(y0 + y1) / 2 + 4})`}>
        M (kNm)
      </text>
      {/* X-axis label */}
      <text x={(x0 + x1) / 2} y={H - 2} textAnchor="middle" fontSize={10} fill={blk}>
        κ (10⁻³ m⁻¹)
      </text>

      {/* Y ticks */}
      {yTicks.map(({ M, y, label }) => M > 0 && (
        <g key={M}>
          <line x1={x0 - 3} y1={y} x2={x0 + 3} y2={y} stroke={dc} strokeWidth={0.8} />
          <text x={x0 - 5} y={y + 3.5} textAnchor="end" fontSize={9} fill={dc}>{label}</text>
        </g>
      ))}

      {/* X ticks */}
      {xTicks.map(({ k, x, label }) => k > 0 && (
        <g key={k}>
          <line x1={x} y1={y0 - 3} x2={x} y2={y0 + 3} stroke={dc} strokeWidth={0.8} />
          <text x={x} y={y0 + 12} textAnchor="middle" fontSize={9} fill={dc}>{label}</text>
        </g>
      ))}

      {/* ── Peak annotation ── */}
      {peakIdx > 0 && (
        <>
          <line x1={pkx} y1={pky} x2={pkx} y2={pky - 14}
            stroke="#1d4ed8" strokeWidth={1} strokeDasharray="3,2" />
          <text x={pkx} y={pky - 17} textAnchor="middle" fontSize={11}
            fill="#1d4ed8" fontWeight="600">
            {peakM.toFixed(1)} kNm
          </text>
        </>
      )}

      {/* ── Active point marker ── */}
      {activeIndex > 0 && (
        <>
          <line x1={ax} y1={y0} x2={ax} y2={ay} stroke="#374151" strokeWidth={1}
            strokeDasharray="3,2" />
          <circle cx={ax} cy={ay} r={5} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
        </>
      )}

      {/* ── Cracking label ── */}
      {crackX !== null && (
        <text x={crackX + 3} y={y1 + 10} fontSize={8.5} fill="#b45309">crack</text>
      )}

    </svg>
  )
}
