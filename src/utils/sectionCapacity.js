/**
 * sectionCapacity.js
 *
 * Returns { M_pos, M_neg } (kNm) — the positive (sagging) and negative (hogging)
 * bending moment capacities for a given sectionState object.
 *
 * Used to draw capacity limit lines on the beam moment diagram.
 *
 * Steel  (symmetric I-section):  M_pos = M_neg = M_pl (class 1-2) or M_el (class 3-4)
 * Glulam (symmetric rectangle):  M_pos = M_neg = fmd · W
 * Concrete (RC, potentially asymmetric):
 *   M_pos = capacity with compression at top (bottom bars in tension)
 *   M_neg = capacity with compression at bottom:
 *     n_top > 0 → flipped-section solve (top bars become tension bars)
 *     n_top = 0 → cracking moment only (M_cr = fctm · b · h² / 6)
 */

import { solveSteelMomentCurvature }    from './steelSectionSolver.js'
import { solveConcreteMomentCurvature } from './concreteSectionSolver.js'
import { IPE_SECTIONS, HEA_SECTIONS, HEB_SECTIONS, HEM_SECTIONS } from '../data/sections.js'
import { GLULAM } from '../data/materials.js'

const FAMILY_MAP = {
  IPE: IPE_SECTIONS,
  HEA: HEA_SECTIONS,
  HEB: HEB_SECTIONS,
  HEM: HEM_SECTIONS,
}

// EC5 Table 3.1 kmod (glulam)
const KMOD = {
  CC1: { permanent: 0.60, longTerm: 0.70, mediumTerm: 0.80, shortTerm: 0.90, instantaneous: 1.10 },
  CC2: { permanent: 0.56, longTerm: 0.65, mediumTerm: 0.75, shortTerm: 0.85, instantaneous: 1.00 },
  CC3: { permanent: 0.50, longTerm: 0.55, mediumTerm: 0.65, shortTerm: 0.70, instantaneous: 0.90 },
}

/**
 * Compute positive and negative moment capacity for the given section.
 * Returns null if no section is selected.
 *
 * @param {object} sectionState  – { type, steel?, glulam?, concrete? }
 * @returns {{ M_pos: number, M_neg: number } | null}  kNm
 */
export function getSectionCapacity(sectionState) {
  if (!sectionState || sectionState.type === 'none') return null

  // ── Steel ──────────────────────────────────────────────────────────────────
  if (sectionState.type === 'steel') {
    const { family = 'IPE', profile = 'IPE200', fy = 355 } = sectionState.steel ?? {}
    const sec = (FAMILY_MAP[family] ?? IPE_SECTIONS)[profile]
    if (!sec) return null

    // Run solver with minimal steps — only need sectionClass, M_el, M_pl
    const res = solveSteelMomentCurvature({
      h: sec.h, b: sec.b, tf: sec.tf, tw: sec.tw, R: sec.R ?? 0,
      Wy: sec.Wy, Zy: sec.Zy, fy,
      numSteps: 10,
    })
    // Class 1-2: full plastic capacity; class 3: elastic; class 4: reduced (use M_el as conservative)
    const M_cap = res.sectionClass <= 2 ? res.M_pl : res.M_el
    return { M_pos: M_cap, M_neg: M_cap }
  }

  // ── Glulam ─────────────────────────────────────────────────────────────────
  if (sectionState.type === 'glulam') {
    const { grade = 'GL28h', b = 140, h = 360,
            cc = 'CC2', loadDuration = 'mediumTerm' } = sectionState.glulam ?? {}
    const mat  = GLULAM[grade] ?? GLULAM['GL28h']
    const kmod = KMOD[cc]?.[loadDuration] ?? 0.75
    const fmd  = kmod * mat.fmk / mat.gamma_M   // MPa
    const W    = (b * h ** 2) / 6               // mm³
    const M_Rd = fmd * W * 1e-6                 // kNm
    return { M_pos: M_Rd, M_neg: M_Rd }
  }

  // ── Concrete ───────────────────────────────────────────────────────────────
  if (sectionState.type === 'concrete') {
    const conc = sectionState.concrete ?? {}
    const { b = 200, h = 400, n_top = 0,
            dia_bot = 16, dia_top = 10, n_bot = 3 } = conc

    // Positive moment — compression at top, tension in bottom bars
    const resPos = solveConcreteMomentCurvature({ ...conc, numSteps: 80 })
    const M_pos  = Math.max(...resPos.Mc)

    // Negative moment — compression at bottom, tension at top
    let M_neg
    if (n_top === 0) {
      // No top bars: hogging capacity limited to cracking moment
      // M_cr = fctm · b · h² / 6  (fctm ≈ 2.2 MPa, same as solver)
      const f_ctm = 2.2   // MPa
      M_neg = f_ctm * (b * 1e-3) * (h * 1e-3) ** 2 / 6 * 1e3  // kNm
    } else {
      // Flip: what were compression bars become tension bars
      const resNeg = solveConcreteMomentCurvature({
        ...conc,
        n_bot:   n_top,
        dia_bot: dia_top,
        n_top:   n_bot,
        dia_top: dia_bot,
        numSteps: 80,
      })
      M_neg = Math.max(...resNeg.Mc)
    }

    return { M_pos, M_neg }
  }

  return null
}
