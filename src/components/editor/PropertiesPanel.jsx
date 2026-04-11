import { IPE_SECTIONS, HEA_SECTIONS, HEB_SECTIONS, HEM_SECTIONS } from '../../data/sections.js'

const FAMILY_MAP = {
  IPE: IPE_SECTIONS,
  HEA: HEA_SECTIONS,
  HEB: HEB_SECTIONS,
  HEM: HEM_SECTIONS,
}
import { GLULAM } from '../../data/materials.js'

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#6b7280',
  marginBottom: 2,
  fontWeight: 500,
}

const inputStyle = {
  width: '100%',
  padding: '0.3rem 0.5rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: '0.85rem',
  boxSizing: 'border-box',
}

const fieldWrap = { marginBottom: '0.75rem' }

function Field({ label, children }) {
  return (
    <div style={fieldWrap}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

const SUPPORT_OPTIONS = ['pin', 'roller', 'fixed', 'free']

function SupportSelect({ value, onChange, options = SUPPORT_OPTIONS }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '0.7rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#9ca3af',
      marginBottom: '0.4rem',
    }}>
      {children}
    </div>
  )
}

// ── Section fields ────────────────────────────────────────────────────────────

function SectionFields({ sectionState, onSectionChange }) {
  const sc   = sectionState ?? { type: 'none' }
  const conc = sc.concrete ?? {}

  return (
    <>
      <Field label="Type">
        <select
          value={sc.type ?? 'none'}
          onChange={e => onSectionChange({ ...sc, type: e.target.value })}
          style={inputStyle}
        >
          <option value="none">None</option>
          <option value="concrete">Concrete (RC)</option>
          <option value="glulam">Glulam</option>
          <option value="steel">Steel (IPE)</option>
        </select>
      </Field>

      {/* ── Concrete ── */}
      {sc.type === 'concrete' && (
        <>
          <Field label="Width b (mm)">
            <input type="number" min="50" max="1000" step="25" style={inputStyle}
              value={conc.b ?? 200}
              onChange={e => onSectionChange({ ...sc, concrete: { ...conc, b: parseFloat(e.target.value) || 200 } })}
            />
          </Field>
          <Field label="Height h (mm)">
            <input type="number" min="50" max="2000" step="25" style={inputStyle}
              value={conc.h ?? 400}
              onChange={e => onSectionChange({ ...sc, concrete: { ...conc, h: parseFloat(e.target.value) || 400 } })}
            />
          </Field>
          <Field label="Cover (mm)">
            <input type="number" min="10" max="100" step="5" style={inputStyle}
              value={conc.cover ?? 30}
              onChange={e => onSectionChange({ ...sc, concrete: { ...conc, cover: parseFloat(e.target.value) || 30 } })}
            />
          </Field>
          <Field label="Tension bars (n)">
            <input type="number" min="1" max="12" step="1" style={inputStyle}
              value={conc.n_bot ?? 3}
              onChange={e => onSectionChange({ ...sc, concrete: { ...conc, n_bot: parseInt(e.target.value) || 1 } })}
            />
          </Field>
          <Field label="Tension ⌀ (mm)">
            <input type="number" min="6" max="40" step="2" style={inputStyle}
              value={conc.dia_bot ?? 16}
              onChange={e => onSectionChange({ ...sc, concrete: { ...conc, dia_bot: parseFloat(e.target.value) || 16 } })}
            />
          </Field>
          <Field label="Compr. bars (n)">
            <input type="number" min="0" max="12" step="1" style={inputStyle}
              value={conc.n_top ?? 0}
              onChange={e => onSectionChange({ ...sc, concrete: { ...conc, n_top: parseInt(e.target.value) || 0 } })}
            />
          </Field>
          <Field label="Compr. ⌀ (mm)">
            <input type="number" min="6" max="40" step="2" style={inputStyle}
              value={conc.dia_top ?? 10}
              onChange={e => onSectionChange({ ...sc, concrete: { ...conc, dia_top: parseFloat(e.target.value) || 10 } })}
            />
          </Field>
          <Field label="fc (MPa)">
            <input type="number" min="12" max="90" step="5" style={inputStyle}
              value={conc.fc ?? 25}
              onChange={e => onSectionChange({ ...sc, concrete: { ...conc, fc: parseFloat(e.target.value) || 25 } })}
            />
          </Field>
          <Field label="fy (MPa)">
            <input type="number" min="200" max="600" step="50" style={inputStyle}
              value={conc.fy ?? 500}
              onChange={e => onSectionChange({ ...sc, concrete: { ...conc, fy: parseFloat(e.target.value) || 500 } })}
            />
          </Field>
        </>
      )}

      {/* ── Glulam ── */}
      {sc.type === 'glulam' && (
        <>
          <Field label="Grade">
            <select
              value={sc.glulam?.grade ?? 'GL28h'}
              onChange={e => onSectionChange({ ...sc, glulam: { ...sc.glulam, grade: e.target.value } })}
              style={inputStyle}
            >
              {Object.keys(GLULAM).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Width b (mm)">
            <input type="number" min="45" max="400" step="5" style={inputStyle}
              value={sc.glulam?.b ?? 140}
              onChange={e => onSectionChange({ ...sc, glulam: { ...sc.glulam, b: parseFloat(e.target.value) || 140 } })}
            />
          </Field>
          <Field label="Height h (mm)">
            <input type="number" min="90" max="2000" step="45" style={inputStyle}
              value={sc.glulam?.h ?? 360}
              onChange={e => onSectionChange({ ...sc, glulam: { ...sc.glulam, h: parseFloat(e.target.value) || 360 } })}
            />
          </Field>
          <Field label="Climate class">
            <select
              value={sc.glulam?.cc ?? 'CC2'}
              onChange={e => onSectionChange({ ...sc, glulam: { ...sc.glulam, cc: e.target.value } })}
              style={inputStyle}
            >
              <option value="CC1">CC1</option>
              <option value="CC2">CC2</option>
              <option value="CC3">CC3</option>
            </select>
          </Field>
          <Field label="Load duration">
            <select
              value={sc.glulam?.loadDuration ?? 'mediumTerm'}
              onChange={e => onSectionChange({ ...sc, glulam: { ...sc.glulam, loadDuration: e.target.value } })}
              style={inputStyle}
            >
              <option value="permanent">Permanent</option>
              <option value="longTerm">Long-term</option>
              <option value="mediumTerm">Medium-term</option>
              <option value="shortTerm">Short-term</option>
              <option value="instantaneous">Instantaneous</option>
            </select>
          </Field>
        </>
      )}

      {/* ── Steel ── */}
      {sc.type === 'steel' && (() => {
        const family  = sc.steel?.family ?? 'IPE'
        const profiles = Object.keys(FAMILY_MAP[family] ?? IPE_SECTIONS)
        return (
          <>
            <Field label="Family">
              <select
                value={family}
                onChange={e => {
                  const newFamily = e.target.value
                  const firstProfile = Object.keys(FAMILY_MAP[newFamily] ?? IPE_SECTIONS)[0]
                  onSectionChange({ ...sc, steel: { ...sc.steel, family: newFamily, profile: firstProfile } })
                }}
                style={inputStyle}
              >
                {Object.keys(FAMILY_MAP).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Profile">
              <select
                value={sc.steel?.profile ?? 'IPE200'}
                onChange={e => onSectionChange({ ...sc, steel: { ...sc.steel, profile: e.target.value } })}
                style={inputStyle}
              >
                {profiles.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="f_yd (MPa)">
              <input type="number" min="200" max="500" step="5" style={inputStyle}
                value={sc.steel?.fy ?? 355}
                onChange={e => onSectionChange({ ...sc, steel: { ...sc.steel, fy: parseFloat(e.target.value) || 355 } })}
              />
            </Field>
          </>
        )
      })()}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PropertiesPanel({
  tab,
  columnState,
  sectionState,
  onColumnChange,
  onSectionChange,
}) {
  const panelStyle = {
    width: 195,
    minWidth: 195,
    background: '#fff',
    borderLeft: '1px solid #e5e7eb',
    padding: '0.85rem 0.85rem',
    overflowY: 'auto',
    fontSize: '0.85rem',
  }

  // ── Column tab ────────────────────────────────────────────────────────────
  if (tab === 'column') {
    return (
      <div style={panelStyle}>
        <SectionLabel>Column</SectionLabel>
        <Field label="Height L (m)">
          <input type="number" min="0.5" step="0.5" style={inputStyle}
            value={columnState.L}
            onChange={e => onColumnChange({ L: parseFloat(e.target.value) || 1 })} />
        </Field>
        <Field label="Axial load label">
          <input style={inputStyle} value={columnState.N_label}
            onChange={e => onColumnChange({ N_label: e.target.value })} />
        </Field>
        <Field label="UDL label">
          <input style={inputStyle} value={columnState.q_label}
            onChange={e => onColumnChange({ q_label: e.target.value })} />
        </Field>
        <Field label="Base support">
          <SupportSelect value={columnState.support}
            onChange={v => onColumnChange({ support: v })} />
        </Field>
        <Field label="Top support">
          <select value={columnState.topSupport}
            onChange={e => onColumnChange({ topSupport: e.target.value })} style={inputStyle}>
            <option value="none">none</option>
            <option value="roller">roller</option>
          </select>
        </Field>
      </div>
    )
  }

  // ── Beam / Section tabs: section properties ───────────────────────────────
  return (
    <div style={panelStyle}>
      <SectionLabel>Section</SectionLabel>
      <SectionFields sectionState={sectionState} onSectionChange={onSectionChange} />
    </div>
  )
}
