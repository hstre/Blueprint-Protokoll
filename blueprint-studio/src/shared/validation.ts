import {
  BLOCK_NODE_TYPES,
  MANDATORY_BLOCKS,
  type BlockId,
  type BpNode,
  type GraphState,
  type ValidationIssue,
  type ValidationResult
} from './types'
import { findDependencyCycle } from './graph'

/**
 * The compiler. Deterministic, rule-based — no LLM involvement (spec: "Validation is Compiler").
 * Blocking errors gate submit/export; warnings inform.
 */
export function validate(graph: GraphState): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const claims = graph.nodes.filter((n) => n.nodeType === 'CLAIM')
  const label = (n: BpNode): string => `${n.humanId} „${truncate(n.title)}“`

  // 1. mandatory blocks
  const blockStatus = {} as ValidationResult['blockStatus']
  for (const block of MANDATORY_BLOCKS) {
    const nodes = graph.nodes.filter((n) => BLOCK_NODE_TYPES[block].includes(n.nodeType))
    if (nodes.length === 0) {
      blockStatus[block] = 'missing'
      errors.push({
        type: 'missing_required_block',
        severity: 'error',
        message: `Pflichtblock fehlt: ${blockName(block)}`,
        nodeIds: [],
        blockId: block
      })
    } else {
      blockStatus[block] = 'valid'
    }
  }

  // 2. claim discipline
  for (const c of claims) {
    if (!c.claimType || !c.claimStatus) {
      errors.push({
        type: 'claim_missing_type_or_status',
        severity: 'error',
        message: `Claim ${label(c)} hat keinen Typ oder Status.`,
        nodeIds: [c.id],
        blockId: 'CLAIMS'
      })
    }
    if (c.claimStatus && c.claimStatus !== 'X' && !c.statusRationale?.trim()) {
      errors.push({
        type: 'claim_missing_status_rationale',
        severity: 'error',
        message: `Claim ${label(c)}: Status ohne Begründung ist ungültig.`,
        nodeIds: [c.id],
        blockId: 'CLAIMS'
      })
    }
    if (!c.scopeId || !byId.has(c.scopeId)) {
      errors.push({
        type: 'claim_without_scope',
        severity: 'error',
        message: `Claim ${label(c)} hat keinen Scope.`,
        nodeIds: [c.id],
        blockId: 'CLAIMS'
      })
    }
  }

  // 3. assumptions need justification
  for (const a of graph.nodes.filter((n) => n.nodeType === 'ASSUMPTION')) {
    if (!a.assumptionJustification?.trim()) {
      errors.push({
        type: 'assumption_without_justification',
        severity: 'error',
        message: `Annahme ${label(a)} ohne Begründung ist unzulässig.`,
        nodeIds: [a.id],
        blockId: 'ASSUMPTIONS'
      })
    }
  }

  // 4. open attacks block
  const openAttacks = graph.attacks.filter((at) => at.responseState === 'open')
  for (const at of openAttacks) {
    const target = byId.get(at.targetClaimId)
    errors.push({
      type: 'unresolved_attack',
      severity: 'error',
      message: `Unbeantworteter Angriff auf ${target ? target.humanId : '?'} (${at.attackVector}).`,
      nodeIds: target ? [target.id] : [],
      blockId: 'CLAIMS'
    })
  }

  // 5. circular reasoning
  const cycle = findDependencyCycle(graph)
  if (cycle) {
    const names = cycle.map((id) => byId.get(id)?.humanId ?? '?').join(' → ')
    errors.push({
      type: 'circular_dependency_detected',
      severity: 'error',
      message: `Zirkelschluss erkannt: ${names}.`,
      nodeIds: cycle,
      blockId: 'CLAIMS'
    })
  }

  // 6. decision must rest on claims
  const decisions = graph.nodes.filter((n) => n.nodeType === 'DECISION')
  for (const d of decisions) {
    const support = graph.edges.some(
      (e) =>
        (e.edgeType === 'supports' && e.to === d.id && byId.get(e.from)?.nodeType === 'CLAIM') ||
        (e.edgeType === 'requires' && e.from === d.id && byId.get(e.to)?.nodeType === 'CLAIM')
    )
    if (!support) {
      errors.push({
        type: 'decision_without_supporting_claims',
        severity: 'error',
        message: `Ergebnis ${label(d)} wird von keinem Claim gestützt (supports-Kante fehlt).`,
        nodeIds: [d.id],
        blockId: 'SYNTHESIS'
      })
    }
  }

  // 7. unresolved contradictions between non-collapsed claims
  for (const e of graph.edges.filter((e) => e.edgeType === 'contradicts')) {
    const a = byId.get(e.from)
    const b = byId.get(e.to)
    if (a?.nodeType === 'CLAIM' && b?.nodeType === 'CLAIM' && a.claimStatus !== 'X' && b.claimStatus !== 'X') {
      if (a.claimStatus === 'S' && b.claimStatus === 'S') {
        errors.push({
          type: 'contradiction_unresolved',
          severity: 'error',
          message: `${a.humanId} und ${b.humanId} widersprechen sich, sind aber beide „gesichert“.`,
          nodeIds: [a.id, b.id],
          blockId: 'CLAIMS'
        })
      }
    }
  }

  /* ---- warnings ---- */

  const usedAsScope = new Set(claims.map((c) => c.scopeId).filter(Boolean))
  for (const a of graph.nodes.filter((n) => n.nodeType === 'ASSUMPTION')) {
    const used = graph.edges.some((e) => e.from === a.id || e.to === a.id)
    if (!used) {
      warnings.push({
        type: 'unused_assumption',
        severity: 'warning',
        message: `Annahme ${label(a)} wird von keinem Claim referenziert.`,
        nodeIds: [a.id]
      })
    }
  }

  const tests = graph.nodes.filter((n) => n.nodeType === 'TEST')
  for (const c of claims) {
    if (c.claimStatus === 'X') continue
    const hasTest =
      tests.some((t) => t.testTargetClaimId === c.id) ||
      graph.edges.some((e) => e.to === c.id && byId.get(e.from)?.nodeType === 'TEST')
    if (!hasTest) {
      warnings.push({
        type: 'claim_without_test',
        severity: 'warning',
        message: `Claim ${label(c)} hat keinen Test/Gegenbeispielversuch.`,
        nodeIds: [c.id]
      })
    }
  }

  for (const c of claims) {
    if (c.claimStatus !== 'S') continue
    const attacked = graph.attacks.some((at) => at.targetClaimId === c.id)
    if (!attacked) {
      warnings.push({
        type: 'secure_claim_never_attacked',
        severity: 'warning',
        message: `${label(c)} ist „gesichert“, wurde aber nie angegriffen. Gesichert braucht Angriffs-Resistenz.`,
        nodeIds: [c.id]
      })
    }
  }

  for (const t of graph.nodes.filter((n) => n.nodeType === 'TERM')) {
    const used = graph.edges.some((e) => e.from === t.id || e.to === t.id)
    if (!used) {
      warnings.push({
        type: 'term_unused',
        severity: 'warning',
        message: `Begriff ${label(t)} ist definiert, aber nicht verknüpft.`,
        nodeIds: [t.id]
      })
    }
  }

  for (const s of graph.nodes.filter((n) => n.nodeType === 'SCOPE')) {
    if (usedAsScope.has(s.id) && s.content.trim().length < 20) {
      warnings.push({
        type: 'scope_too_broad',
        severity: 'warning',
        message: `Scope ${label(s)} ist kaum spezifiziert — Schein-Scope? (Zeit, Raum, Systemgrenze angeben)`,
        nodeIds: [s.id]
      })
    }
  }

  // mark blocks invalid if they have errors
  for (const err of errors) {
    if (err.blockId && blockStatus[err.blockId] === 'valid') blockStatus[err.blockId] = 'invalid'
  }

  return { errors, warnings, blockStatus, submittable: errors.length === 0 }
}

export function blockName(block: BlockId): string {
  const names: Record<BlockId, string> = {
    QUESTION: 'Leitfrage',
    GOAL: 'Zieldefinition',
    SCOPE: 'Scope',
    ASSUMPTIONS: 'Annahmen',
    TERMS: 'Begriffe',
    CLAIMS: 'Claim-Netz',
    TESTS: 'Tests / Gegenbeispiele',
    SYNTHESIS: 'Synthese / Ergebnis'
  }
  return names[block]
}

function truncate(s: string, n = 32): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
