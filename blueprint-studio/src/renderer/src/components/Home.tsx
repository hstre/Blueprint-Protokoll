import { useEffect, useState } from 'react'
import type { BlueprintMeta } from '@shared/types'
import { api } from '../api'
import { useStudio } from '../store'
import { BP_STATUS_LABEL } from '../labels'
import { SettingsDialog } from './SettingsDialog'

export function Home(): React.JSX.Element {
  const [metas, setMetas] = useState<BlueprintMeta[]>([])
  const [title, setTitle] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const { openBlueprint, createBlueprint, createDemo } = useStudio()

  const refresh = (): void => {
    void api.listBlueprints().then(setMetas)
  }
  useEffect(refresh, [])

  const create = async (): Promise<void> => {
    if (!title.trim()) return
    await createBlueprint(title.trim(), '')
  }

  return (
    <div className="home">
      <h1>Blueprint Studio</h1>
      <div className="sub">
        Epistemische Werkbank nach dem Blueprint-Protokoll — Denken formalisieren, prüfen, revidieren.
      </div>

      <div className="new-row">
        <input
          placeholder="Titel des neuen Blueprints … (z. B. eine präzise Leitfrage)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void create()}
        />
        <button className="primary" disabled={!title.trim()} onClick={() => void create()}>
          Neu anlegen
        </button>
        <button onClick={() => void createDemo()}>Demo öffnen</button>
        <button className="ghost" title="KI-Einstellungen" onClick={() => setShowSettings(true)}>
          ⚙︎
        </button>
      </div>

      {metas.length === 0 && (
        <div className="empty-hint">
          Noch keine Blueprints. Lege einen an — oder öffne den Demo-Blueprint, um das Protokoll kennenzulernen.
        </div>
      )}

      {metas.map((m) => (
        <div key={m.id} className="bp-card" onClick={() => void openBlueprint(m.id)}>
          <div className="info">
            <div className="t">{m.title}</div>
            {m.description && <div className="d">{m.description}</div>}
          </div>
          <span className={`status-chip ${m.status}`}>{BP_STATUS_LABEL[m.status]}</span>
          <div className="stats">
            {m.nodeCount} Knoten
            {m.openAttacks > 0 && (
              <>
                <br />
                <span style={{ color: 'var(--red)' }}>{m.openAttacks} offene Angriffe</span>
              </>
            )}
          </div>
          <button
            className="ghost"
            title="Löschen"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`„${m.title}“ endgültig löschen?`)) {
                void api.deleteBlueprint(m.id).then(refresh)
              }
            }}
          >
            ✕
          </button>
        </div>
      ))}

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}
