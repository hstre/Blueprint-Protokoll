import { useMemo, useState } from 'react'
import type { AttackState, AttackVector } from '@shared/types'
import { useStudio, type AiMode } from '../store'
import { ATTACK_VECTOR_LABEL } from '../labels'
import type { EditorDialogs } from './Editor'
import { isElectron } from '../api'

const MODE_LABEL: Record<AiMode, string> = {
  exploration: 'Exploration',
  precision: 'Präzision',
  adversarial: 'Adversarial'
}

export function AiPanel({ dialogs }: { dialogs: EditorDialogs }): React.JSX.Element {
  const { aiMode, setAiMode } = useStudio()
  return (
    <div>
      <h3 className="panel-title">KI-Panel — Modus (exklusiv)</h3>
      <div className="mode-switch">
        {(Object.keys(MODE_LABEL) as AiMode[]).map((m) => (
          <button key={m} className={aiMode === m ? 'active' : ''} onClick={() => setAiMode(m)}>
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      {aiMode === 'exploration' && <ExplorationView />}
      {aiMode === 'precision' && <PrecisionView />}
      {aiMode === 'adversarial' && <AdversarialView dialogs={dialogs} />}
    </div>
  )
}

/* ---------- Exploration: material, never claims ---------- */

function ExplorationView(): React.JSX.Element {
  const { blueprint, addNode } = useStudio()
  const bp = blueprint!

  const suggestions = useMemo(() => {
    const out: Array<{ title: string; text: string }> = []
    const claims = bp.graph.nodes.filter((n) => n.nodeType === 'CLAIM' && n.claimStatus !== 'X')
    const tests = bp.graph.nodes.filter((n) => n.nodeType === 'TEST')
    const hasContra = bp.graph.edges.some((e) => e.edgeType === 'contradicts')
    for (const c of claims.slice(0, 4)) {
      if (!tests.some((t) => t.testTargetClaimId === c.id)) {
        out.push({
          title: `Gegenhypothese zu ${c.humanId}`,
          text: `Formuliere die stärkste alternative Erklärung zu „${c.title}“. Was würde ein kluger Gegner behaupten — und welche Daten bräuchte er?`
        })
      }
    }
    if (!hasContra && claims.length >= 2) {
      out.push({
        title: 'Kein Widerspruch im Modell',
        text: 'Alle Claims vertragen sich — ist das Modell zu harmonisch? Suche zwei Aussagen, die in Randfällen kollidieren könnten.'
      })
    }
    if (bp.graph.nodes.filter((n) => n.nodeType === 'ASSUMPTION').length < 2) {
      out.push({
        title: 'Stille Prämissen',
        text: 'Weniger als zwei explizite Annahmen: Welche Daten-, Verhaltens- oder Institutionenannahme steckt still im Modell?'
      })
    }
    const scopes = bp.graph.nodes.filter((n) => n.nodeType === 'SCOPE')
    if (scopes.length === 1) {
      out.push({
        title: 'Scope-Variante',
        text: `Wie ändert sich das Ergebnis, wenn der Scope „${scopes[0].title}“ enger (Teilbereich) oder breiter (Nachbarbereich) gezogen wird?`
      })
    }
    if (out.length === 0) {
      out.push({
        title: 'Analogie suchen',
        text: 'In welchem ganz anderen Feld gibt es ein strukturell ähnliches Problem — und was wurde dort übersehen?'
      })
    }
    return out
  }, [bp.graph])

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
        Explorationsmodus öffnet den Möglichkeitsraum. Vorschläge sind <b>Material, keine Claims</b> — Übernahme erzeugt
        eine Notiz, nie einen gesicherten Knoten.
      </p>
      {suggestions.map((s, i) => (
        <div key={i} className="suggestion-card">
          <b>{s.title}</b>
          <div style={{ margin: '4px 0 8px' }}>{s.text}</div>
          <button
            style={{ fontSize: 11.5, padding: '3px 9px' }}
            onClick={() =>
              addNode('NOTE', { title: s.title, content: s.text, aiSuggested: true }, 'Explorationsvorschlag als Material übernommen.', 'ai_suggested')
            }
          >
            Als Notiz übernehmen
          </button>
        </div>
      ))}
    </div>
  )
}

/* ---------- Precision: structure check ---------- */

function PrecisionView(): React.JSX.Element {
  const { validation, select } = useStudio()
  const issues = [...(validation?.errors ?? []), ...(validation?.warnings ?? [])]
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
        Präzisionsmodus prüft Struktur, nicht Wahrheit: Begriffe, Scopes, Lücken, Zirkularität. Der Compiler unten
        blockiert; diese Liste erklärt.
      </p>
      {issues.length === 0 && <div className="empty-hint">Keine Auffälligkeiten. Struktur ist formal sauber.</div>}
      {issues.map((iss, i) => (
        <div
          key={i}
          className="suggestion-card"
          style={{ borderColor: iss.severity === 'error' ? 'var(--red)' : 'var(--yellow)', cursor: iss.nodeIds.length ? 'pointer' : 'default' }}
          onClick={() => iss.nodeIds[0] && select(iss.nodeIds[0])}
        >
          <b style={{ color: iss.severity === 'error' ? 'var(--red)' : 'var(--yellow)' }}>
            {iss.severity === 'error' ? 'Fehler' : 'Warnung'}
          </b>{' '}
          {iss.message}
        </div>
      ))}
    </div>
  )
}

/* ---------- Adversarial: attacks with mandatory response ---------- */

function AdversarialView({ dialogs }: { dialogs: EditorDialogs }): React.JSX.Element {
  const { blueprint, selectedNodeId, startAiAttack, addPeerAttack, respondToAttack, select } = useStudio()
  const bp = blueprint!
  const claims = bp.graph.nodes.filter((n) => n.nodeType === 'CLAIM' && n.claimStatus !== 'X')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [peerOpen, setPeerOpen] = useState(false)

  const effectiveTarget =
    target || (selectedNodeId && claims.some((c) => c.id === selectedNodeId) ? selectedNodeId : '')

  const attacks = [...bp.graph.attacks].sort((a, b) =>
    a.responseState === b.responseState ? b.createdAt.localeCompare(a.createdAt) : a.responseState === 'open' ? -1 : 1
  )

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
        Die KI ist hier Gegner. Jeder Angriff <b>muss</b> beantwortet werden — offene Angriffe blockieren die
        Einreichung. {isElectron ? '' : '(Browser-Modus: nur deterministische Engine.)'}
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <select value={effectiveTarget} onChange={(e) => setTarget(e.target.value)}>
          <option value="">— Claim wählen —</option>
          {claims.map((c) => (
            <option key={c.id} value={c.id}>
              {c.humanId} — {c.title}
            </option>
          ))}
        </select>
        <button
          className="primary"
          disabled={!effectiveTarget || busy}
          onClick={() => {
            setBusy(true)
            void startAiAttack(effectiveTarget).finally(() => setBusy(false))
          }}
        >
          {busy ? '…' : '⚔ Angriff'}
        </button>
      </div>
      <button style={{ fontSize: 11.5, marginBottom: 10 }} onClick={() => setPeerOpen(!peerOpen)}>
        {peerOpen ? '− Peer-Angriff' : '+ Peer-Angriff erfassen'}
      </button>
      {peerOpen && <PeerAttackForm claims={claims} onDone={() => setPeerOpen(false)} addPeerAttack={addPeerAttack} />}

      {attacks.length === 0 && <div className="empty-hint">Noch keine Angriffe. Ein Modell, das nie angegriffen wurde, ist nur eine Erzählung.</div>}
      {attacks.map((a) => (
        <AttackCard key={a.id} attack={a} dialogs={dialogs} respond={respondToAttack} selectNode={select} />
      ))}
    </div>
  )
}

