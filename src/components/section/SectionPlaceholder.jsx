export default function SectionPlaceholder() {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '3rem 2rem',
      textAlign: 'center',
      color: '#9ca3af',
      maxWidth: 520,
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📐</div>
      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
        No section selected
      </div>
      <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
        Choose a section type in the right panel to start the analysis.
      </div>
    </div>
  )
}
