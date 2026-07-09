import { useState } from 'react'
import { useStudio } from '../store'

/** Bottom bar: the compiler status (spec UI §7). */
export function ValidationBar(): React.JSX.Element {
  const { validation, select, blueprint } = useStudio()
  const bp = blueprint!
  const [open, setOpen] = useState<'errors' | 'warnings' | null>(null)
  const v = validation
  if (!v) return <div className="validation-bar" />

  const openAttacks = bp.graph.attacks.filter((a) => a.responseState === 'open').length

  return (
    <>
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 40,
            left: 240,
            right: 364,
            maxHeight: '40vh',
            overflowY: 'auto',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 10,
            zIndex: 40
          }}
        >
          {(open === 'errors' ? v.errors : v.warnings).map((iss, i) => (
            <div
              key={i}
              className="suggestion-card"
              style={{ borderColor: iss.severity === 'error' ? 'var(--red)' : 'var(--yellow)', cursor: iss.nodeIds.length ? 'pointer' : 'default', marginBottom: 6 }}
              onClick={() => {
                if (iss.nodeIds[0]) select(iss.nodeIds[0])
              }}
            >
              {iss.message}
            </div>
          ))}
          {(open === 'errors' ? v.errors : v.warnings).length === 0 && <div className="empty-hint">Nichts.</div>}
        </div>
      )}
      <div className="validation-bar">
        <b>Compiler:</b>
        {v.errors.length === 0 ? (
          <span className="ok">✓ grün — formal gültig{openAttacks === 0 ? ', einreichbar' : ''}</span>
        ) : (
          <span className="err" onClick={() => setOpen(open === 'errors' ? null : 'errors')}>
            ● {v.errors.length} Fehler (blockierend)
          </span>
        )}
        <span className="warn" onClick={() => setOpen(open === 'warnings' ? null : 'warnings')}>
          ▲ {v.warnings.length} Warnungen
        </span>
        {openAttacks > 0 && <span style={{ color: 'var(--red)' }}>⚔ {openAttacks} offene Angriffe</span>}
        <span className="spacer" style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-dim)', fontSize: 11.5 }}>
          {bp.graph.nodes.length} Knoten · {bp.graph.edges.length} Kanten · {bp.deltaLog.length} Δ-Einträge
        </span>
      </div>
    </>
  )
}
