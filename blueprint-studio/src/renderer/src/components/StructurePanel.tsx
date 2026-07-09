import { BLOCK_NODE_TYPES, MANDATORY_BLOCKS, type BlockId } from '@shared/types'
import { blockName } from '@shared/validation'
import { useStudio } from '../store'
import type { EditorDialogs } from './Editor'

/** Left panel: completeness monitor for the mandatory blocks (spec UI §3). */
export function StructurePanel({ dialogs }: { dialogs: EditorDialogs }): React.JSX.Element {
  const { blueprint, validation, select } = useStudio()
  const bp = blueprint!

  const nodesFor = (block: BlockId) =>
    bp.graph.nodes.filter((n) => BLOCK_NODE_TYPES[block].includes(n.nodeType))

  return (
    <div className="panel-left">
      <h3 className="panel-title">Pflichtblöcke</h3>
      {MANDATORY_BLOCKS.map((block) => {
        const status = validation?.blockStatus[block] ?? 'missing'
        const nodes = nodesFor(block)
        return (
          <div key={block}>
            <div
              className="block-row"
              title={status === 'missing' ? 'Block fehlt — Pflicht!' : status === 'invalid' ? 'Block hat blockierende Fehler' : 'Formal gültig'}
              onClick={() => nodes[0] && select(nodes[0].id)}
            >
              <span className={`dot ${status}`} />
              <span>{blockName(block)}</span>
              <span className="count">{nodes.length || '—'}</span>
              <button
                title={`${blockName(block)}-Knoten hinzufügen`}
                onClick={(e) => {
                  e.stopPropagation()
                  dialogs.createNode(BLOCK_NODE_TYPES[block][0])
                }}
              >
                +
              </button>
            </div>
            {nodes.slice(0, 6).map((n) => (
              <div
                key={n.id}
                className="block-row"
                style={{ paddingLeft: 24, fontSize: 12, color: 'var(--text-dim)' }}
                onClick={() => select(n.id)}
                onDoubleClick={() => dialogs.editNode(n.id)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b>{n.humanId}</b> {n.title}
                </span>
              </div>
            ))}
            {nodes.length > 6 && (
              <div style={{ paddingLeft: 24, fontSize: 11, color: 'var(--text-dim)' }}>… {nodes.length - 6} weitere</div>
            )}
          </div>
        )
      })}
      <h3 className="panel-title" style={{ marginTop: 18 }}>
        Weitere Knoten
      </h3>
      <div className="block-row" onClick={() => dialogs.createNode('NOTE')}>
        <span className="dot" style={{ border: '1.5px dotted var(--text-dim)' }} />
        <span>Notiz (Material)</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            dialogs.createNode('NOTE')
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}
