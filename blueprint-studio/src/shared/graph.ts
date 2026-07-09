import type { BpEdge, GraphState } from './types'

/** Edges that carry epistemic dependency (used for cascades + cycle detection). */
const DEPENDENCY_EDGES = new Set(['supports', 'requires'])

/**
 * Downstream claims of a node: everything that (transitively) depends on it.
 * `supports`: from → to means "from supports to" ⇒ to depends on from.
 * `requires`: from → to means "from requires to" ⇒ from depends on to.
 */
export function downstreamOf(graph: GraphState, nodeId: string): string[] {
  const dependents = new Map<string, string[]>()
  for (const e of graph.edges) {
    if (e.edgeType === 'supports') {
      push(dependents, e.from, e.to)
    } else if (e.edgeType === 'requires') {
      push(dependents, e.to, e.from)
    }
  }
  const seen = new Set<string>()
  const stack = [...(dependents.get(nodeId) ?? [])]
  while (stack.length) {
    const n = stack.pop()!
    if (seen.has(n) || n === nodeId) continue
    seen.add(n)
    stack.push(...(dependents.get(n) ?? []))
  }
  return [...seen]
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const arr = map.get(key)
  if (arr) arr.push(value)
  else map.set(key, [value])
}

/** Detect cycles in the dependency subgraph. Returns one cycle's node ids, or null. */
export function findDependencyCycle(graph: GraphState): string[] | null {
  const adj = new Map<string, string[]>()
  for (const e of graph.edges) {
    if (!DEPENDENCY_EDGES.has(e.edgeType)) continue
    // normalize to "x depends on y": supports: to←from ; requires: from←to
    const [from, to] = e.edgeType === 'supports' ? [e.to, e.from] : [e.from, e.to]
    push(adj, from, to)
  }
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2
  const color = new Map<string, number>()
  const parent = new Map<string, string>()
  const nodes = [...adj.keys()]
  for (const start of nodes) {
    if ((color.get(start) ?? WHITE) !== WHITE) continue
    const stack: Array<[string, number]> = [[start, 0]]
    color.set(start, GRAY)
    while (stack.length) {
      const top = stack[stack.length - 1]
      const [u, idx] = top
      const neighbors = adj.get(u) ?? []
      if (idx < neighbors.length) {
        top[1]++
        const v = neighbors[idx]
        const c = color.get(v) ?? WHITE
        if (c === GRAY) {
          // reconstruct cycle v → … → u → v
          const cycle = [u]
          let cur = u
          while (cur !== v) {
            cur = parent.get(cur)!
            cycle.push(cur)
          }
          return cycle.reverse()
        }
        if (c === WHITE) {
          color.set(v, GRAY)
          parent.set(v, u)
          stack.push([v, 0])
        }
      } else {
        color.set(u, BLACK)
        stack.pop()
      }
    }
  }
  return null
}

export function edgesOf(graph: GraphState, nodeId: string): BpEdge[] {
  return graph.edges.filter((e) => e.from === nodeId || e.to === nodeId)
}

/** Deterministic content hash (FNV-1a over canonical JSON) — replay-stable, no crypto dep. */
export function graphHash(graph: GraphState): string {
  const canonical = JSON.stringify({
    nodes: [...graph.nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ x: _x, y: _y, ...rest }) => rest),
    edges: [...graph.edges].sort((a, b) => a.id.localeCompare(b.id)),
    attacks: [...graph.attacks].sort((a, b) => a.id.localeCompare(b.id))
  })
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < canonical.length; i++) {
    const c = canonical.charCodeAt(i)
    h1 = ((h1 ^ c) * 0x01000193) >>> 0
    h2 = ((h2 ^ ((c << 8) | (i & 0xff))) * 0x01000193) >>> 0
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 12)
}
