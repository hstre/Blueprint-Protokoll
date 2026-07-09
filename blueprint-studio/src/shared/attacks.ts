import type { AttackVector, BpNode, GraphState, RequiredResponse } from './types'

export interface AttackDraft {
  attackVector: AttackVector
  targetClaimId: string
  attackText: string
  requiredResponse: RequiredResponse | 'any'
}

/**
 * Deterministic, offline adversarial engine.
 * It inspects the structure of a claim and produces the most relevant attacks —
 * rules for logic, LLM (optional, elsewhere) only for phrasing.
 */
export function generateAttacks(graph: GraphState, claimId: string): AttackDraft[] {
  const claim = graph.nodes.find((n) => n.id === claimId && n.nodeType === 'CLAIM')
  if (!claim) return []
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const drafts: AttackDraft[] = []
  const text = `${claim.title} ${claim.content}`.toLowerCase()

  const scope = claim.scopeId ? byId.get(claim.scopeId) : undefined
  const supports = graph.edges.filter((e) => e.to === claim.id && e.edgeType === 'supports')
  const requires = graph.edges.filter((e) => e.from === claim.id && e.edgeType === 'requires')
  const tests = graph.nodes.filter((n) => n.nodeType === 'TEST' && n.testTargetClaimId === claim.id)

  // 1. scope drift: universal quantifiers vs. bounded scope
  const universals = ['alle ', 'immer', 'nie ', 'niemals', 'jede ', 'jeder ', 'grundsätzlich', 'überall', 'garantiert']
  const hit = universals.find((u) => text.includes(u))
  if (hit) {
    drafts.push({
      attackVector: 'scope_drift',
      targetClaimId: claim.id,
      requiredResponse: 'refine',
      attackText:
        `Der Claim verwendet „${hit.trim()}“ und behauptet damit ein Weltgesetz, ` +
        (scope
          ? `obwohl der Scope „${scope.title}“ begrenzt ist. Gilt die Aussage wirklich im gesamten Scope — und nur dort?`
          : `hat aber gar keinen Scope. Wo genau soll die Aussage gelten (Zeit, Raum, Systemgrenze)?`)
    })
  } else if (!scope) {
    drafts.push({
      attackVector: 'scope_drift',
      targetClaimId: claim.id,
      requiredResponse: 'refine',
      attackText: `Der Claim hat keinen Scope. Ohne Geltungsbereich ist er formal ungültig: Für welchen Zeitraum, Raum und welche Systemgrenze soll er gelten?`
    })
  }

  // 2. weak evidence: nothing supports the claim
  if (supports.length === 0 && claim.claimType !== 'H') {
    drafts.push({
      attackVector: 'weak_evidence',
      targetClaimId: claim.id,
      requiredResponse: 'any',
      attackText: `Kein einziger Knoten stützt diesen Claim (keine supports-Kante). Worauf ruht er? Entferne ich ihn gedanklich, ändert sich nichts im Modell — dann ist er entweder nicht tragend oder unbegründet.`
    })
  }

  // 3. status inflation: "gesichert" without tests
  if (claim.claimStatus === 'S' && tests.length === 0) {
    drafts.push({
      attackVector: 'status_inflation',
      targetClaimId: claim.id,
      requiredResponse: 'any',
      attackText: `Status „gesichert“ ohne einen einzigen Testversuch. Minimalregel des Protokolls: Ein Claim darf nur gesichert heißen, wenn mindestens ein ernsthafter Gegenangriff nicht durchschlägt. Welcher Angriff wurde abgewehrt?`
    })
  }

  // 4. normative smuggle: normative vocabulary without criteria
  const normWords = ['gerecht', 'fair', 'gut ', 'schlecht', 'richtig', 'falsch', 'sollte', 'muss ', 'legitim', 'sicher', 'effizient', 'besser', 'sinnvoll']
  const normHit = normWords.find((w) => text.includes(w))
  if (normHit && claim.claimType !== 'N' && claim.claimType !== 'O') {
    drafts.push({
      attackVector: 'normative_smuggle',
      targetClaimId: claim.id,
      requiredResponse: 'refine',
      attackText: `Der Claim ist als ${claim.claimType ?? '?'} typisiert, enthält aber normatives/operatives Vokabular („${normHit.trim()}“). Kategorienfehler? Entweder umtypisieren oder das Kriterium explizit machen: ${normHit.trim()} — gemessen woran?`
    })
  }
  if ((claim.claimType === 'N' || claim.claimType === 'O') && !/kriteri|maßstab|prinzip|bedingung|criteria/i.test(text)) {
    drafts.push({
      attackVector: 'normative_smuggle',
      targetClaimId: claim.id,
      requiredResponse: 'refine',
      attackText: `Normative/operative Claims brauchen explizite Kriterien, sonst sind sie formal ungültig. „${claim.title}“ — nach welchem Prinzip, unter welchen Bedingungen, gemessen woran?`
    })
  }

  // 5. hidden assumption: claim uses no assumption at all
  const assumptionLinked = graph.edges.some(
    (e) =>
      (e.from === claim.id || e.to === claim.id) &&
      (byId.get(e.from)?.nodeType === 'ASSUMPTION' || byId.get(e.to)?.nodeType === 'ASSUMPTION')
  )
  if (!assumptionLinked && requires.length === 0) {
    drafts.push({
      attackVector: 'hidden_assumption',
      targetClaimId: claim.id,
      requiredResponse: 'any',
      attackText: `Dieser Claim hängt an keiner expliziten Annahme. Das ist verdächtig: Fast jede tragende Aussage setzt still etwas voraus (Datenqualität, Verhalten von Akteuren, Modellannahmen). Welche stille Prämisse fehlt hier?`
    })
  }

  // 6. untestable: vague wording
  const vague = ['wichtig', 'eigentlich', 'irgendwie', 'im grunde', 'relevant', 'bedeutsam']
  const vagueHit = vague.find((w) => text.includes(w))
  if (vagueHit) {
    drafts.push({
      attackVector: 'untestable',
      targetClaimId: claim.id,
      requiredResponse: 'refine',
      attackText: `„${vagueHit}“ macht den Claim unprüfbar — was müsste eintreten, damit er falsch ist? Wenn nichts ihn kippen kann, ist er kein Claim, sondern Rhetorik.`
    })
  }

  // 7. logical gap: L-claim without premises
  if (claim.claimType === 'L' && requires.length === 0 && supports.length === 0) {
    drafts.push({
      attackVector: 'logical_gap',
      targetClaimId: claim.id,
      requiredResponse: 'any',
      attackText: `Ein logischer Claim behauptet eine Folgerung — aber hier sind keine Prämissen verknüpft (requires/supports fehlen). Woraus genau folgt die Aussage?`
    })
  }

  // deterministic order, cap at 3 most relevant
  return drafts.slice(0, 3)
}

/** Generic counterexample prompt (used when the rules find nothing). */
export function fallbackAttack(claim: BpNode): AttackDraft {
  return {
    attackVector: 'weak_evidence',
    targetClaimId: claim.id,
    requiredResponse: 'any',
    attackText: `Stresstest für ${claim.humanId}: Nenne den stärksten realistischen Fall, in dem „${claim.title}“ nicht gilt. Wenn dir keiner einfällt — hast du ernsthaft gesucht, oder ist der Claim so weich formuliert, dass nichts ihn treffen kann?`
  }
}
