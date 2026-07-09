import { useState } from 'react'
import { REASON_TEMPLATES } from '../labels'

/** Generic reason dialog — the Δ-log discipline lives here. */
export function PromptDialog({
  title,
  description,
  confirmLabel,
  withTemplates,
  onConfirm,
  onClose
}: {
  title: string
  description?: string
  confirmLabel: string
  withTemplates?: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [reason, setReason] = useState('')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {description && <p style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{description}</p>}
        {withTemplates && (
          <div className="chip-row">
            {REASON_TEMPLATES.map((t) => (
              <button key={t} className="chip" onClick={() => setReason(t)}>
                {t}
              </button>
            ))}
          </div>
        )}
        <label className="field">
          <span>
            Begründung <span className="req">*</span> (wird ins Δ-Log geschrieben)
          </span>
          <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="actions">
          <button onClick={onClose}>Abbrechen</button>
          <button className="primary" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
