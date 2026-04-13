/**
 * steelSectionSolver.js
 *
 * Pure-function port of SectionBender (vanilla JS) for steel I-sections.
 * Elastic-perfectly-plastic material model, Eurocode 3 section classification.
 *
 * Convention (matching SectionBender):
 *   y  — height measured from BOTTOM of section (0 = bottom, h = top)
 *   eps_top — strain at top fibre (positive = compression)
 *   y_NA — neutral-axis position from BOTTOM
 *
 * Strain at any height: eps(y) = eps_top * (y - y_NA) / (h - y_NA)
 *   → at y=h (top): eps = eps_top ✓
 *   → at y=y_NA:    eps = 0 ✓
 *   → at y=0 (bot): eps = -eps_top * y_NA / (h - y_NA) (tension) ✓
 *
 * All inputs in mm / MPa. Outputs in kNm / m⁻¹.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Linear range of n points from a to b (inclusive) */
function linspace(a, b, n) {
  const arr = []
  for (let i = 0; i < n; i++) arr.push(a + (b - a) * (i / (n - 1)))
  return arr
}

/**
 * Find first zero crossing in array y.
 * Returns fractional index via linear interpolation, or null if none found.
 */
function findzero(y) {
  for (let i = 0; i < y.length - 1; i++) {
    if ((y[i] <= 0 && y[i + 1] > 0) || (y[i] >= 0 && y[i + 1] < 0)) {
      const t = -y[i] / (y[i + 1] - y[i])
      return i + t
    }
  }
  return null
}

/**
 * Width of I-section at height y_mm from bottom, including fillet arcs.
 *
 * In the fillet zone just above the bottom flange (y ∈ [tf, tf+R]):
 *   The fillet is a quarter-circle of radius R tangent to the web face (x = tw/2)
 *   and the flange top (y = tf). Centre at (tw/2 + R, tf + R).
 *   Extra half-width per side = sqrt(2R·u − u²), where u = y − tf.
 * Symmetric argument applies just below the top flange.
 */
function getWidth(y_mm, h, b, tf, tw, R = 0) {
  if (y_mm <= tf || y_mm >= h - tf) return b        // flanges
  if (R > 0) {
    if (y_mm < tf + R) {                            // bottom fillet zone
      const u = y_mm - tf
      return tw + 2 * Math.sqrt(Math.max(0, 2 * R * u - u * u))
    }
    if (y_mm > h - tf - R) {                        // top fillet zone
      const u = h - tf - y_mm
      return tw + 2 * Math.sqrt(Math.max(0, 2 * R * u - u * u))
    }
  }
  return tw                                          // web
}

// ── Section classification (EC3, Table 5.2) ──────────────────────────────────

function classifySection(h, b, tf, tw, fy, R = 0) {
  const eps = Math.sqrt(235 / fy)

  // Web (in bending): c/t per EC3 Table 5.2 — clear height between fillets
  const hw = h - 2 * tf - 2 * R
  const cw = hw / tw
  let SC_web
  if      (cw < 72  * eps) SC_web = 1
  else if (cw < 83  * eps) SC_web = 2
  else if (cw < 124 * eps) SC_web = 3
  else                     SC_web = 4

  // Flanges (outstand): c = half-width minus half-web
  const cf = (b / 2 - tw / 2) / tf
  let SC_flange
  if      (cf < 9  * eps) SC_flange = 1
  else if (cf < 10 * eps) SC_flange = 2
  else if (cf < 14 * eps) SC_flange = 3
  else                    SC_flange = 4

  return {
    SC_web,
    SC_flange,
    sectionClass: Math.max(SC_web, SC_flange),
  }
}

// ── Main solver ───────────────────────────────────────────────────────────────

/**
 * solveSteelMomentCurvature
 *
 * @param {object} opts
 * @param {number} opts.h     – section height (mm)
 * @param {number} opts.b     – flange width (mm)
 * @param {number} opts.tf    – flange thickness (mm)
 * @param {number} opts.tw    – web thickness (mm)
 * @param {number} opts.Wy    – elastic section modulus (mm³), from sections.js
 * @param {number} opts.Zy    – plastic section modulus (mm³), from sections.js
 * @param {number} opts.fy    – yield strength (MPa), default 355
 * @param {number} opts.numSteps – number of strain increments (default 99)
 * @returns analysis result object
 */
