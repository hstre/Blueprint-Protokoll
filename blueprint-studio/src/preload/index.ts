import { contextBridge, ipcRenderer } from 'electron'
import type { AiSettings, Blueprint, BlueprintMeta, BpNode, GraphState } from '../shared/types'
import type { AttackDraft } from '../shared/attacks'

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

const api: StudioApi = {
  listBlueprints: () => ipcRenderer.invoke('bp:list'),
  loadBlueprint: (id) => ipcRenderer.invoke('bp:load', id),
  saveBlueprint: (bp) => ipcRenderer.invoke('bp:save', bp),
  deleteBlueprint: (id) => ipcRenderer.invoke('bp:delete', id),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  exportJson: (bp, snapshotId) => ipcRenderer.invoke('export:json', bp, snapshotId),
  exportPdf: (bp, snapshotId) => ipcRenderer.invoke('export:pdf', bp, snapshotId),
  llmAttacks: (graph, claim) => ipcRenderer.invoke('ai:attacks', graph, claim)
}

contextBridge.exposeInMainWorld('studio', api)
