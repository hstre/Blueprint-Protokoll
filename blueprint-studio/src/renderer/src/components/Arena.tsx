import { useCallback, useEffect, useMemo } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  Position,
  MarkerType
} from '@xyflow/react'
import type { BpNode } from '@shared/types'
import { useStudio } from '../store'
import { CLAIM_STATUS_LABEL, CLAIM_TYPE_LABEL, EDGE_COLOR, EDGE_TYPE_LABEL, NODE_TYPE_LABEL, STATUS_COLOR } from '../labels'
import type { EditorDialogs } from './Editor'

type ArenaNodeData = { bp: BpNode; openAttacks: number; cascading: boolean; dialogs: EditorDialogs }
type ArenaNode = Node<ArenaNodeData, 'bpNode'>

function BpNodeView({ data, selected }: NodeProps<ArenaNode>): React.JSX.Element {
  const n = data.bp
  const borderColor = n.nodeType === 'CLAIM' && n.claimStatus ? STATUS_COLOR[n.claimStatus] : undefined
  return (
    <div
      className={`bp-node t-${n.nodeType} ${selected ? 'selected' : ''} ${data.cascading ? 'cascade' : ''}`}
      style={borderColor ? { borderLeftColor: borderColor } : undefined}
      onDoubleClick={() => data.dialogs.editNode(n.id)}
      title="Doppelklick: bearbeiten"
    >
      <Handle type="target" position={Position.Left} />
      <div className="head">
        <span className="hid">{n.humanId}</span>
        <span className="kind">{NODE_TYPE_LABEL[n.nodeType]}</span>
      </div>
      <div className="ttl">{n.title}</div>
      <div className="badges">
        {n.nodeType === 'CLAIM' && n.claimType && <span className="badge">{CLAIM_TYPE_LABEL[n.claimType]}</span>}
        {n.nodeType === 'CLAIM' && n.claimStatus && (
          <span className={`badge st-${n.claimStatus}`}>{CLAIM_STATUS_LABEL[n.claimStatus]}</span>
        )}
        {n.nodeType === 'TEST' && n.testOutcome && <span className="badge">{n.testOutcome}</span>}
        {n.aiSuggested && <span className="badge">KI-Vorschlag</span>}
        {data.openAttacks > 0 && <span className="badge attack-open">⚔ {data.openAttacks}</span>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { bpNode: BpNodeView }

function ArenaInner({ dialogs }: { dialogs: EditorDialogs }): React.JSX.Element {
  const { blueprint, selectedNodeId, cascadeHighlight, select, moveNode } = useStudio()
  const bp = blueprint!
  const rf = useReactFlow()

  const nodes: ArenaNode[] = useMemo(
    () =>
      bp.graph.nodes.map((n) => ({
        id: n.id,
        type: 'bpNode' as const,
        position: { x: n.x, y: n.y },
        selected: n.id === selectedNodeId,
        data: {
          bp: n,
          openAttacks: bp.graph.attacks.filter((a) => a.targetClaimId === n.id && a.responseState === 'open').length,
          cascading: cascadeHighlight.includes(n.id),
          dialogs
        }
      })),
    [bp.graph, selectedNodeId, cascadeHighlight, dialogs]
  )

  const edges: Edge[] = useMemo(
    () =>
      bp.graph.edges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        label: EDGE_TYPE_LABEL[e.edgeType],
        animated: e.edgeType === 'contradicts',
        style: { stroke: EDGE_COLOR[e.edgeType], strokeWidth: 1.6 },
        labelStyle: { fill: 'var(--text-dim)', fontSize: 10 },
        labelBgStyle: { fill: '#171d24' },
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR[e.edgeType] }
      })),
    [bp.graph.edges]
  )

  // center on selection coming from other panels
  useEffect(() => {
    if (!selectedNodeId) return
    const n = bp.graph.nodes.find((x) => x.id === selectedNodeId)
    if (n) rf.setCenter(n.x + 100, n.y + 40, { zoom: Math.max(rf.getZoom(), 0.9), duration: 350 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId])

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) dialogs.pendingEdge({ from: c.source, to: c.target })
    },
    [dialogs]
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onConnect={onConnect}
      onNodeClick={(_e, n) => select(n.id)}
      onPaneClick={() => select(null)}
      onNodeDragStop={(_e, n) => moveNode(n.id, n.position.x, n.position.y)}
      onEdgeDoubleClick={(_e, edge) => {
        const bpEdge = bp.graph.edges.find((x) => x.id === edge.id)
        if (bpEdge) dialogs.pendingEdge({ removeId: edge.id, from: bpEdge.from, to: bpEdge.to })
      }}
      fitView
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
      deleteKeyCode={null}
    >
      <Background gap={22} color="#232b34" />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => {
          const d = (n as ArenaNode).data.bp
          return d.nodeType === 'CLAIM' && d.claimStatus ? STATUS_COLOR[d.claimStatus] : '#2b3540'
        }}
      />
    </ReactFlow>
  )
}

export function Arena({ dialogs }: { dialogs: EditorDialogs }): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <ArenaInner dialogs={dialogs} />
    </ReactFlowProvider>
  )
}
