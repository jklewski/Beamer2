/**
 * SectionAnalysisView – dispatcher for section-tab analysis panels.
 *
 * Owns strainIndex state and exposes it (and its setter) via the
 * onStrainChange / strainIndex props so PropertiesPanel can also render
 * a slider if needed. Currently the slider lives inside ConcreteSectionAnalysis.
 *
 * Extensibility: add SteelSectionAnalysis and GlulamSectionAnalysis branches
 * as the corresponding "bender" apps are ported in future iterations.
 */
import { useState, useEffect } from 'react'
import ConcreteSectionAnalysis from './ConcreteSectionAnalysis.jsx'
import SteelSectionAnalysis    from './SteelSectionAnalysis.jsx'
import GlulamSectionAnalysis   from './GlulamSectionAnalysis.jsx'
import SectionPlaceholder      from './SectionPlaceholder.jsx'

export default function SectionAnalysisView({ sectionState }) {
  const [strainIndex, setStrainIndex] = useState(300)

  // Reset strainIndex when section type changes
  useEffect(() => {
    setStrainIndex(300)
  }, [sectionState.type])

  const { type } = sectionState

  if (type === 'concrete') {
    return (
      <ConcreteSectionAnalysis
        section={sectionState.concrete}
        strainIndex={strainIndex}
        onStrainChange={setStrainIndex}
      />
    )
  }

  if (type === 'steel') {
    return (
      <SteelSectionAnalysis
        section={sectionState.steel}
        strainIndex={strainIndex}
        onStrainChange={setStrainIndex}
      />
    )
  }

  if (type === 'glulam') {
    return (
      <GlulamSectionAnalysis
        section={sectionState.glulam}
        strainIndex={strainIndex}
        onStrainChange={setStrainIndex}
      />
    )
  }

  return <SectionPlaceholder />
}
