import { useEffect, useState } from 'react'
import { api } from '../api'

export function SettingsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [baseUrl, setBaseUrl] = useState('')
  const [key, setKey] = useState('')
  const [model, setModel] = useState('')

  useEffect(() => {
    void api.loadSettings().then((s) => {
      setBaseUrl(s.apiBaseUrl)
      setKey(s.apiKey)
      setModel(s.model)
    })
  }, [])

  const save = async (): Promise<void> => {
    await api.saveSettings({ apiBaseUrl: baseUrl.trim(), apiKey: key.trim(), model: model.trim() })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>KI-Anbindung (optional)</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
          Ohne Konfiguration nutzt der Adversarial-Modus die eingebaute, deterministische Angriffs-Engine (offline).
          Mit einem OpenAI-kompatiblen Endpunkt formuliert ein LLM die Angriffe — es bleibt Werkzeug:
          Es erzeugt nur Angriffe, nie Urteile.
        </p>
        <label className="field">
          <span>API-Basis-URL (OpenAI-kompatibel, z. B. https://api.openai.com/v1)</span>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="leer = offline Engine" />
        </label>
        <label className="field">
          <span>API-Key</span>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <label className="field">
          <span>Modell</span>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="z. B. gpt-4o-mini" />
        </label>
        <div className="actions">
          <button onClick={onClose}>Abbrechen</button>
          <button className="primary" onClick={() => void save()}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}
