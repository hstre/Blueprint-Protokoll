import type { ClaimStatus, GraphState } from './types'
import { downstreamOf } from './graph'

export interface CascadeImpact {
  nodeId: string
  humanId: string
  oldStatus?: ClaimStatus
  newStatus?: ClaimStatus
}

const DOWNGRADE: Record<ClaimStatus, ClaimStatus> = { S: 'W', W: 'U', U: 'U', X: 'X' }

/**
 * Tremor system: when a claim changes substantively, everything depending on it
 * is downgraded one status level and flagged for revision.
 * Returns the impacts; the caller applies them (and logs them in the Δ-log).
 */
export function computeCascade(graph: GraphState, changedNodeId: string): CascadeImpact[] {
  const affected = downstreamOf(graph, changedNodeId)
  const impacts: CascadeImpact[] = []
  for (const id of affected) {
    const node = graph.nodes.find((n) => n.id === id)
    if (!node || node.nodeType !== 'CLAIM' || !node.claimStatus || node.claimStatus === 'X') continue
    const next = DOWNGRADE[node.claimStatus]
    impacts.push({
      nodeId: id,
      humanId: node.humanId,
      oldStatus: node.claimStatus,
      newStatus: next
    })
  }
  return impacts
}

export function applyCascade(graph: GraphState, impacts: CascadeImpact[]): GraphState {
  if (impacts.length === 0) return graph
  const impactMap = new Map(impacts.map((i) => [i.nodeId, i]))
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const imp = impactMap.get(n.id)
      if (!imp || !imp.newStatus || imp.newStatus === n.claimStatus) return n
      return { ...n, claimStatus: imp.newStatus, updatedAt: n.updatedAt }
    })
  }
}