function PeerAttackForm({
  claims,
  onDone,
  addPeerAttack
}: {
  claims: Array<{ id: string; humanId: string; title: string }>
  onDone: () => void
  addPeerAttack: (draft: import('@shared/attacks').AttackDraft, reason: string) => unknown
}): React.JSX.Element {
  const [target, setTarget] = useState('')
  const [vector, setVector] = useState<AttackVector>('weak_evidence')
  const [text, setText] = useState('')
  return (
    <div className="suggestion-card" style={{ borderStyle: 'solid' }}>
      <label className="field">
        <span>Ziel-Claim</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">— wählen —</option>
          {claims.map((c) => (
            <option key={c.id} value={c.id}>
              {c.humanId} — {c.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Angriffsvektor</span>
        <select value={vector} onChange={(e) => setVector(e.target.value as AttackVector)}>
          {(Object.keys(ATTACK_VECTOR_LABEL) as AttackVector[]).map((v) => (
            <option key={v} value={v}>
              {ATTACK_VECTOR_LABEL[v]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Angriffstext (Gegenbeispiel, Einwand …)</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <button
        className="primary"
        disabled={!target || !text.trim()}
        onClick={() => {
          addPeerAttack({ targetClaimId: target, attackVector: vector, attackText: text.trim(), requiredResponse: 'any' }, 'Peer-Angriff erfasst.')
          onDone()
        }}
      >
        Angriff erfassen
      </button>
    </div>
  )
}

function AttackCard({
  attack,
  dialogs,
  respond,
  selectNode
}: {
  attack: AttackState
  dialogs: EditorDialogs
  respond: (id: string, action: 'refine' | 'defend' | 'abandon', text: string) => { error?: string }
  selectNode: (id: string) => void
}): React.JSX.Element {
  const bp = useStudio((s) => s.blueprint)!
  const target = bp.graph.nodes.find((n) => n.id === attack.targetClaimId)
  const [action, setAction] = useState<'refine' | 'defend' | 'abandon' | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const doRespond = (): void => {
    if (!action) return
    const res = respond(attack.id, action, text.trim())
    if (res.error) setError(res.error)
    else {
      setAction(null)
      setText('')
      setError('')
    }
  }

  const allowed = (a: 'refine' | 'defend' | 'abandon'): boolean =>
    attack.requiredResponse === 'any' || attack.requiredResponse === a

  return (
    <div className={`attack-card ${attack.responseState}`}>
      <div className="meta">
        <span>{attack.source === 'ai' ? '🤖 KI' : '👤 Peer'}</span>
        <span>{ATTACK_VECTOR_LABEL[attack.attackVector]}</span>
        <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => target && selectNode(target.id)}>
          → {target?.humanId ?? '?'}
        </span>
        {attack.requiredResponse !== 'any' && <span>verlangt: {attack.requiredResponse}</span>}
      </div>
      <div>{attack.attackText}</div>

      {attack.responseState === 'open' ? (
        <>
          <div className="actions">
            <button
              disabled={!allowed('refine')}
              onClick={() => {
                setAction('refine')
                if (target) dialogs.editNode(target.id)
              }}
              title="Claim präzisieren (öffnet Editor)"
            >
              Präzisieren
            </button>
            <button disabled={!allowed('defend')} onClick={() => setAction('defend')}>
              Verteidigen
            </button>
            <button className="danger" disabled={!allowed('abandon')} onClick={() => setAction('abandon')}>
              Aufgeben
            </button>
          </div>
          {action && (
            <div style={{ marginTop: 8 }}>
              <textarea
                autoFocus
                placeholder={
                  action === 'refine'
                    ? 'Was wurde präzisiert? (nach der Änderung im Editor)'
                    : action === 'defend'
                      ? 'Verteidigung: warum hält der Claim dem Angriff stand?'
                      : 'Warum wird der Claim aufgegeben? (Status → verworfen, Kaskade läuft)'
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {error && <div className="error-text">{error}</div>}
              <div className="actions">
                <button onClick={() => setAction(null)}>Abbrechen</button>
                <button className="primary" disabled={!text.trim()} onClick={doRespond}>
                  Antwort festhalten
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)' }}>
          <b style={{ color: 'var(--green)' }}>
            {attack.responseAction === 'refine' ? 'präzisiert' : attack.responseAction === 'defend' ? 'verteidigt' : 'aufgegeben'}
          </b>
          {attack.responseText && <> — {attack.responseText}</>}
        </div>
      )}
    </div>
  )
}
