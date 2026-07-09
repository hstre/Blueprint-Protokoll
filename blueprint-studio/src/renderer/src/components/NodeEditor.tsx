import { useMemo, useState } from 'react'
import type { BpNode, ClaimStatus, ClaimType, NodeType } from '@shared/types'
import { useStudio } from '../store'
import { CLAIM_STATUS_LABEL, CLAIM_TYPE_LABEL, NODE_TYPE_LABEL, REASON_TEMPLATES } from '../labels'

type Props =
  | { mode: 'create'; nodeType: NodeType; onClose: () => void }
  | { mode: 'edit'; nodeId: string; onClose: () => void }

const CONTENT_HINT: Partial<Record<NodeType, string>> = {
  QUESTION: 'Präzise Leitfrage + erwartetes Ergebnisformat + Abbruchkriterium.',
  GOAL: 'Was soll am Ende vorliegen? Wann ist die Frage beantwortet?',
  SCOPE: 'Geltungsbereich: Zeit, Raum, Systemgrenze. Explizite Nicht-Ziele („Nicht im Scope: …“).',
  ASSUMPTION: 'Was wird vorausgesetzt, ohne bewiesen zu sein?',
  TERM: 'Arbeitsdefinition (kein Wikipedia-Zitat). Ggf. Abgrenzung: „X ≠ Y“.',
  CLAIM: 'Die tragende Aussage. Vage Formulierungen („wichtig“, „eigentlich“) machen sie unprüfbar.',
  TEST: 'Gegenbeispiel / Randfall / Stresstest. Entscheidungskriterium: „Wenn X eintritt, kippt der Claim.“',
  DECISION: 'Ergebnis unter Bedingungen: „Unter diesen Annahmen, in diesem Scope, ist … vertretbar.“ Kritischste Annahme benennen.',
  NOTE: 'Freies Material — zählt nicht als Struktur.'
}

