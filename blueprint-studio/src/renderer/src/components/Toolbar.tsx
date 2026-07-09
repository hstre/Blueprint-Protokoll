import { useState } from 'react'
import { useStudio } from '../store'
import { api } from '../api'
import { BP_STATUS_LABEL } from '../labels'
import type { EditorDialogs } from './Editor'
import { PromptDialog } from './PromptDialog'

export function Toolbar({ dialogs }: { dialogs: EditorDialogs }): React.JSX.Element {
  const { blueprint, validation, closeBlueprint, commitSnapshot, changeStatus } = useStudio()
  const bp = blueprint!
  const [commitOpen, setCommitOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState<null | 'in_review' | 'validated' | 'certified'>(null)
  const [msg, setMsg] = useState('')

  const flash = (m: string): void => {
    setMsg(m)
    setTimeout(() => setMsg(''), 4000)
  }

  const nextStatus = bp.status === 'draft' ? 'in_review' : bp.status === 'in_review' ? 'validated' : bp.status === 'validated' ? 'certified' : null
  const nextStatusLabel =
    nextStatus === 'in_review' ? 'Einreichen' : nextStatus === 'validated' ? 'Validieren' : nextStatus === 'certified' ? 'Zertifizieren' : null
  const gateOpen = validation?.submittable ?? false

  return (
    <div className="toolbar">
      <button className="ghost" title="Zur Übersicht" onClick={closeBlueprint}>
        ←
      </button>
      <span className="title">{bp.title}</span>
      <span className={`status-chip ${bp.status}`}>{BP_STATUS_LABEL[bp.status]}</span>
      <span className="spacer" />
      {msg && <span style={{ color: 'var(--yellow)', fontSize: 12.5 }}>{msg}</span>}
      <button onClick={() => dialogs.snapshots()}>
        Snapshots ({bp.snapshots.length})
      </button>
      <button onClick={() => setCommitOpen(true)}>Commit</button>
      <button onClick={() => void api.exportJson(bp).then((p) => p && flash(`JSON exportiert: ${p}`))}>JSON</button>
      <button onClick={() => void api.exportPdf(bp).then((p) => p && flash(`PDF exportiert: ${p}`))}>PDF</button>
      {nextStatus && nextStatusLabel && (
        <button
          className="primary"
          disabled={!gateOpen}
          title={gateOpen ? `Status → ${BP_STATUS_LABEL[nextStatus]}` : 'Gate geschlossen: Compiler nicht grün.'}
          onClick={() => setStatusOpen(nextStatus)}
        >
          {nextStatusLabel} {gateOpen ? '' : '🔒'}
        </button>
      )}

      {commitOpen && (
        <PromptDialog
          title="Snapshot committen"
          description="Ein Snapshot friert den aktuellen Stand unveränderlich ein (R-01, R-02 …). Wozu dient diese Revision?"
          confirmLabel="Snapshot anlegen"
          withTemplates
          onConfirm={(reason) => {
            const snap = commitSnapshot(reason)
            setCommitOpen(false)
            if (snap) flash(`Snapshot ${snap.label} angelegt (Hash ${snap.hash}).`)
          }}
          onClose={() => setCommitOpen(false)}
        />
      )}
      {statusOpen && (
        <PromptDialog
          title={`Status ändern: ${BP_STATUS_LABEL[bp.status]} → ${BP_STATUS_LABEL[statusOpen]}`}
          description={
            statusOpen === 'in_review'
              ? 'Einreichen ist nur mit grünem Compiler und ohne offene Angriffe möglich. Es wird automatisch ein Snapshot angelegt.'
              : statusOpen === 'validated'
                ? 'Validiert = formal sauber (Compiler grün). Begründe die Freigabe.'
                : 'Zertifiziert = inhaltlich geprüft und verantwortet. Wer zeichnet?'
          }
          confirmLabel={BP_STATUS_LABEL[statusOpen]}
          onConfirm={(reason) => {
            const res = changeStatus(statusOpen, reason)
            setStatusOpen(null)
            if (res.error) flash(res.error)
          }}
          onClose={() => setStatusOpen(null)}
        />
      )}
    </div>
  )
}
