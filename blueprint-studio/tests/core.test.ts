import { describe, expect, it } from 'vitest'
import type { Blueprint, BpNode, GraphState } from '../src/shared/types'
import { validate } from '../src/shared/validation'
import { computeCascade, applyCascade } from '../src/shared/cascade'
import { generateAttacks } from '../src/shared/attacks'
import { downstreamOf, findDependencyCycle, graphHash } from '../src/shared/graph'
import { demoBlueprint, newBlueprint, newNode, uid } from '../src/shared/factory'

function bpWith(builder: (bp: Blueprint) => void): Blueprint {
  const bp = newBlueprint('Test')
  builder(bp)
  return bp
}

function add(bp: Blueprint, type: BpNode['nodeType'], fields: Partial<BpNode> & { title: string }): BpNode {
  const n = newNode(bp, type, fields, { x: 0, y: 0 })
  bp.graph.nodes.push(n)
  return n
}

function edge(bp: Blueprint, from: BpNode, to: BpNode, edgeType: 'supports' | 'requires' | 'contradicts'): void {
  bp.graph.edges.push({ id: uid('e'), from: from.id, to: to.id, edgeType })
}

describe('validation compiler', () => {
  it('flags all mandatory blocks as missing in an empty blueprint', () => {
    const v = validate(newBlueprint('leer').graph)
    expect(v.errors.filter((e) => e.type === 'missing_required_block')).toHaveLength(8)
    expect(v.submittable).toBe(false)
  })

  it('demo blueprint is submittable (compiler green)', () => {
    const v = validate(demoBlueprint().graph)
    expect(v.errors).toEqual([])
    expect(v.submittable).toBe(true)
  })

  it('claim without type/status/scope/rationale produces blocking errors', () => {
    const bp = bpWith((b) => {
      add(b, 'CLAIM', { title: 'nackter Claim' })
    })
    const types = validate(bp.graph).errors.map((e) => e.type)
    expect(types).toContain('claim_missing_type_or_status')
    expect(types).toContain('claim_without_scope')
  })

  it('secure claim needs status rationale', () => {
    const bp = bpWith((b) => {
      const scope = add(b, 'SCOPE', { title: 'S', content: 'Deutschland 2020–2030, Sektor X.' })
      add(b, 'CLAIM', { title: 'C', claimType: 'E', claimStatus: 'S', scopeId: scope.id })
    })
    expect(validate(bp.graph).errors.map((e) => e.type)).toContain('claim_missing_status_rationale')
  })

  it('open attacks block, responded attacks do not', () => {
    const bp = demoBlueprint()
    const claim = bp.graph.nodes.find((n) => n.nodeType === 'CLAIM')!
    bp.graph.attacks.push({
      id: 'at1',
      source: 'ai',
      attackVector: 'weak_evidence',
      targetClaimId: claim.id,
      attackText: 'x',
      requiredResponse: 'any',
      responseState: 'open',
      createdAt: new Date().toISOString()
    })
    expect(validate(bp.graph).errors.map((e) => e.type)).toContain('unresolved_attack')
    bp.graph.attacks[0].responseState = 'responded'
    expect(validate(bp.graph).errors.map((e) => e.type)).not.toContain('unresolved_attack')
  })

  it('detects circular reasoning via supports', () => {
    const bp = bpWith((b) => {
      const s = add(b, 'SCOPE', { title: 'S', content: 'Scope ausreichend lang beschrieben.' })
      const c1 = add(b, 'CLAIM', { title: 'C1', claimType: 'L', claimStatus: 'W', statusRationale: 'r', scopeId: s.id })
      const c2 = add(b, 'CLAIM', { title: 'C2', claimType: 'L', claimStatus: 'W', statusRationale: 'r', scopeId: s.id })
      edge(b, c1, c2, 'supports')
      edge(b, c2, c1, 'supports')
    })
    expect(validate(bp.graph).errors.map((e) => e.type)).toContain('circular_dependency_detected')
  })

  it('two secure contradicting claims are a blocking error', () => {
    const bp = bpWith((b) => {
      const s = add(b, 'SCOPE', { title: 'S', content: 'Scope ausreichend lang beschrieben.' })
      const c1 = add(b, 'CLAIM', { title: 'C1', claimType: 'E', claimStatus: 'S', statusRationale: 'r', scopeId: s.id })
      const c2 = add(b, 'CLAIM', { title: 'C2', claimType: 'E', claimStatus: 'S', statusRationale: 'r', scopeId: s.id })
      edge(b, c1, c2, 'contradicts')
    })
    expect(validate(bp.graph).errors.map((e) => e.type)).toContain('contradiction_unresolved')
  })

  it('decision without supporting claim is a blocking error', () => {
    const bp = bpWith((b) => {
      add(b, 'DECISION', { title: 'Ergebnis ohne Basis' })
    })
    expect(validate(bp.graph).errors.map((e) => e.type)).toContain('decision_without_supporting_claims')
  })
})

