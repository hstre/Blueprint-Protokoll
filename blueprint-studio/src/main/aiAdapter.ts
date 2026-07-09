import type { AiSettings, AttackVector, BpNode, GraphState, RequiredResponse } from '@shared/types'
import type { AttackDraft } from '@shared/attacks'

/**
 * Optional LLM adversarial adapter (spec: "AI is Plugin, not Core").
 * Talks to any OpenAI-compatible chat completions endpoint the user configures.
 * The LLM only phrases attacks; the structured normalization and all gating stay in rules.
 * Returns null on any failure — callers fall back to the deterministic engine.
 */
export async function llmAttacks(
  settings: AiSettings,
  graph: GraphState,
  claim: BpNode
): Promise<AttackDraft[] | null> {
  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model) return null
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const scope = claim.scopeId ? byId.get(claim.scopeId) : undefined
  const neighbors = graph.edges
    .filter((e) => e.from === claim.id || e.to === claim.id)
    .map((e) => {
      const other = byId.get(e.from === claim.id ? e.to : e.from)
      return other ? `${e.edgeType}: ${other.humanId} „${other.title}“` : ''
    })
    .filter(Boolean)
    .join('\n')

  const system = `Du bist der Adversarial-Modus eines epistemischen Denkwerkzeugs (Blueprint Studio).
Du formulierst ANGRIFFE auf Claims — niemals Wahrheitsurteile, niemals Bestätigungen.
Antworte NUR mit einem JSON-Array von maximal 3 Objekten:
[{"attackVector": "scope_drift|hidden_assumption|weak_evidence|logical_gap|normative_smuggle|untestable",
  "attackText": "konkreter Angriff auf Deutsch, 1-3 Sätze, mit Gegenbeispiel wo möglich",
  "requiredResponse": "refine|defend|abandon|any"}]`
  const user = `Claim ${claim.humanId} [Typ ${claim.claimType ?? '?'}, Status ${claim.claimStatus ?? '?'}]:
„${claim.title}“
Inhalt: ${claim.content || '—'}
Statusbegründung: ${claim.statusRationale || '—'}
Scope: ${scope ? scope.title + ' — ' + scope.content : 'KEIN SCOPE'}
Verknüpfungen:\n${neighbors || '—'}`

  try {
    const base = settings.apiBaseUrl.replace(/\/+$/, '')
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content ?? ''
    const match = content.match(/\[[\s\S]*\]/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Array<{
      attackVector?: string
      attackText?: string
      requiredResponse?: string
    }>
    const vectors: AttackVector[] = ['scope_drift', 'hidden_assumption', 'weak_evidence', 'logical_gap', 'normative_smuggle', 'circularity', 'status_inflation', 'untestable']
    const responses: Array<RequiredResponse | 'any'> = ['refine', 'defend', 'abandon', 'any']
    const drafts: AttackDraft[] = []
    for (const p of parsed.slice(0, 3)) {
      if (!p.attackText?.trim()) continue
      drafts.push({
        targetClaimId: claim.id,
        attackVector: vectors.includes(p.attackVector as AttackVector) ? (p.attackVector as AttackVector) : 'weak_evidence',
        attackText: p.attackText.trim().slice(0, 2000),
        requiredResponse: responses.includes(p.requiredResponse as RequiredResponse) ? (p.requiredResponse as RequiredResponse | 'any') : 'any'
      })
    }
    return drafts.length ? drafts : null
  } catch {
    return null
  }
}
