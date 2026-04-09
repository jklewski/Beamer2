import { IPE_SECTIONS } from '../../data/sections.js'

// ── Shared field helpers ──────────────────────────────────────────────────────

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

const SUPPORT_OPTIONS      = ['pin', 'roller', 'fixed', 'free']
const SUPPORT_OPTIONS_NO_H = ['roller', 'free']

function restrainsH(type) {
  return type === 'pin' || type === 'fixed'
}

function SupportSelect({ value, onChange, options = SUPPORT_OPTIONS }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ── Drag tile ─────────────────────────────────────────────────────────────────

function DragTile({ label, elementType, icon, disabled, disabledReason }) {
  function handleDragStart(e) {
    e.dataTransfer.setData(
      'application/structural-element',
      JSON.stringify({ elementType })
    )
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      title={disabled ? disabledReason : `Drag to add ${label}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '0.5rem 0.4rem',
        borderRadius: 6,
        border: '1px solid #e5e7eb',
        background: disabled ? '#f9fafb' : '#fff',
        cursor: disabled ? 'not-allowed' : 'grab',
        opacity: disabled ? 0.45 : 1,
        userSelect: 'none',
        transition: 'box-shadow 0.15s',
        flex: '1 1 0',
        minWidth: 0,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {icon}
      <span style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const PointLoadIcon = () => (
  <svg width="32" height="36" viewBox="0 0 36 40">
    <line x1="18" y1="2" x2="18" y2="28" stroke="#dc2626" strokeWidth="2.2" />
    <polygon points="18,38 12,26 24,26" fill="#dc2626" />
  </svg>
)

const UDLIcon = () => (
  <svg width="32" height="36" viewBox="0 0 36 40">
    <line x1="2" y1="4" x2="34" y2="4" stroke="#2563eb" strokeWidth="1.8" />
    {[7, 15, 22, 29].map(x => (
      <g key={x}>
        <line x1={x} y1="4" x2={x} y2="28" stroke="#2563eb" strokeWidth="1.4" />
        <polygon points={`${x},36 ${x - 4},26 ${x + 4},26`} fill="#2563eb" />
      </g>
    ))}
  </svg>
)

const InnerSupportIcon = () => (
  <svg width="32" height="36" viewBox="0 0 36 40">
    <rect x="4" y="10" width="28" height="8" fill="#e8e8e8" stroke="#1a1a2e" strokeWidth="1.2" />
    <polygon points="18,18 10,30 26,30" fill="none" stroke="#374151" strokeWidth="1.6" />
    <circle cx="12" cy="33" r="2.5" fill="none" stroke="#374151" strokeWidth="1.4" />
    <circle cx="18" cy="33" r="2.5" fill="none" stroke="#374151" strokeWidth="1.4" />
    <circle cx="24" cy="33" r="2.5" fill="none" stroke="#374151" strokeWidth="1.4" />
    <line x1="6" y1="37" x2="30" y2="37" stroke="#374151" strokeWidth="1.6" />
  </svg>
)

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '0.7rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#9ca3af',
      marginBottom: '0.4rem',
      marginTop: '0.1rem',
    }}>
      {children}
    </div>
  )
}

// ── Load editor ───────────────────────────────────────────────────────────────

function LoadEditor({ load, beamState, selectedId, onLoadChange, onDeleteLoad }) {
  const isUDL = load.type === 'udl'
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: '#374151', marginBottom: '0.6rem' }}>
        {isUDL ? 'Distributed Load' : 'Point Load'}
      </div>
      <Field label="Label">
        <input style={inputStyle} value={load.label ?? ''}
          onChange={e => onLoadChange(selectedId, { label: e.target.value })} />
      </Field>
      <Field label="Magnitude (kN/m or kN)">
        <input type="number" style={inputStyle} value={load.magnitude ?? ''}
          onChange={e => onLoadChange(selectedId, { magnitude: parseFloat(e.target.value) || 0 })} />
      </Field>
      {isUDL ? (
        <>
          <Field label="Start (0–1)">
            <input type="number" min="0" max="1" step="0.05" style={inputStyle}
              value={load.xStart ?? 0}
              onChange={e => onLoadChange(selectedId, { xStart: parseFloat(e.target.value) })} />
          </Field>
          <Field label="End (0–1)">
            <input type="number" min="0" max="1" step="0.05" style={inputStyle}
              value={load.xEnd ?? 1}
              onChange={e => onLoadChange(selectedId, { xEnd: parseFloat(e.target.value) })} />
          </Field>
        </>
      ) : (
        <Field label="Position (0–1)">
          <input type="number" min="0" max="1" step="0.05" style={inputStyle}
            value={load.x ?? 0.5}
            onChange={e => onLoadChange(selectedId, { x: parseFloat(e.target.value) })} />
        </Field>
      )}
      <Field label="Color">
        <input type="color"
          style={{ ...inputStyle, padding: 2, height: 34, cursor: 'pointer' }}
          value={load.color ?? '#2563eb'}
          onChange={e => onLoadChange(selectedId, { color: e.target.value })} />
      </Field>
      <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '0.5rem 0 0.75rem' }} />
      <button onClick={() => onDeleteLoad(selectedId)}
        style={{ width: '100%', padding: '0.4rem', background: '#fef2f2', color: '#dc2626',
          border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer',
          fontSize: '0.85rem', fontWeight: 500 }}>
        Delete Load
      </button>
    </div>
  )
}

// ── Inner support editor ──────────────────────────────────────────────────────

function InnerSupportEditor({ sup, beamState, onInnerSupportMove, onInnerSupportRemove }) {
  const step = 1 / (beamState.numGridCells ?? 10)
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: '#374151', marginBottom: '0.6rem' }}>
        Inner Support
      </div>
      <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: '0.6rem' }}>
        Roller (vertical only)
      </div>
      <Field label="Position (0–1)">
        <input type="number" min={step} max={1 - step} step={step} style={inputStyle}
          value={sup.frac.toFixed(3)}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onInnerSupportMove(sup.id, v) }}
        />
      </Field>
      <Field label="Position (m)">
        <input type="number" readOnly
          style={{ ...inputStyle, background: '#f9fafb', color: '#6b7280' }}
          value={(sup.frac * beamState.L).toFixed(2)}
        />
      </Field>
      <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '0.5rem 0 0.75rem' }} />
      <button onClick={() => onInnerSupportRemove(sup.id)}
        style={{ width: '100%', padding: '0.4rem', background: '#fef2f2', color: '#dc2626',
          border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer',
          fontSize: '0.85rem', fontWeight: 500 }}>
        Remove Support
      </button>
    </div>
  )
}

// ── Main Toolbox ──────────────────────────────────────────────────────────────

export default function Toolbox({
  tab,
  beamState,
  selectedId,
  onBeamChange,
  onLoadChange,
  onDeleteLoad,
  onInnerSupportMove,
  onInnerSupportRemove,
}) {
  const isBeam    = tab === 'beam'
  const maxIsup   = (beamState?.intermediateSupports?.length ?? 0) >= 5

  const panelStyle = {
    width: 185,
    minWidth: 185,
    background: '#f9fafb',
    borderRight: '1px solid #e5e7eb',
    padding: '0.85rem 0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
    overflowY: 'auto',
    fontSize: '0.85rem',
  }

  // ── Load / inner-support editor (takes priority when something is selected) ─
  if (isBeam && selectedId) {
    const isupIdx = beamState.intermediateSupports.findIndex(s => s.id === selectedId)
    if (isupIdx !== -1) {
      const sup = beamState.intermediateSupports[isupIdx]
      return (
        <div style={panelStyle}>
          <InnerSupportEditor
            sup={sup}
            beamState={beamState}
            onInnerSupportMove={onInnerSupportMove}
            onInnerSupportRemove={onInnerSupportRemove}
          />
        </div>
      )
    }
    const load = beamState.loads.find(l => l.id === selectedId)
    if (load) {
      return (
        <div style={panelStyle}>
          <LoadEditor
            load={load}
            beamState={beamState}
            selectedId={selectedId}
            onLoadChange={onLoadChange}
            onDeleteLoad={onDeleteLoad}
          />
        </div>
      )
    }
  }

  // ── Default view: drag tiles + beam properties ────────────────────────────
  return (
    <div style={panelStyle}>
      <SectionLabel>Loads</SectionLabel>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <DragTile
          label="Point Load"
          elementType="point-load"
          icon={<PointLoadIcon />}
          disabled={!isBeam}
          disabledReason="Switch to Beam tab to add loads"
        />
        <DragTile
          label="UDL"
          elementType="udl"
          icon={<UDLIcon />}
          disabled={!isBeam}
          disabledReason="Switch to Beam tab to add loads"
        />
      </div>

      <SectionLabel>Supports</SectionLabel>
      <div style={{ marginBottom: '0.5rem' }}>
        <DragTile
          label="Inner Support"
          elementType="inner-support"
          icon={<InnerSupportIcon />}
          disabled={!isBeam || maxIsup}
          disabledReason={maxIsup ? 'Maximum 5 inner supports' : 'Switch to Beam tab'}
        />
      </div>
      {isBeam && (
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center', marginBottom: '0.5rem' }}>
          {beamState.intermediateSupports.length}/5
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0.4rem 0 0.6rem' }} />

      {/* ── Beam properties ── */}
      <div style={{ opacity: isBeam ? 1 : 0.4, pointerEvents: isBeam ? 'all' : 'none' }}>
        <SectionLabel>Beam</SectionLabel>
        <Field label="Span L (m)">
          <input type="number" min="0.5" step="0.5" style={inputStyle}
            value={beamState?.L ?? 6}
            onChange={e => onBeamChange({ L: parseFloat(e.target.value) || 1 })} />
        </Field>
        <Field label="Left support">
          <SupportSelect
            value={beamState?.supports?.left ?? 'pin'}
            options={restrainsH(beamState?.supports?.right) ? SUPPORT_OPTIONS_NO_H : SUPPORT_OPTIONS}
            onChange={v => onBeamChange({ supports: { ...beamState.supports, left: v } })}
          />
        </Field>
        <Field label="Right support">
          <SupportSelect
            value={beamState?.supports?.right ?? 'roller'}
            onChange={v => onBeamChange({ supports: { ...beamState.supports, right: v } })}
          />
        </Field>
        <Field label="Grid divisions">
          <input type="number" min="2" max="20" step="1" style={inputStyle}
            value={beamState?.numGridCells ?? 10}
            onChange={e => onBeamChange({ numGridCells: Math.max(2, parseInt(e.target.value) || 10) })} />
        </Field>
        <Field label={`Support size ×${(beamState?.supportScale ?? 1).toFixed(1)}`}>
          <input type="range" min="0.5" max="3" step="0.1"
            style={{ width: '100%', cursor: 'pointer' }}
            value={beamState?.supportScale ?? 1}
            onChange={e => onBeamChange({ supportScale: parseFloat(e.target.value) })} />
        </Field>
      </div>

      {isBeam && (
        <div style={{ marginTop: 'auto', paddingTop: '0.75rem', fontSize: '0.7rem', color: '#9ca3af', lineHeight: 1.5 }}>
          Click a load or support to edit it. Drag items above onto the canvas.
        </div>
      )}
    </div>
  )
}
