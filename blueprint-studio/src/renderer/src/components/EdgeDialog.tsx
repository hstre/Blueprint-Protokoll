import { useState } from 'react'
import type { EdgeType } from '@shared/types'
import { useStudio } from '../store'
import { EDGE_TYPE_LABEL, REASON_TEMPLATES } from '../labels'

export interface PendingEdge {
  from: string
  to: string
  /** set ⇒ dialog offers removal of this existing edge */
  removeId?: string
}

const EDGE_TYPES: EdgeType[] = ['supports', 'requires', 'contradicts', 'qualifies', 'generalizes', 'exception_to']

const EDGE_HINT: Record<EdgeType, string> = {
  supports: 'A stützt B — B ruht (auch) auf A.',
  requires: 'A setzt B voraus — fällt B, wackelt A.',
  contradicts: 'A widerspricht B — beide „gesichert“ blockiert den Compiler.',
  qualifies: 'A präzisiert B (engerer Scope, klarere Bedingungen).',
  generalizes: 'A verallgemeinert B.',
  exception_to: 'A ist Ausnahme von B.'
}

export function EdgeDialog({ pending, onClose }: { pending: PendingEdge; onClose: () => void }): React.JSX.Element {
  const { blueprint, addEdge, removeEdge } = useStudio()
  const bp = blueprint!
  const [edgeType, setEdgeType] = useState<EdgeType>('supports')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const from = bp.graph.nodes.find((n) => n.id === pending.from)
  const to = bp.graph.nodes.find((n) => n.id === pending.to)
  const existing = pending.removeId ? bp.graph.edges.find((e) => e.id === pending.removeId) : undefined

  const confirm = (): void => {
    if (existing) {
      removeEdge(existing.id, reason)
      onClose()
      return
    }
    const res = addEdge(pending.from, pending.to, edgeType, reason)
    if (res.error) setError(res.error)
    else onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          {existing ? 'Kante entfernen' : 'Beziehung setzen'}: {from?.humanId} → {to?.humanId}
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
          <b>{from?.humanId}</b> „{from?.title}“ → <b>{to?.humanId}</b> „{to?.title}“
          {existing && (
            <>
              <br />
              Bestehende Kante: <b>{EDGE_TYPE_LABEL[existing.edgeType]}</b>
            </>
          )}
        </p>
        {!existing && (
          <label className="field">
            <span>Beziehungstyp</span>
            <select value={edgeType} onChange={(e) => setEdgeType(e.target.value as EdgeType)}>
              {EDGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EDGE_TYPE_LABEL[t]} — {EDGE_HINT[t]}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="chip-row">
          {REASON_TEMPLATES.map((t) => (
            <button key={t} className="chip" onClick={() => setReason(t)}>
              {t}
            </button>
          ))}
        </div>
        <label className="field">
          <span>
            Begründung <span className="req">*</span>
          </span>
          <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && <div className="error-text">{error}</div>}
        <div className="actions">
          <button onClick={onClose}>Abbrechen</button>
          <button className={existing ? 'danger' : 'primary'} disabled={!reason.trim()} onClick={confirm}>
            {existing ? 'Kante entfernen' : 'Kante anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}
