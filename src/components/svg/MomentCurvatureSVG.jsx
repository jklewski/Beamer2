/**
 * MomentCurvatureSVG – pure SVG moment-curvature plot.
 *
 * Supports both unidirectional (positive only) and bidirectional (±M, ±κ) data.
 * Bidirectional mode is detected automatically when curvature or Mc contain
 * negative values — the axes then pass through the centre of the plot.
 *
 * Props:
 *   Mc          – moment values (kNm)
 *   curvature   – curvature values (m⁻¹), same length as Mc
 *   activeIndex – index of the currently highlighted point
 *   crackCheck  – boolean[] — used to colour cracked region
 *   limitLines  – [{ M, label, color }] — horizontal reference lines
 */
export default function MomentCurvatureSVG({
  Mc          = [],
  curvature   = [],
  activeIndex = 0,
  crackCheck  = [],
  limitLines  = [],
}) {
  const W = 520, H = 220
  const x0 = 58, x1 = 500, plotW = x1 - x0
  const y0 = 188, y1 = 18, plotH = y0 - y1

  const mc_fin  = Mc.filter(isFinite)
  const k_fin   = curvature.filter(isFinite)

  const maxM_pos =  Math.max(0, ...mc_fin)
  const maxM_neg = -Math.min(0, ...mc_fin)   // positive magnitude
  const maxK_pos =  Math.max(0, ...k_fin)
  const maxK_neg = -Math.min(0, ...k_fin)

  const bidir = maxK_neg > 1e-9 || maxM_neg > 1e-9

  // ── Axis mapping ──────────────────────────────────────────────────────────
  let toX, toY, xAxis, yAxis

  if (bidir) {
    // Symmetric axes through centre
    const maxK  = Math.max(maxK_pos, maxK_neg) * 1.1 || 1
    const maxM  = Math.max(maxM_pos, maxM_neg) * 1.1 || 1
    const xMid  = (x0 + x1) / 2
    const yMid  = (y0 + y1) / 2
    toX  = k => xMid + (k / maxK) * (plotW / 2)
    toY  = M => yMid - (M / maxM) * (plotH / 2)
    xAxis = yMid
    yAxis = xMid
  } else {
    // Bottom-left origin (original behaviour)
    const maxK = maxK_pos * 1.1 || 1
    const maxM = maxM_pos * 1.1 || 1
    toX  = k => x0 + (k / maxK) * plotW
    toY  = M => y0 - (M / maxM) * plotH
    xAxis = y0
    yAxis = x0
  }

  // ── Curve path ────────────────────────────────────────────────────────────
  const pts = Mc.map((M, i) =>
    `${toX(curvature[i]).toFixed(1)},${toY(M).toFixed(1)}`
  )

  // In unidirectional mode, close the filled area to the x-axis
  const curvePath = bidir
    ? `M ${pts[0]} L ${pts.join(' L ')}`
    : `M ${toX(curvature[0] ?? 0)},${xAxis} L ${pts.join(' L ')} L ${toX(curvature[Mc.length - 1] ?? 0)},${xAxis} Z`

  // ── Active point ──────────────────────────────────────────────────────────
  const ax = toX(curvature[activeIndex] ?? 0)
  const ay = toY(Mc[activeIndex] ?? 0)

  // ── Peak annotations ──────────────────────────────────────────────────────
  const peakM_pos = maxM_pos
  const peakM_neg = -maxM_neg
  const peakIdx_pos = mc_fin.length ? Mc.indexOf(peakM_pos) : -1
  const peakIdx_neg = maxM_neg > 1e-9 ? Mc.indexOf(peakM_neg) : -1

  // ── Axis ticks ────────────────────────────────────────────────────────────
  const nTicks = 4
  let yTicks, xTicks

  if (bidir) {
    const maxM = Math.max(maxM_pos, maxM_neg) * 1.1 || 1
    const maxK = Math.max(maxK_pos, maxK_neg) * 1.1 || 1
    // Only label non-zero ticks
    yTicks = Array.from({ length: nTicks * 2 + 1 }, (_, i) => {
      const M = maxM * (i - nTicks) / nTicks
      return { M, y: toY(M), label: M.toFixed(0) }
    }).filter(t => Math.abs(t.M) > 1e-6)
    xTicks = Array.from({ length: nTicks * 2 + 1 }, (_, i) => {
      const k = maxK * (i - nTicks) / nTicks
      return { k, x: toX(k), label: (k * 1000).toFixed(1) }
    }).filter(t => Math.abs(t.k) > 1e-6)
  } else {
    const maxM = maxM_pos * 1.1 || 1
    const maxK = maxK_pos * 1.1 || 1
    yTicks = Array.from({ length: nTicks + 1 }, (_, i) => {
      const M = (maxM_pos / nTicks) * i
      return { M, y: toY(M), label: M.toFixed(0) }
    }).filter(t => t.M > 0)
    xTicks = Array.from({ length: nTicks + 1 }, (_, i) => {
      const k = (maxK / 1.1 / nTicks) * i
      return { k, x: toX(k), label: (k * 1000).toFixed(1) }
    }).filter(t => t.k > 0)
  }

  // ── Cracking line ─────────────────────────────────────────────────────────
  const crackIdx = crackCheck.findIndex(Boolean)
  const crackX   = crackIdx > 0 ? toX(curvature[crackIdx]) : null

  const dc  = '#9ca3af'
  const blk = '#374151'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ fontFamily: 'sans-serif', overflow: 'visible' }}>

      {/* ── Cracking line ── */}
      {crackX !== null && (
        <line x1={crackX} y1={y1} x2={crackX} y2={y0}
          stroke="#fcd34d" strokeWidth={1.2} strokeDasharray="4,3" />
      )}

      {/* ── Curve (filled for unidirectional, line-only for bidirectional) ── */}
      {bidir ? (
        <path d={curvePath} fill="none" stroke="#2563eb" strokeWidth={1.8} />
      ) : (
        <path d={curvePath} fill="#bfdbfe" stroke="#2563eb" strokeWidth={1.8}
          fillRule="evenodd" opacity={0.9} />
      )}

      {/* ── Axes ── */}
      <line x1={x0 - 4} y1={xAxis} x2={x1 + 4} y2={xAxis} stroke={dc} strokeWidth={1} />
      <line x1={yAxis} y1={y1 - 4} x2={yAxis} y2={y0 + 4} stroke={dc} strokeWidth={1} />

      {/* Y-axis label */}
      <text x={x0 - 12} y={(y0 + y1) / 2 + 4} textAnchor="middle" fontSize={10} fill={blk}
        transform={`rotate(-90, ${x0 - 12}, ${(y0 + y1) / 2 + 4})`}>
        M (kNm)
      </text>
      {/* X-axis label */}
      <text x={(x0 + x1) / 2} y={H - 2} textAnchor="middle" fontSize={10} fill={blk}>
        κ (10⁻³ m⁻¹)
      </text>

      {/* Y ticks */}
      {yTicks.map(({ M, y, label }) => (
        <g key={M}>
          <line x1={yAxis - 3} y1={y} x2={yAxis + 3} y2={y} stroke={dc} strokeWidth={0.8} />
          <text x={yAxis - 5} y={y + 3.5} textAnchor="end" fontSize={9} fill={dc}>{label}</text>
        </g>
      ))}

      {/* X ticks */}
      {xTicks.map(({ k, x, label }) => (
        <g key={k}>
          <line x1={x} y1={xAxis - 3} x2={x} y2={xAxis + 3} stroke={dc} strokeWidth={0.8} />
          <text x={x} y={xAxis + 12} textAnchor="middle" fontSize={9} fill={dc}>{label}</text>
        </g>
      ))}

      {/* ── Peak annotations ── */}
      {peakIdx_pos > 0 && (
        <>
          <line x1={toX(curvature[peakIdx_pos])} y1={toY(peakM_pos)}
            x2={toX(curvature[peakIdx_pos])} y2={toY(peakM_pos) - 14}
            stroke="#1d4ed8" strokeWidth={1} strokeDasharray="3,2" />
          <text x={toX(curvature[peakIdx_pos])} y={toY(peakM_pos) - 17}
            textAnchor="middle" fontSize={11} fill="#1d4ed8" fontWeight="600">
            {peakM_pos.toFixed(1)} kNm
          </text>
        </>
      )}
      {peakIdx_neg > 0 && (
        <>
          <line x1={toX(curvature[peakIdx_neg])} y1={toY(peakM_neg)}
            x2={toX(curvature[peakIdx_neg])} y2={toY(peakM_neg) + 14}
            stroke="#1d4ed8" strokeWidth={1} strokeDasharray="3,2" />
          <text x={toX(curvature[peakIdx_neg])} y={toY(peakM_neg) + 25}
            textAnchor="middle" fontSize={11} fill="#1d4ed8" fontWeight="600">
            {peakM_neg.toFixed(1)} kNm
          </text>
        </>
      )}

      {/* ── Active point marker ── */}
      {activeIndex >= 0 && activeIndex < Mc.length && (
        <>
          <line x1={ax} y1={xAxis} x2={ax} y2={ay}
            stroke="#374151" strokeWidth={1} strokeDasharray="3,2" />
          <circle cx={ax} cy={ay} r={5} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
        </>
      )}

      {/* ── Cracking label ── */}
      {crackX !== null && (
        <text x={crackX + 3} y={y1 + 10} fontSize={8.5} fill="#b45309">crack</text>
      )}

      {/* ── Limit lines (e.g. M_el, M_pl for steel) ── */}
      {limitLines.map(({ M, label, color = '#6b7280' }, i) => {
        const ly = toY(M)
        if (ly < y1 || ly > y0) return null
        return (
          <g key={i}>
            <line x1={x0} x2={x1} y1={ly} y2={ly}
              stroke={color} strokeWidth={1} strokeDasharray="5,3" />
            <text x={x1 - 3} y={ly - 4} fontSize={8.5} fill={color} textAnchor="end">
              {label}
            </text>
          </g>
        )
      })}

    </svg>
  )
}