export function NodeEditor(props: Props): React.JSX.Element {
  const { blueprint, addNode, updateNode, deleteNode } = useStudio()
  const bp = blueprint!
  const existing: BpNode | undefined = props.mode === 'edit' ? bp.graph.nodes.find((n) => n.id === props.nodeId) : undefined
  const nodeType: NodeType = props.mode === 'create' ? props.nodeType : existing!.nodeType

  const [title, setTitle] = useState(existing?.title ?? '')
  const [content, setContent] = useState(existing?.content ?? '')
  const [claimType, setClaimType] = useState<ClaimType | ''>(existing?.claimType ?? '')
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | ''>(existing?.claimStatus ?? '')
  const [statusRationale, setStatusRationale] = useState(existing?.statusRationale ?? '')
  const [scopeId, setScopeId] = useState(existing?.scopeId ?? '')
  const [assumptionJustification, setAssumptionJustification] = useState(existing?.assumptionJustification ?? '')
  const [testTarget, setTestTarget] = useState(existing?.testTargetClaimId ?? '')
  const [testOutcome, setTestOutcome] = useState(existing?.testOutcome ?? 'open')
  const [reason, setReason] = useState(props.mode === 'create' ? `${NODE_TYPE_LABEL[nodeType]} angelegt` : '')
  const [error, setError] = useState('')

  const scopes = useMemo(() => bp.graph.nodes.filter((n) => n.nodeType === 'SCOPE'), [bp.graph.nodes])
  const claims = useMemo(() => bp.graph.nodes.filter((n) => n.nodeType === 'CLAIM'), [bp.graph.nodes])

  const isClaim = nodeType === 'CLAIM'
  const needsScope = isClaim || nodeType === 'DECISION'

  const formValid =
    title.trim() &&
    reason.trim() &&
    (!isClaim || (claimType && claimStatus && (claimStatus === 'X' || statusRationale.trim()))) &&
    (nodeType !== 'ASSUMPTION' || assumptionJustification.trim())

  const save = (): void => {
    const fields: Partial<BpNode> & { title: string } = { title: title.trim(), content }
    if (isClaim) {
      fields.claimType = claimType as ClaimType
      fields.claimStatus = claimStatus as ClaimStatus
      fields.statusRationale = statusRationale
    }
    if (needsScope) fields.scopeId = scopeId || undefined
    if (nodeType === 'ASSUMPTION') fields.assumptionJustification = assumptionJustification
    if (nodeType === 'TEST') {
      fields.testTargetClaimId = testTarget || undefined
      fields.testOutcome = testOutcome as BpNode['testOutcome']
    }
    if (props.mode === 'create') {
      addNode(nodeType, fields, reason)
    } else {
      updateNode(props.nodeId, fields, reason)
    }
    props.onClose()
  }

  const remove = (): void => {
    if (!existing) return
    const res = deleteNode(existing.id, reason || 'Knoten entfernt')
    if (res.blocked) setError(res.blocked)
    else props.onClose()
  }

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          {props.mode === 'create' ? `${NODE_TYPE_LABEL[nodeType]} anlegen` : `${existing?.humanId} bearbeiten`}
          <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: 13 }}> · {NODE_TYPE_LABEL[nodeType]}</span>
        </h2>

        <label className="field">
          <span>
            Titel / Kurzform <span className="req">*</span>
          </span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>Inhalt — {CONTENT_HINT[nodeType]}</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} />
        </label>

        {isClaim && (
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="field" style={{ flex: 1 }}>
                <span>
                  Claim-Typ <span className="req">*</span>
                </span>
                <select value={claimType} onChange={(e) => setClaimType(e.target.value as ClaimType)}>
                  <option value="">— wählen —</option>
                  {(Object.keys(CLAIM_TYPE_LABEL) as ClaimType[]).map((t) => (
                    <option key={t} value={t}>
                      {t} — {CLAIM_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>
                  Status <span className="req">*</span>
                </span>
                <select value={claimStatus} onChange={(e) => setClaimStatus(e.target.value as ClaimStatus)}>
                  <option value="">— wählen —</option>
                  {(Object.keys(CLAIM_STATUS_LABEL) as ClaimStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {s} — {CLAIM_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {claimStatus !== 'X' && (
              <label className="field">
                <span>
                  Status-Begründung <span className="req">*</span> — warum genau dieser Sicherheitsgrad?
                </span>
                <textarea value={statusRationale} onChange={(e) => setStatusRationale(e.target.value)} />
              </label>
            )}
          </>
        )}

        {needsScope && (
          <label className="field">
            <span>Scope {isClaim && <span className="req">*</span>} (ohne Scope ist ein Claim formal ungültig)</span>
            <select value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
              <option value="">— kein Scope —</option>
              {scopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.humanId} — {s.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {nodeType === 'ASSUMPTION' && (
          <label className="field">
            <span>
              Begründung der Annahme <span className="req">*</span> — warum darf man das voraussetzen?
            </span>
            <textarea value={assumptionJustification} onChange={(e) => setAssumptionJustification(e.target.value)} />
          </label>
        )}

        {nodeType === 'TEST' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <label className="field" style={{ flex: 2 }}>
              <span>Ziel-Claim</span>
              <select value={testTarget} onChange={(e) => setTestTarget(e.target.value)}>
                <option value="">— wählen —</option>
                {claims.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.humanId} — {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>Ausgang</span>
              <select value={testOutcome} onChange={(e) => setTestOutcome(e.target.value as BpNode['testOutcome'] & string)}>
                <option value="open">offen</option>
                <option value="passes">besteht</option>
                <option value="fails">scheitert</option>
                <option value="inconclusive">unklar</option>
              </select>
            </label>
          </div>
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
            Änderungsbegründung <span className="req">*</span> (Δ-Log)
          </span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        {props.mode === 'edit' && existing?.nodeType === 'CLAIM' && (
          <p style={{ fontSize: 11.5, color: 'var(--orange)' }}>
            ⚠ Substanzielle Änderungen lösen das Kaskadensystem aus: abhängige Claims werden automatisch herabgestuft.
          </p>
        )}
        {error && <div className="error-text">{error}</div>}

        <div className="actions">
          {props.mode === 'edit' && (
            <button className="danger" style={{ marginRight: 'auto' }} onClick={remove} title="Nur möglich, wenn keine Kanten anliegen">
              Löschen
            </button>
          )}
          <button onClick={props.onClose}>Abbrechen</button>
          <button className="primary" disabled={!formValid} onClick={save}>
            {props.mode === 'create' ? 'Anlegen' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
