/**
 * Material property tables (Eurokod / SS-EN).
 * Strengths in MPa, E-modulus in MPa.
 */

// ── Steel (EN 1993, t ≤ 40 mm) ───────────────────────────────────────────
export const STEEL = {
  S235: { fy: 235, fu: 360, E: 210000, gamma_M0: 1.0, gamma_M1: 1.0 },
  S275: { fy: 275, fu: 430, E: 210000, gamma_M0: 1.0, gamma_M1: 1.0 },
  S355: { fy: 355, fu: 510, E: 210000, gamma_M0: 1.0, gamma_M1: 1.0 },
  S420: { fy: 420, fu: 520, E: 210000, gamma_M0: 1.0, gamma_M1: 1.0 },
  S460: { fy: 460, fu: 550, E: 210000, gamma_M0: 1.0, gamma_M1: 1.0 },
}

// ── Reinforcement steel (EN 1992) ─────────────────────────────────────────
export const REBAR = {
  'K500B-T': { fyk: 500, fyd: 435, Es: 200000, gamma_s: 1.15 },
  'B500B':   { fyk: 500, fyd: 435, Es: 200000, gamma_s: 1.15 },
}

// ── Concrete (EN 1992, characteristic cylinder strength) ─────────────────
// fcd = alpha_cc * fck / gamma_C, with alpha_cc = 1.0, gamma_C = 1.5
export const CONCRETE = {
  C20: { fck: 20, fcd: 13.3, fctm: 2.2, Ecm: 30000, gamma_btg: 1.5, CRdc: 0.18 / 1.5 },
  C25: { fck: 25, fcd: 16.7, fctm: 2.6, Ecm: 31000, gamma_btg: 1.5, CRdc: 0.18 / 1.5 },
  C30: { fck: 30, fcd: 20.0, fctm: 2.9, Ecm: 33000, gamma_btg: 1.5, CRdc: 0.18 / 1.5 },
  C35: { fck: 35, fcd: 23.3, fctm: 3.2, Ecm: 34000, gamma_btg: 1.5, CRdc: 0.18 / 1.5 },
  C40: { fck: 40, fcd: 26.7, fctm: 3.5, Ecm: 35000, gamma_btg: 1.5, CRdc: 0.18 / 1.5 },
}

// ── Glulam (EN 14080 / Eurocode 5, tabell 4.5) ───────────────────────────
// fmk = bending, fvk = shear, E0mean = mean MOE parallel
export const GLULAM = {
  'GL24c': { fmk: 24, fvk: 3.5, E0mean: 11600, rho_k: 365, rho_mean: 420, gamma_M: 1.25 },
  'GL28c': { fmk: 28, fvk: 3.5, E0mean: 12600, rho_k: 380, rho_mean: 430, gamma_M: 1.25 },
  'GL30c': { fmk: 30, fvk: 3.5, E0mean: 13000, rho_k: 390, rho_mean: 500, gamma_M: 1.25 },
  'GL32c': { fmk: 32, fvk: 3.5, E0mean: 13500, rho_k: 400, rho_mean: 500, gamma_M: 1.25 },
  'GL24h': { fmk: 24, fvk: 3.5, E0mean: 11500, rho_k: 380, rho_mean: 420, gamma_M: 1.25 },
  'GL28h': { fmk: 28, fvk: 3.5, E0mean: 12500, rho_k: 410, rho_mean: 450, gamma_M: 1.25 },
  'GL30h': { fmk: 30, fvk: 4.0, E0mean: 13600, rho_k: 430, rho_mean: 480, gamma_M: 1.25 },
  'GL32h': { fmk: 32, fvk: 4.0, E0mean: 14200, rho_k: 440, rho_mean: 490, gamma_M: 1.25 },
}

// ── Solid timber (EN 338) ─────────────────────────────────────────────────
// fmk=bending, fck=compressive parallel, fvk=shear, E0mean, E005 (5th pct), gamma_M, beta_c
export const TIMBER = {
  C14: { fmk: 14, fck: 16, fvk: 3.0, E0mean:  7000, E005: 4700, rho_k: 290, gamma_M: 1.3, beta_c: 0.2 },
  C16: { fmk: 16, fck: 17, fvk: 3.2, E0mean:  8000, E005: 5400, rho_k: 310, gamma_M: 1.3, beta_c: 0.2 },
  C18: { fmk: 18, fck: 18, fvk: 3.4, E0mean:  9000, E005: 6000, rho_k: 320, gamma_M: 1.3, beta_c: 0.2 },
  C24: { fmk: 24, fck: 21, fvk: 4.0, E0mean: 11000, E005: 7400, rho_k: 350, gamma_M: 1.3, beta_c: 0.2 },
  C30: { fmk: 30, fck: 23, fvk: 4.0, E0mean: 12000, E005: 8000, rho_k: 380, gamma_M: 1.3, beta_c: 0.2 },
}

// ── Load combination factors (EKS 11 / Boverket) ─────────────────────────
export const LOAD_FACTORS = {
  STR_B: { gamma_G: 1.2, gamma_Q: 1.5 },
  STR_A: { gamma_G: 1.35, gamma_Q: 1.5 },
 
}

// Safety class → gamma_d (EKS 11, tabell 1.2)
export const SAFETY_CLASS = {
  1: 0.83,
  2: 0.91,
  3: 1.0,
}