describe('cascade (tremor system)', () => {
  function chain(): { graph: GraphState; a: BpNode; b: BpNode; c: BpNode } {
    const bp = newBlueprint('t')
    const s = add(bp, 'SCOPE', { title: 'S', content: 'scope scope scope scope' })
    const a = add(bp, 'CLAIM', { title: 'A', claimType: 'E', claimStatus: 'S', statusRationale: 'r', scopeId: s.id })
    const b = add(bp, 'CLAIM', { title: 'B', claimType: 'L', claimStatus: 'S', statusRationale: 'r', scopeId: s.id })
    const c = add(bp, 'CLAIM', { title: 'C', claimType: 'L', claimStatus: 'W', statusRationale: 'r', scopeId: s.id })
    edge(bp, a, b, 'supports') // b depends on a
    bp.graph.edges.push({ id: uid('e'), from: c.id, to: b.id, edgeType: 'requires' }) // c requires b ⇒ c depends on b
    return { graph: bp.graph, a, b, c }
  }

  it('computes transitive downstream dependents', () => {
    const { graph, a, b, c } = chain()
    const down = downstreamOf(graph, a.id)
    expect(down).toContain(b.id)
    expect(down).toContain(c.id)
  })

  it('downgrades statuses one level along the chain', () => {
    const { graph, a, b, c } = chain()
    const impacts = computeCascade(graph, a.id)
    const next = applyCascade(graph, impacts)
    const nb = next.nodes.find((n) => n.id === b.id)!
    const nc = next.nodes.find((n) => n.id === c.id)!
    expect(nb.claimStatus).toBe('W') // S → W
    expect(nc.claimStatus).toBe('U') // W → U
    expect(impacts.map((i) => i.nodeId)).not.toContain(a.id)
  })

  it('collapsed claims (X) are not further downgraded', () => {
    const { graph, a, c } = chain()
    const g2: GraphState = { ...graph, nodes: graph.nodes.map((n) => (n.id === c.id ? { ...n, claimStatus: 'X' as const } : n)) }
    const impacts = computeCascade(g2, a.id)
    expect(impacts.find((i) => i.nodeId === c.id)).toBeUndefined()
  })
})

describe('deterministic attack engine', () => {
  it('attacks a claim without scope with scope_drift', () => {
    const bp = bpWith((b) => {
      add(b, 'CLAIM', { title: 'X gilt', claimType: 'E', claimStatus: 'W', statusRationale: 'r' })
    })
    const claim = bp.graph.nodes[0]
    const drafts = generateAttacks(bp.graph, claim.id)
    expect(drafts.map((d) => d.attackVector)).toContain('scope_drift')
  })

  it('attacks universal quantifiers', () => {
    const bp = bpWith((b) => {
      const s = add(b, 'SCOPE', { title: 'DE 2020', content: 'Deutschland im Jahr 2020, Sektor Y.' })
      add(b, 'CLAIM', { title: 'Das gilt immer und überall', claimType: 'E', claimStatus: 'W', statusRationale: 'r', scopeId: s.id })
    })
    const claim = bp.graph.nodes[1]
    const drafts = generateAttacks(bp.graph, claim.id)
    expect(drafts.map((d) => d.attackVector)).toContain('scope_drift')
    expect(drafts[0].requiredResponse).toBe('refine')
  })

  it('attacks secure status without tests (status inflation)', () => {
    const bp = bpWith((b) => {
      const s = add(b, 'SCOPE', { title: 'S', content: 'Scope ausreichend beschrieben, wirklich.' })
      const a = add(b, 'ASSUMPTION', { title: 'A', assumptionJustification: 'j' })
      const c = add(b, 'CLAIM', { title: 'Zinsen beeinflussen Nachfrageverhalten', claimType: 'E', claimStatus: 'S', statusRationale: 'r', scopeId: s.id })
      edge(b, a, c, 'supports')
    })
    const claim = bp.graph.nodes.find((n) => n.nodeType === 'CLAIM')!
    const drafts = generateAttacks(bp.graph, claim.id)
    expect(drafts.map((d) => d.attackVector)).toContain('status_inflation')
  })

  it('is deterministic (same input ⇒ same attacks)', () => {
    const bp = demoBlueprint()
    const claim = bp.graph.nodes.find((n) => n.nodeType === 'CLAIM')!
    expect(generateAttacks(bp.graph, claim.id)).toEqual(generateAttacks(bp.graph, claim.id))
  })
})

describe('graph utilities', () => {
  it('finds no cycle in demo blueprint', () => {
    expect(findDependencyCycle(demoBlueprint().graph)).toBeNull()
  })

  it('hash is stable and ignores layout', () => {
    const bp = demoBlueprint()
    const h1 = graphHash(bp.graph)
    const moved: GraphState = { ...bp.graph, nodes: bp.graph.nodes.map((n) => ({ ...n, x: n.x + 100 })) }
    expect(graphHash(moved)).toBe(h1)
    const changed: GraphState = { ...bp.graph, nodes: bp.graph.nodes.map((n) => ({ ...n, title: n.title + '!' })) }
    expect(graphHash(changed)).not.toBe(h1)
  })
})
