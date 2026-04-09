/**
 * concreteSectionSolver – moment-curvature analysis for RC sections.
 *
 * EC2 Sargin concrete model + elastic-perfectly-plastic steel.
 * Port of ConcreteBender (vanilla JS) into a pure, side-effect-free function.
 *
 * Inputs:  mm / MPa
 * Outputs: kN, kNm, m⁻¹, dimensionless strains
 */

function findzero(arr) {
  for (let i = 0; i < arr.length - 1; i++) {
    if (Math.sign(arr[i]) === 0) return i
    if (Math.sign(arr[i]) !== Math.sign(arr[i + 1])) return i
  }
  return 0
}

/**
 * Solve the full moment-curvature envelope for a rectangular RC section.
 *
 * @param {object} opts
 * @param {number} opts.b         Section width (mm)
 * @param {number} opts.h         Section height (mm)
 * @param {number} opts.fc        Concrete cylinder strength (MPa)
 * @param {number} opts.fy        Steel yield strength (MPa)
 * @param {number} opts.n_bot     Number of tension bars
 * @param {number} opts.dia_bot   Tension bar diameter (mm)
 * @param {number} opts.n_top     Number of compression bars (0 = none)
 * @param {number} opts.dia_top   Compression bar diameter (mm)
 * @param {number} opts.cover     Cover to stirrup face (mm)
 * @param {number} opts.numSteps  Number of strain increments (default 300)
 *
 * @returns {{
 *   numSteps:      number,
 *   curvature:     number[],   m⁻¹
 *   Mc:            number[],   kNm
 *   NA:            number[],   neutral axis depth from top (m)
 *   crackCheck:    boolean[],
 *   Fs_out:        number[],   kN
 *   Fsp_out:       number[],   kN
 *   Fc_out:        number[],   kN
 *   Fct_out:       number[],   kN
 *   sigma_s_out:   number[],   MPa
 *   sigma_sp_out:  number[],   MPa
 *   eps_c_out:     number[],   top concrete strain at each step
 *   eps_s1_out:    number[],   tension steel strain
 *   eps_sp_out:    number[],   compression steel strain
 *   eps_c_curve:   number[],   concrete strain array 0→eps_cu (for M-K reference)
 *   sigma_c_curve: number[],   MPa (for M-K reference)
 *   eps_sy:        number,     steel yield strain
 *   f_yd_MPa:      number,     steel design yield strength (MPa)
 *   eps_cu:        number,     3.5e-3
 *   d_m:           number,     effective tension depth (m)
 *   d_p_m:         number,     effective compression depth from top (m)
 * }}
 */
