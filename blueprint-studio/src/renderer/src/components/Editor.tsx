import { useState } from 'react'
import type { NodeType } from '@shared/types'
import { useStudio } from '../store'
import { Toolbar } from './Toolbar'
import { StructurePanel } from './StructurePanel'
import { Arena } from './Arena'
import { AiPanel } from './AiPanel'
import { DeltaPanel } from './DeltaPanel'
import { ValidationBar } from './ValidationBar'
import { NodeEditor } from './NodeEditor'
import { EdgeDialog, type PendingEdge } from './EdgeDialog'
import { SnapshotsDialog } from './SnapshotsDialog'

export interface EditorDialogs {
  createNode(nodeType: NodeType): void
  editNode(nodeId: string): void
  pendingEdge(edge: PendingEdge): void
  snapshots(): void
}

export function Editor(): React.JSX.Element {
  const blueprint = useStudio((s) => s.blueprint)!
  const [createType, setCreateType] = useState<NodeType | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [edge, setEdge] = useState<PendingEdge | null>(null)
  const [showSnapshots, setShowSnapshots] = useState(false)

  const dialogs: EditorDialogs = {
    createNode: setCreateType,
    editNode: setEditId,
    pendingEdge: setEdge,
    snapshots: () => setShowSnapshots(true)
  }

  return (
    <div className="app-shell">
      <Toolbar dialogs={dialogs} />
      <div className="workbench">
        <StructurePanel dialogs={dialogs} />
        <div className="arena">
          <Arena dialogs={dialogs} />
        </div>
        <div className="panel-right">
          <div className="ai-zone">
            <AiPanel dialogs={dialogs} />
          </div>
          <div className="delta-zone">
            <DeltaPanel />
          </div>
        </div>
      </div>
      <ValidationBar />

      {createType && <NodeEditor mode="create" nodeType={createType} onClose={() => setCreateType(null)} />}
      {editId && blueprint.graph.nodes.some((n) => n.id === editId) && (
        <NodeEditor mode="edit" nodeId={editId} onClose={() => setEditId(null)} />
      )}
      {edge && <EdgeDialog pending={edge} onClose={() => setEdge(null)} />}
      {showSnapshots && <SnapshotsDialog onClose={() => setShowSnapshots(false)} />}
    </div>
  )
}
