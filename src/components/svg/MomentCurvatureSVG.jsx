/**
 * MomentCurvatureSVG – pure SVG moment-curvature plot.
 *
 * Props:
 *   Mc             – moment values (kNm)
 *   curvature      – curvature values (m⁻¹)
 *   activeIndex    – currently highlighted point index
 *   onActiveChange – callback(newIndex) when user drags the dot
 *   crackCheck     – boolean[] — cracked region colouring (concrete)
 *   limitLines     – [{ M, label, color }] — small Y-axis tick annotations
 *   validRange     – { min, max } in activeIndex space — indices outside this
 *                    range are drawn faint/dashed and are not draggable
 */
import { useRef, useState } from 'react'

export const MK_W  = 520
export const MK_X0 = 58
export const MK_X1 = 500

export default function MomentCurvatureSVG({
  Mc             = [],
  curvature      = [],
  activeIndex    = 0,
  onActiveChange = null,
  crackCheck     = [],
  limitLines     = [],
  validRange     = null,   // { min, max } — elastic cap
}) {
  const W = MK_W, H = 220
  const x0 = MK_X0, x1 = MK_X1, plotW = x1 - x0
  const y0 = 188, y1 = 18, plotH = y0 - y1

  const svgRef      = useRef(null)
  const dragging    = useRef(false)
  const [hintVisible, setHintVisible] = useState(true)

  const mc_fin = Mc.filter(isFinite)
  const k_fin  = curvature.filter(isFinite)

  const maxM_pos =  Math.max(0, ...mc_fin)
  const maxM_neg = -Math.min(0, ...mc_fin)
  const maxK_pos =  Math.max(0, ...k_fin)
  const maxK_neg = -Math.min(0, ...k_fin)

  const bidir = maxK_neg > 1e-9 || maxM_neg > 1e-9

  // ── Axis mapping ─────────────────────────────────────────────────────────────
  let toX, toY, xAxis, yAxis

  if (bidir) {
    const maxK = Math.max(maxK_pos, maxK_neg) * 1.1 || 1
    const maxM = Math.max(maxM_pos, maxM_neg) * 1.1 || 1
    const xMid = (x0 + x1) / 2
    const yMid = (y0 + y1) / 2
    toX   = k => xMid + (k / maxK) * (plotW / 2)
    toY   = M => yMid - (M / maxM) * (plotH / 2)
    xAxis = yMid
    yAxis = xMid
  } else {
    const maxK = maxK_pos * 1.1 || 1
    const maxM = maxM_pos * 1.1 || 1
    toX   = k => x0 + (k / maxK) * plotW
    toY   = M => y0 - (M / maxM) * plotH
    xAxis = y0
    yAxis = x0
  }

  // ── Curve geometry ────────────────────────────────────────────────────────────
  const pts = Mc.map((M, i) => ({
    x: toX(curvature[i]),
    y: toY(M),
    s: `${toX(curvature[i]).toFixed(1)},${toY(M).toFixed(1)}`,
  }))

  // ── Curve segments (valid = solid, invalid = faint dashed) ───────────────────
  const vMin = validRange?.min ?? 0
  const vMax = validRange?.max ?? (pts.length - 1)

  function segPath(from, to) {
    if (to <= from || from >= pts.length) return null
    const slice = pts.slice(from, to + 1)
    return `M ${slice.map(p => p.s).join(' L ')}`
  }

  const pathValid = segPath(vMin, vMax)
  const pathLeft  = vMin > 0 ? segPath(0, vMin) : null
  const pathRight = vMax < pts.length - 1 ? segPath(vMax, pts.length - 1) : null

  // Fill area for unidirectional mode (solid portion only)
  const fillPath = !bidir && pathValid
    ? `M ${toX(curvature[vMin] ?? 0).toFixed(1)},${xAxis} L ${pts.slice(vMin, vMax + 1).map(p => p.s).join(' L ')} L ${toX(curvature[vMax] ?? 0).toFixed(1)},${xAxis} Z`
    : null

  // ── Active point ─────────────────────────────────────────────────────────────
  const ax = toX(curvature[activeIndex] ?? 0)
  const ay = toY(Mc[activeIndex] ?? 0)

  // ── Peak annotations ─────────────────────────────────────────────────────────
  const peakM_pos   =  maxM_pos
  const peakM_neg   = -maxM_neg
  const peakIdx_pos = mc_fin.length ? Mc.indexOf(peakM_pos) : -1
  const peakIdx_neg = maxM_neg > 1e-9 ? Mc.indexOf(peakM_neg) : -1

  // ── Axis ticks ───────────────────────────────────────────────────────────────
  const nTicks = 4
  let yTicks, xTicks

  if (bidir) {
    const maxM = Math.max(maxM_pos, maxM_neg) * 1.1 || 1
    const maxK = Math.max(maxK_pos, maxK_neg) * 1.1 || 1
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

  // ── Cracking line ─────────────────────────────────────────────────────────────
  const crackIdx = crackCheck.findIndex(Boolean)
  const crackX   = crackIdx > 0 ? toX(curvature[crackIdx]) : null

  const dc  = '#9ca3af'
  const blk = '#374151'

  // ── Drag handling ─────────────────────────────────────────────────────────────
  function clientXToIndex(clientX) {
    if (!svgRef.current) return activeIndex
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = (clientX - rect.left) * (W / rect.width)
    let best = activeIndex, bestDist = Infinity
    curvature.forEach((k, i) => {
      const d = Math.abs(toX(k) - svgX)
      if (d < bestDist) { bestDist = d; best = i }
    })
    // Clamp to valid range
    if (validRange) best = Math.max(validRange.min, Math.min(validRange.max, best))
    return best
  }

  function onDotPointerDown(e) {
    if (!onActiveChange) return
    e.preventDefault()
    dragging.current = true
    setHintVisible(false)
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onSvgPointerMove(e) {
    if (!dragging.current || !onActiveChange) return
    onActiveChange(clientXToIndex(e.clientX))
  }

  function onSvgPointerUp() {
    dragging.current = false
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width={W} height={H}
      style={{ fontFamily: 'sans-serif', overflow: 'visible', display: 'block' }}
      onPointerMove={onSvgPointerMove}
      onPointerUp={onSvgPointerUp}
    >
      {/* ── Cracking line ── */}
      {crackX !== null && (
        <line x1={crackX} y1={y1} x2={crackX} y2={y0}
          stroke="#fcd34d" strokeWidth={1.2} strokeDasharray="4,3" />
      )}

      {/* ── Curve: faint tails (outside valid range) ── */}
      {pathLeft  && <path d={pathLeft}  fill="none" stroke="#93c5fd" strokeWidth={1.2} strokeDasharray="5,3" opacity={0.5} />}
      {pathRight && <path d={pathRight} fill="none" stroke="#93c5fd" strokeWidth={1.2} strokeDasharray="5,3" opacity={0.5} />}

      {/* ── Curve: valid (solid) portion ── */}
      {bidir ? (
        pathValid && <path d={pathValid} fill="none" stroke="#2563eb" strokeWidth={1.8} />
      ) : (
        fillPath && <path d={fillPath} fill="#bfdbfe" stroke="#2563eb" strokeWidth={1.8} fillRule="evenodd" opacity={0.9} />
      )}

      {/* ── Axes ── */}
      <line x1={x0 - 4} y1={xAxis} x2={x1 + 4} y2={xAxis} stroke={dc} strokeWidth={1} />
      <line x1={yAxis} y1={y1 - 4} x2={yAxis} y2={y0 + 4} stroke={dc} strokeWidth={1} />

      {/* Y-axis label */}
      <text x={x0 - 12} y={(y0 + y1) / 2 + 4} textAnchor="middle" fontSize={10} fill={blk}
        transform={`rotate(-90, ${x0 - 12}, ${(y0 + y1) / 2 + 4})`}>M (kNm)</text>
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

      {/* ── Cracking label ── */}
      {crackX !== null && (
        <text x={crackX + 3} y={y1 + 10} fontSize={8.5} fill="#b45309">crack</text>
      )}

      {/* ── Limit lines — small Y-axis ticks with labels ── */}
      {limitLines.map(({ M, label, color = '#6b7280' }, i) => {
        if (!label) return null
        const ly = toY(M)
        if (ly < y1 - 4 || ly > y0 + 4) return null
        return (
          <g key={i}>
            <line x1={yAxis - 4} x2={yAxis + 22} y1={ly} y2={ly}
              stroke={color} strokeWidth={0.9} strokeDasharray="4,3" opacity={0.55} />
            <text x={yAxis - 6} y={ly - 2} textAnchor="end" fontSize={8} fill={color} opacity={0.8}>
              {label}
            </text>
          </g>
        )
      })}

      {/* ── Arrowhead marker def ── */}
      <defs>
        <marker id="mk-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M 0 0.5 L 5 3 L 0 5.5 Z" fill="#374151" opacity="0.7" />
        </marker>
      </defs>

      {/* ── Active point marker ── */}
      {activeIndex >= 0 && activeIndex < Mc.length && (
        <>
          <line x1={ax} y1={xAxis} x2={ax} y2={ay}
            stroke="#374151" strokeWidth={1} strokeDasharray="3,2" />
          <circle
            cx={ax} cy={ay} r={6}
            fill="#2563eb" stroke="#fff" strokeWidth={2}
            style={{ cursor: onActiveChange ? 'ew-resize' : 'default' }}
            onPointerDown={onDotPointerDown}
          />
        </>
      )}

      {/* ── Drag hint: label + arrow pointing at dot, hides on first click ── */}
      {onActiveChange && hintVisible && activeIndex >= 0 && activeIndex < Mc.length && (
        <g style={{ pointerEvents: 'none', userSelect: 'none' }} opacity={0.72}>
          <text x={ax + 18} y={ay - 20} fontSize={9} fill="#374151" fontWeight="500"
            textAnchor="start">drag</text>
          <line
            x1={ax + 16} y1={ay - 14}
            x2={ax + 7}  y2={ay - 7}
            stroke="#374151" strokeWidth={1}
            markerEnd="url(#mk-arrow)"
          />
        </g>
      )}

    </svg>
  )
}
