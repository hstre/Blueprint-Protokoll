import { create } from 'zustand'
import type {
  Actor,
  AttackState,
  Blueprint,
  BlueprintStatus,
  BpEdge,
  BpNode,
  ChangeType,
  DeltaLogEntry,
  EdgeType,
  GraphState,
  NodeType,
  Snapshot,
  ValidationResult
} from '@shared/types'
import { validate } from '@shared/validation'
import { computeCascade, applyCascade, type CascadeImpact } from '@shared/cascade'
import { generateAttacks, fallbackAttack, type AttackDraft } from '@shared/attacks'
import { graphHash } from '@shared/graph'
import { newNode, uid, demoBlueprint, newBlueprint } from '@shared/factory'
import { api } from './api'

export type AiMode = 'exploration' | 'precision' | 'adversarial'

interface StudioState {
  blueprint: Blueprint | null
  validation: ValidationResult | null
  aiMode: AiMode
  selectedNodeId: string | null
  /** transient UI highlight after a cascade */
  cascadeHighlight: string[]
  dirty: boolean

  openBlueprint(id: string): Promise<void>
  createBlueprint(title: string, description: string): Promise<Blueprint>
  createDemo(): Promise<Blueprint>
  closeBlueprint(): void
  setAiMode(mode: AiMode): void
  select(nodeId: string | null): void

  addNode(nodeType: NodeType, fields: Partial<BpNode> & { title: string }, reason: string, actor?: Actor): BpNode | null
  updateNode(nodeId: string, fields: Partial<BpNode>, reason: string): CascadeImpact[]
  deleteNode(nodeId: string, reason: string): { blocked?: string }
  moveNode(nodeId: string, x: number, y: number): void
  addEdge(from: string, to: string, edgeType: EdgeType, reason: string): { error?: string }
  removeEdge(edgeId: string, reason: string): void

  startAiAttack(claimId: string): Promise<AttackState[]>
  addPeerAttack(draft: AttackDraft, reason: string): AttackState | null
  respondToAttack(attackId: string, action: 'refine' | 'defend' | 'abandon', text: string): { error?: string }

  commitSnapshot(reason: string): Snapshot | null
  changeStatus(to: BlueprintStatus, reason: string): { error?: string }
  clearCascadeHighlight(): void
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

function persist(bp: Blueprint): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void api.saveBlueprint(bp), 400)
}

function delta(
  bp: Blueprint,
  changeType: ChangeType,
  targetIds: string[],
  targetLabel: string,
  reason: string,
  cascadeImpacts: string[] = [],
  actor: Actor = 'user'
): void {
  const entry: DeltaLogEntry = {
    id: uid('d'),
    timestamp: new Date().toISOString(),
    actor,
    changeType,
    targetIds,
    targetLabel,
    reason,
    cascadeImpacts
  }
  bp.deltaLog = [...bp.deltaLog, entry]
  bp.updatedAt = entry.timestamp
}