export function solveSteelMomentCurvature({
  h,
  b,
  tf,
  tw,
  R   = 0,
  Wy  = 0,
  Zy  = 0,
  fy  = 355,
  numSteps = 99,
} = {}) {
  const E_s = 200e3            // MPa
  const eps_y = fy / E_s       // yield strain

  // EPP constitutive model (compression positive, outputs in MPa)
  const f = eps => Math.max(-fy, Math.min(fy, E_s * eps))

  // Strain levels at top fibre: from near-zero to enough to reach full plasticity
  // Full plasticity is reached when eps_top >> eps_y, typically ~5–10×eps_y
  const eps_s_arr = linspace(1e-4, 8 * eps_y, numSteps)

  // Height discretization (integration step = 1 mm)
  const dy   = 1
  const nY   = Math.ceil(h / dy)
  const yArr = Array.from({ length: nY }, (_, i) => (i + 0.5) * dy)  // midpoints from bottom

  // Neutral-axis candidate positions (from BOTTOM)
  const nNA = 200
  const yNA_candidates = linspace(0.01 * h, 0.99 * h, nNA)

  // Result arrays
  const curvature  = new Array(numSteps).fill(0)
  const Mc         = new Array(numSteps).fill(0)
  const y_NA       = new Array(numSteps).fill(h / 2)
  let elasticIndex = numSteps - 1

  for (let i = 0; i < numSteps; i++) {
    const eps_top = eps_s_arr[i]   // top-fibre strain (compression, positive)

    // Find NA: search for the candidate where net horizontal force = 0
    // Strain at height y_b (from bottom): eps = eps_top * (y_b - yna) / (h - yna)
    //   → compression at top, tension at bottom
    const netForce = yNA_candidates.map(yna => {
      let F = 0
      const hw = h - yna   // distance from NA to top
      for (const y of yArr) {
        const eps = hw > 0 ? eps_top * (y - yna) / hw : 0
        F += f(eps) * getWidth(y, h, b, tf, tw, R) * dy
      }
      return F
    })

    // The net force is positive (net tension) when yna is low and
    // negative (net compression) when yna is high → we want crossing from - to +
    // or + to - depending on section shape. For a symmetric section in bending
    // the crossing should be near h/2.
    const zeroIdx = findzero(netForce)
    let yna_mm
    if (zeroIdx === null) {
      yna_mm = h / 2
    } else {
      const i0 = Math.floor(zeroIdx)
      const t  = zeroIdx - i0
      yna_mm = yNA_candidates[i0] * (1 - t) +
               yNA_candidates[Math.min(i0 + 1, nNA - 1)] * t
    }
    y_NA[i] = yna_mm

    // Curvature: κ = eps_top / (h - yna_mm)   [mm⁻¹ → m⁻¹: × 1000]
    const hw = h - yna_mm
    curvature[i] = hw > 0 ? (eps_top / hw) * 1e3 : 0

    // Moment about neutral axis: Σ |sigma| * width * dy * |y - yna|
    let M_Nmm = 0
    for (const y of yArr) {
      const eps = hw > 0 ? eps_top * (y - yna_mm) / hw : 0
      const sig = f(eps)
      M_Nmm += Math.abs(sig) * getWidth(y, h, b, tf, tw, R) * dy * Math.abs(y - yna_mm)
    }
    Mc[i] = M_Nmm * 1e-6     // N·mm → kN·m
  }

  // Elastic limit: first step where top fibre reaches yield
  elasticIndex = numSteps - 1
  for (let i = 0; i < numSteps; i++) {
    if (eps_s_arr[i] >= eps_y) { elasticIndex = i; break }
  }

  // Section classification (EC3)
  const { SC_web, SC_flange, sectionClass } = classifySection(h, b, tf, tw, fy, R)

  // Tabulated M_el and M_pl (from sections.js table values)
  const M_el = (fy * Wy) * 1e-6   // MPa × mm³ → kN·m
  const M_pl = (fy * Zy) * 1e-6

  return {
    numSteps,
    curvature,            // m⁻¹, length numSteps
    Mc,                   // kNm, length numSteps
    y_NA,                 // mm from bottom, length numSteps
    elasticIndex,         // index of first yielded step
    sectionClass,
    SC_web,
    SC_flange,
    M_el,                 // kNm (tabulated)
    M_pl,                 // kNm (tabulated)
    eps_y,                // yield strain
    eps_s_arr,            // top-fibre strains (for diagram reconstruction)
    fy_MPa: fy,
    h, b, tf, tw,
  }
}
