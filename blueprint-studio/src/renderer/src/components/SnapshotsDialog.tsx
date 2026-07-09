import { useStudio } from '../store'
import { api } from '../api'

export function SnapshotsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const bp = useStudio((s) => s.blueprint)!
  const snaps = [...bp.snapshots].reverse()

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Snapshots — unveränderliche Revisionsstände</h2>
        {snaps.length === 0 && (
          <div className="empty-hint">
            Noch keine Snapshots. „Commit“ in der Werkzeugleiste friert den aktuellen Stand ein.
          </div>
        )}
        {snaps.map((s) => (
          <div key={s.id} className="suggestion-card" style={{ borderStyle: 'solid' }}>
            <b>{s.label}</b> · <code style={{ fontSize: 11 }}>{s.hash}</code> ·{' '}
            <span style={{ fontSize: 11.5 }}>{s.createdAt.slice(0, 16).replace('T', ' ')}</span>
            <div style={{ margin: '4px 0', color: 'var(--text-dim)' }}>{s.reason}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
              {s.graph.nodes.length} Knoten · {s.graph.edges.length} Kanten ·{' '}
              {s.graph.attacks.filter((a) => a.responseState === 'open').length} offene Angriffe
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button style={{ fontSize: 11.5 }} onClick={() => void api.exportJson(bp, s.id)}>
                JSON exportieren
              </button>
              <button style={{ fontSize: 11.5 }} onClick={() => void api.exportPdf(bp, s.id)}>
                PDF exportieren
              </button>
            </div>
          </div>
        ))}
        <div className="actions">
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  )
}