export const useStudio = create<StudioState>((set, get) => {
  /** apply a mutation to the blueprint, revalidate, persist */
  function mutate(fn: (bp: Blueprint) => Blueprint): void {
    const bp = get().blueprint
    if (!bp) return
    const next = fn({ ...bp })
    set({ blueprint: next, validation: validate(next.graph), dirty: true })
    persist(next)
  }

  return {
    blueprint: null,
    validation: null,
    aiMode: 'exploration',
    selectedNodeId: null,
    cascadeHighlight: [],
    dirty: false,

    async openBlueprint(id) {
      const bp = await api.loadBlueprint(id)
      if (bp) set({ blueprint: bp, validation: validate(bp.graph), selectedNodeId: null, cascadeHighlight: [] })
    },

    async createBlueprint(title, description) {
      const bp = newBlueprint(title, description)
      delta(bp, 'add_node', [], bp.title, 'Blueprint angelegt.')
      await api.saveBlueprint(bp)
      set({ blueprint: bp, validation: validate(bp.graph), selectedNodeId: null })
      return bp
    },

    async createDemo() {
      const bp = demoBlueprint()
      await api.saveBlueprint(bp)
      set({ blueprint: bp, validation: validate(bp.graph), selectedNodeId: null })
      return bp
    },

    closeBlueprint() {
      const bp = get().blueprint
      if (bp) void api.saveBlueprint(bp)
      set({ blueprint: null, validation: null, selectedNodeId: null, cascadeHighlight: [] })
    },

    setAiMode(mode) {
      set({ aiMode: mode })
    },

    select(nodeId) {
      set({ selectedNodeId: nodeId })
    },

    addNode(nodeType, fields, reason, actor = 'user') {
      const bp = get().blueprint
      if (!bp || !reason.trim()) return null
      let created: BpNode | null = null
      mutate((b) => {
        const existing = b.graph.nodes
        // place new nodes in a loose grid to the right of existing content
        const maxX = existing.length ? Math.max(...existing.map((n) => n.x)) : 0
        const pos = fields.x !== undefined && fields.y !== undefined ? { x: fields.x, y: fields.y } : { x: maxX + 260, y: 80 + (existing.length % 5) * 130 }
        created = newNode(b, nodeType, fields, pos)
        b.graph = { ...b.graph, nodes: [...b.graph.nodes, created] }
        delta(b, 'add_node', [created.id], `${created.humanId} ${created.title}`, reason, [], actor)
        return b
      })
      return created
    },

    updateNode(nodeId, fields, reason) {
      const bp = get().blueprint
      if (!bp || !reason.trim()) return []
      let impacts: CascadeImpact[] = []
      mutate((b) => {
        const node = b.graph.nodes.find((n) => n.id === nodeId)
        if (!node) return b
        const substantive =
          (fields.title !== undefined && fields.title !== node.title) ||
          (fields.content !== undefined && fields.content !== node.content) ||
          (fields.claimStatus !== undefined && fields.claimStatus !== node.claimStatus) ||
          (fields.claimType !== undefined && fields.claimType !== node.claimType) ||
          (fields.scopeId !== undefined && fields.scopeId !== node.scopeId)
        const statusChanged = fields.claimStatus !== undefined && fields.claimStatus !== node.claimStatus
        const updated = { ...node, ...fields, updatedAt: new Date().toISOString() }
        let graph: GraphState = {
          ...b.graph,
          nodes: b.graph.nodes.map((n) => (n.id === nodeId ? updated : n))
        }
        // tremor system: substantive change to a claim downgrades dependents
        if (substantive && node.nodeType === 'CLAIM') {
          impacts = computeCascade(graph, nodeId)
          graph = applyCascade(graph, impacts)
        }
        b.graph = graph
        delta(
          b,
          statusChanged ? 'status_change' : 'edit_node',
          [nodeId],
          `${node.humanId} ${updated.title}`,
          reason,
          impacts.map((i) => `${i.humanId}: ${i.oldStatus}→${i.newStatus}`)
        )
        return b
      })
      if (impacts.length) set({ cascadeHighlight: impacts.map((i) => i.nodeId) })
      return impacts
    },

    deleteNode(nodeId, reason) {
      const bp = get().blueprint
      if (!bp || !reason.trim()) return { blocked: 'Begründung fehlt.' }
      const hasEdges = bp.graph.edges.some((e) => e.from === nodeId || e.to === nodeId)
      if (hasEdges) return { blocked: 'Knoten hat Kanten. Erst Kanten entfernen (Spec: kein stilles Kaskadenlöschen).' }
      const usedAsScope = bp.graph.nodes.some((n) => n.scopeId === nodeId)
      if (usedAsScope) return { blocked: 'Knoten wird als Scope referenziert.' }
      mutate((b) => {
        const node = b.graph.nodes.find((n) => n.id === nodeId)
        if (!node) return b
        b.graph = {
          ...b.graph,
          nodes: b.graph.nodes.filter((n) => n.id !== nodeId),
          attacks: b.graph.attacks.filter((a) => a.targetClaimId !== nodeId)
        }
        delta(b, 'delete_node', [nodeId], `${node.humanId} ${node.title}`, reason)
        return b
      })
      set({ selectedNodeId: null })
      return {}
    },

    moveNode(nodeId, x, y) {
      // layout only — not structure-relevant, no Δ-entry (spec 9.1)
      const bp = get().blueprint
      if (!bp) return
      const next = {
        ...bp,
        graph: { ...bp.graph, nodes: bp.graph.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)) }
      }
      set({ blueprint: next })
      persist(next)
    },

    addEdge(from, to, edgeType, reason) {
      const bp = get().blueprint
      if (!bp || !reason.trim()) return { error: 'Begründung fehlt.' }
      if (from === to) return { error: 'Selbstbezug ist kein Argument.' }
      if (bp.graph.edges.some((e) => e.from === from && e.to === to && e.edgeType === edgeType))
        return { error: 'Diese Kante existiert bereits.' }
      mutate((b) => {
        const edge: BpEdge = { id: uid('e'), from, to, edgeType }
        b.graph = { ...b.graph, edges: [...b.graph.edges, edge] }
        const f = b.graph.nodes.find((n) => n.id === from)
        const t = b.graph.nodes.find((n) => n.id === to)
        delta(b, 'add_edge', [edge.id], `${f?.humanId} —${edgeType}→ ${t?.humanId}`, reason)
        return b
      })
      return {}
    },

    removeEdge(edgeId, reason) {
      const bp = get().blueprint
      if (!bp || !reason.trim()) return
      mutate((b) => {
        const edge = b.graph.edges.find((e) => e.id === edgeId)
        if (!edge) return b
        const f = b.graph.nodes.find((n) => n.id === edge.from)
        const t = b.graph.nodes.find((n) => n.id === edge.to)
        b.graph = { ...b.graph, edges: b.graph.edges.filter((e) => e.id !== edgeId) }
        delta(b, 'remove_edge', [edgeId], `${f?.humanId} —${edge.edgeType}→ ${t?.humanId}`, reason)
        return b
      })
    },

    async startAiAttack(claimId) {
      const bp = get().blueprint
      if (!bp) return []
      const claim = bp.graph.nodes.find((n) => n.id === claimId)
      if (!claim) return []
      // try LLM adapter (if configured), fall back to deterministic engine
      let drafts: AttackDraft[] | null = null
      try {
        drafts = await api.llmAttacks(bp.graph, claim)
      } catch {
        drafts = null
      }
      if (!drafts || drafts.length === 0) {
        drafts = generateAttacks(bp.graph, claimId)
        if (drafts.length === 0) drafts = [fallbackAttack(claim)]
      }
      const created: AttackState[] = drafts.map((d) => ({
        id: uid('at'),
        source: 'ai',
        attackVector: d.attackVector,
        targetClaimId: d.targetClaimId,
        attackText: d.attackText,
        requiredResponse: d.requiredResponse,
        responseState: 'open',
        createdAt: new Date().toISOString()
      }))
      mutate((b) => {
        b.graph = { ...b.graph, attacks: [...b.graph.attacks, ...created] }
        delta(
          b,
          'attack_created',
          created.map((a) => a.id),
          `KI-Angriff auf ${claim.humanId} (${created.length}×)`,
          `Adversarial-Modus: Angriff auf ${claim.humanId} gestartet.`,
          [],
          'ai_suggested'
        )
        return b
      })
      return created
    },

    addPeerAttack(draft, reason) {
      const bp = get().blueprint
      if (!bp || !reason.trim()) return null
      const claim = bp.graph.nodes.find((n) => n.id === draft.targetClaimId)
      if (!claim) return null
      const attack: AttackState = {
        id: uid('at'),
        source: 'peer',
        attackVector: draft.attackVector,
        targetClaimId: draft.targetClaimId,
        attackText: draft.attackText,
        requiredResponse: draft.requiredResponse,
        responseState: 'open',
        createdAt: new Date().toISOString()
      }
      mutate((b) => {
        b.graph = { ...b.graph, attacks: [...b.graph.attacks, attack] }
        delta(b, 'attack_created', [attack.id], `Peer-Angriff auf ${claim.humanId}`, reason, [], 'peer_prompted')
        return b
      })
      return attack
    },

    respondToAttack(attackId, action, text) {
      const bp = get().blueprint
      if (!bp) return { error: 'Kein Blueprint.' }
      const attack = bp.graph.attacks.find((a) => a.id === attackId)
      if (!attack) return { error: 'Angriff nicht gefunden.' }
      if (attack.requiredResponse !== 'any' && attack.requiredResponse !== action)
        return { error: `Dieser Angriff verlangt: ${attack.requiredResponse}.` }
      if ((action === 'defend' || action === 'abandon') && !text.trim())
        return { error: 'Begründung ist Pflicht.' }
      const claim = bp.graph.nodes.find((n) => n.id === attack.targetClaimId)
      mutate((b) => {
        b.graph = {
          ...b.graph,
          attacks: b.graph.attacks.map((a) =>
            a.id === attackId
              ? { ...a, responseState: 'responded' as const, responseAction: action, responseText: text, respondedAt: new Date().toISOString() }
              : a
          )
        }
        // abandon collapses the claim
        if (action === 'abandon' && claim) {
          let graph: GraphState = {
            ...b.graph,
            nodes: b.graph.nodes.map((n) => (n.id === claim.id ? { ...n, claimStatus: 'X' as const, updatedAt: new Date().toISOString() } : n))
          }
          const impacts = computeCascade(graph, claim.id)
          graph = applyCascade(graph, impacts)
          b.graph = graph
          delta(
            b,
            'attack_responded',
            [attackId],
            `${claim.humanId} aufgegeben`,
            text,
            impacts.map((i) => `${i.humanId}: ${i.oldStatus}→${i.newStatus}`)
          )
          set({ cascadeHighlight: impacts.map((i) => i.nodeId) })
        } else {
          delta(b, 'attack_responded', [attackId], `Antwort auf Angriff gegen ${claim?.humanId ?? '?'} (${action})`, text || `Antwort: ${action}`)
        }
        return b
      })
      return {}
    },

    commitSnapshot(reason) {
      const bp = get().blueprint
      if (!bp || !reason.trim()) return null
      let snap: Snapshot | null = null
      mutate((b) => {
        snap = {
          id: uid('s'),
          label: `R-${String(b.snapshots.length + 1).padStart(2, '0')}`,
          reason,
          createdAt: new Date().toISOString(),
          hash: graphHash(b.graph),
          graph: JSON.parse(JSON.stringify(b.graph)) as GraphState
        }
        b.snapshots = [...b.snapshots, snap]
        delta(b, 'snapshot_created', [snap.id], `Snapshot ${snap.label}`, reason)
        return b
      })
      return snap
    },

    changeStatus(to, reason) {
      const bp = get().blueprint
      if (!bp || !reason.trim()) return { error: 'Begründung fehlt.' }
      const v = validate(bp.graph)
      const gated: BlueprintStatus[] = ['in_review', 'validated', 'certified']
      if (gated.includes(to) && !v.submittable)
        return { error: `Compiler nicht grün: ${v.errors.length} blockierende Fehler. Gate geschlossen.` }
      const order: BlueprintStatus[] = ['draft', 'in_review', 'validated', 'certified']
      if (to !== 'draft' && order.indexOf(to) !== order.indexOf(bp.status) + 1)
        return { error: `Übergang ${bp.status} → ${to} ist nicht zulässig.` }
      mutate((b) => {
        b.status = to
        delta(b, 'blueprint_status_change', [b.id], `Status → ${to}`, reason)
        return b
      })
      // submitting creates an automatic snapshot for auditability
      if (to === 'in_review') get().commitSnapshot(`Automatischer Snapshot bei Einreichung.`)
      return {}
    },

    clearCascadeHighlight() {
      set({ cascadeHighlight: [] })
    }
  }
})