export function solveConcreteMomentCurvature({
  b: b_mm     = 200,
  h: h_mm     = 400,
  fc          = 25,
  fy          = 500,
  n_bot       = 3,
  dia_bot: dia_bot_mm = 16,
  n_top       = 0,
  dia_top: dia_top_mm = 10,
  cover: cover_mm     = 30,
  numSteps    = 300,
} = {}) {
  // ── Convert inputs to metres ─────────────────────────────────────────────
  const b      = b_mm       * 1e-3
  const h      = h_mm       * 1e-3
  const dbar   = dia_bot_mm * 1e-3
  const dbar_p = dia_top_mm * 1e-3
  const cov    = cover_mm   * 1e-3

  // ── Material constants ────────────────────────────────────────────────────
  const f_cm  = fc * 1e6                         // Pa
  const eps_cu = 3.5e-3
  const eps_c1 = 0.7 * Math.pow(fc, 0.31) * 1e-3
  const k_sar  = 1.05 * 30e9 * eps_c1 / f_cm
  const E_cm   = 30e9                             // Pa
  const f_ctm  = 2.2e6                            // Pa mean tensile strength
  const f_yd   = fy * 1e6                         // Pa
  const E_s    = 200e9                            // Pa
  const eps_sy = f_yd / E_s

  // Sargin parabolic concrete stress (Pa, positive = compression)
  function sigC(eps) {
    if (eps <= 0) return 0
    const n = Math.min(eps, eps_cu) / eps_c1
    return f_cm * (k_sar * n - n * n) / ((k_sar - 2) * n + 1)
  }

  // ── Material reference curves (0 → eps_cu) ───────────────────────────────
  const eps_c_curve   = new Array(numSteps + 1)
  const sigma_c_curve = new Array(numSteps + 1)
  for (let i = 0; i <= numSteps; i++) {
    eps_c_curve[i]   = (eps_cu / numSteps) * i
    sigma_c_curve[i] = sigC(eps_c_curve[i]) / 1e6  // MPa
  }

  // ── Geometry ──────────────────────────────────────────────────────────────
  // Max bars in one layer (using 0.01 m = 10 mm minimum spacing offset, matching ConcreteBender)
  const nmax = Math.max(1, Math.floor((b - 2 * (dbar + 0.01)) / (2 * dbar)))

  // Effective tension depth (centroid of tension bars, from top)
  let d
  if (n_bot <= nmax) {
    d = h - cov - dbar / 2
  } else {
    const n2 = n_bot - nmax
    // Weighted average of two layers
    const y1 = h - cov - dbar / 2
    const y2 = h - cov - dbar - 0.01 - dbar / 2 - dbar  // second layer
    d = (nmax * y1 + n2 * y2) / n_bot
  }

  // Compression bar centroid from top
  const d_p = cov + dbar_p / 2

  const A_s  = n_bot * Math.PI * (dbar   / 2) ** 2
  const A_sp = n_top > 0 ? n_top * Math.PI * (dbar_p / 2) ** 2 : 0

  // ── Precompute cumulative concrete stress sum (running-mean trick) ─────────
  const sigma_cumsum = new Array(numSteps + 1)
  sigma_cumsum[0] = sigC(eps_c_curve[0])
  for (let i = 1; i <= numSteps; i++) {
    sigma_cumsum[i] = sigma_cumsum[i - 1] + sigC(eps_c_curve[i])
  }

  // ── Neutral axis candidate positions (d_p … d) ────────────────────────────
  const xnCount = 500
  const xnStep  = (d - d_p) / xnCount
  const xn      = new Array(xnCount + 1)
  for (let j = 0; j <= xnCount; j++) xn[j] = d_p + j * xnStep

  // ── Output arrays ──────────────────────────────────────────────────────────
  const Mc           = new Array(numSteps + 1).fill(0)
  const curvature    = new Array(numSteps + 1).fill(0)
  const NA           = new Array(numSteps + 1).fill(d / 2)
  const crackCheck   = new Array(numSteps + 1).fill(false)
  const Fs_out       = new Array(numSteps + 1).fill(0)
  const Fsp_out      = new Array(numSteps + 1).fill(0)
  const Fc_out       = new Array(numSteps + 1).fill(0)
  const Fct_out      = new Array(numSteps + 1).fill(0)
  const sigma_s_out  = new Array(numSteps + 1).fill(0)
  const sigma_sp_out = new Array(numSteps + 1).fill(0)
  const eps_c_out    = new Array(numSteps + 1).fill(0)
  const eps_s1_out   = new Array(numSteps + 1).fill(0)
  const eps_sp_out   = new Array(numSteps + 1).fill(0)

  // Reusable working buffers
  const sigma_s_buf      = new Array(xnCount + 1)
  const sigma_sp_buf     = new Array(xnCount + 1)
  const eps_cb_buf       = new Array(xnCount + 1)
  const forceEqCracked   = new Array(xnCount + 1)
  const forceEqUncracked = new Array(xnCount + 1)

  // ── Main solver loop ──────────────────────────────────────────────────────
  for (let i = 1; i <= numSteps; i++) {
    const eps_c_max      = eps_c_curve[i]
    eps_c_out[i]         = eps_c_max
    const sigma_sub_mean = sigma_cumsum[i] / (i + 1)

    for (let j = 0; j <= xnCount; j++) {
      const xn_j = xn[j]
      const sr   = eps_c_max / xn_j

      const ss = sr * (d - xn_j) * E_s
      sigma_s_buf[j] = ss > f_yd ? f_yd : ss

      const ssp = sr * (xn_j - d_p) * E_s
      sigma_sp_buf[j] = ssp > f_yd ? f_yd : ssp

      eps_cb_buf[j] = eps_c_max * (h - xn_j) / xn_j

      const fC  = sigma_sub_mean * b * xn_j + sigma_sp_buf[j] * A_sp
      const fT2 = sigma_s_buf[j] * A_s

      forceEqCracked[j]   = fC - fT2
      forceEqUncracked[j] = fC - (fT2 + E_cm * (h - xn_j) * b * 0.5 * eps_cb_buf[j])
    }

    const id_crk = findzero(forceEqCracked)
    const id_unc = findzero(forceEqUncracked)

    let id
    if (eps_cb_buf[id_unc] * E_cm > f_ctm) {
      id = id_crk; crackCheck[i] = true
    } else {
      id = id_unc; crackCheck[i] = false
    }

    const xn_idx = xn[id]
    NA[i]           = xn_idx
    sigma_s_out[i]  = sigma_s_buf[id]  / 1e6  // MPa
    sigma_sp_out[i] = sigma_sp_buf[id] / 1e6  // MPa
    eps_s1_out[i]   = eps_c_max * (d   - xn_idx) / xn_idx
    eps_sp_out[i]   = eps_c_max * (xn_idx - d_p) / xn_idx
    curvature[i]    = xn_idx > 0 ? eps_s1_out[i] / Math.max(d - xn_idx, 1e-9) : 0

    // Centroid of concrete compression stress block
    const ycLen  = i + 1
    const ycStart = d - xn_idx
    const ycStep  = ycLen > 1 ? (d - ycStart) / i : 0
    let sumProd = 0, sumSig = 0
    for (let j = 0; j < ycLen; j++) {
      const yc_j  = ycStart + j * ycStep + (h - d)
      const sig_j = sigC(eps_c_curve[j])
      sumProd += sig_j * yc_j
      sumSig  += sig_j
    }
    const cncrt_tp = sumSig > 0 ? sumProd / sumSig : xn_idx / 2

    const Fs  = sigma_s_out[i]  * A_s  * 1e3  // kN
    const Fsp = sigma_sp_out[i] * A_sp * 1e3  // kN
    const Fc  = sigma_sub_mean * b * xn_idx / 1e3  // kN
    const Fct = crackCheck[i] ? 0
              : 0.5 * eps_cb_buf[id] * E_cm * b * (h - xn_idx) / 1e3  // kN

    Fs_out[i]  = Fs;  Fsp_out[i]  = Fsp
    Fc_out[i]  = Fc;  Fct_out[i]  = Fct

    Mc[i] = Fc  * (cncrt_tp - (h - xn_idx))
           + Fsp * (xn_idx - d_p)
           + Fs  * (d - xn_idx)
           + (crackCheck[i] ? 0 : Fct * (h - xn_idx) * 2 / 3)
  }

  return {
    numSteps,
    curvature, Mc, NA, crackCheck,
    Fs_out, Fsp_out, Fc_out, Fct_out,
    sigma_s_out, sigma_sp_out,
    eps_c_out, eps_s1_out, eps_sp_out,
    eps_c_curve, sigma_c_curve,
    eps_sy,
    f_yd_MPa: f_yd / 1e6,
    eps_cu,
    d_m:   d,
    d_p_m: d_p,
  }
}
