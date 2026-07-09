import type { AiSettings, Blueprint, BlueprintMeta, BpNode, GraphState } from '@shared/types'
import type { AttackDraft } from '@shared/attacks'

export interface StudioApi {
  listBlueprints(): Promise<BlueprintMeta[]>
  loadBlueprint(id: string): Promise<Blueprint | null>
  saveBlueprint(bp: Blueprint): Promise<void>
  deleteBlueprint(id: string): Promise<void>
  loadSettings(): Promise<AiSettings>
  saveSettings(s: AiSettings): Promise<void>
  exportJson(bp: Blueprint, snapshotId?: string): Promise<string | null>
  exportPdf(bp: Blueprint, snapshotId?: string): Promise<string | null>
  llmAttacks(graph: GraphState, claim: BpNode): Promise<AttackDraft[] | null>
}

declare global {
  interface Window {
    studio?: StudioApi
  }
}

/** Browser fallback (dev/testing without Electron): localStorage-backed. */
const browserApi: StudioApi = {
  async listBlueprints() {
    const metas: BlueprintMeta[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!
      if (!key.startsWith('bp:')) continue
      try {
        const bp = JSON.parse(localStorage.getItem(key)!) as Blueprint
        metas.push({
          id: bp.id,
          title: bp.title,
          description: bp.description,
          status: bp.status,
          updatedAt: bp.updatedAt,
          nodeCount: bp.graph.nodes.length,
          openAttacks: bp.graph.attacks.filter((a) => a.responseState === 'open').length
        })
      } catch {
        /* skip */
      }
    }
    return metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  async loadBlueprint(id) {
    const raw = localStorage.getItem(`bp:${id}`)
    return raw ? (JSON.parse(raw) as Blueprint) : null
  },
  async saveBlueprint(bp) {
    localStorage.setItem(`bp:${bp.id}`, JSON.stringify(bp))
  },
  async deleteBlueprint(id) {
    localStorage.removeItem(`bp:${id}`)
  },
  async loadSettings() {
    const raw = localStorage.getItem('settings')
    return raw ? JSON.parse(raw) : { apiBaseUrl: '', apiKey: '', model: '' }
  },
  async saveSettings(s) {
    localStorage.setItem('settings', JSON.stringify(s))
  },
  async exportJson(bp, snapshotId) {
    const snap = snapshotId ? bp.snapshots.find((s) => s.id === snapshotId) : undefined
    const graph = snap ? snap.graph : bp.graph
    const payload = { format: 'blueprint-studio/v1', blueprint: { id: bp.id, title: bp.title }, nodes: graph.nodes, edges: graph.edges, attacks: graph.attacks, deltaLog: bp.deltaLog }
    download(`${bp.title}.blueprint.json`, JSON.stringify(payload, null, 2), 'application/json')
    return `${bp.title}.blueprint.json`
  },
  async exportPdf() {
    window.print()
    return null
  },
  async llmAttacks() {
    return null
  }
}

function download(name: string, content: string, type: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export const api: StudioApi = window.studio ?? browserApi
export const isElectron = !!window.studio
