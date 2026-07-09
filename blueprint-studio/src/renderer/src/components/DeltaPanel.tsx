import { useMemo, useState } from 'react'
import { useStudio } from '../store'

type Filter = 'all' | 'status' | 'ai' | 'peer' | 'attacks'

export function DeltaPanel(): React.JSX.Element {
  const bp = useStudio((s) => s.blueprint)!
  const [filter, setFilter] = useState<Filter>('all')

  const entries = useMemo(() => {
    const log = [...bp.deltaLog].reverse()
    switch (filter) {
      case 'status':
        return log.filter((d) => d.changeType === 'status_change' || d.changeType === 'blueprint_status_change')
      case 'ai':
        return log.filter((d) => d.actor === 'ai_suggested')
      case 'peer':
        return log.filter((d) => d.actor === 'peer_prompted')
      case 'attacks':
        return log.filter((d) => d.changeType === 'attack_created' || d.changeType === 'attack_responded')
      default:
        return log
    }
  }, [bp.deltaLog, filter])

  const filters: Array<[Filter, string]> = [
    ['all', 'Alle'],
    ['status', 'Status'],
    ['attacks', 'Angriffe'],
    ['ai', 'KI'],
    ['peer', 'Peer']
  ]

  return (
    <div>
      <h3 className="panel-title">Δ-Log — Lernbiographie ({bp.deltaLog.length})</h3>
      <div className="delta-filter">
        {filters.map(([f, label]) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
      </div>
      {entries.slice(0, 80).map((d) => (
        <div key={d.id} className="delta-entry">
          <div className="head">
            <span>{d.timestamp.slice(0, 16).replace('T', ' ')}</span>
            <span>{d.changeType}</span>
            <span>{d.actor === 'user' ? '' : d.actor === 'ai_suggested' ? '🤖' : '👤'}</span>
          </div>
          <div>
            <b>{d.targetLabel}</b>
          </div>
          <div style={{ color: 'var(--text-dim)' }}>{d.reason}</div>
          {d.cascadeImpacts.length > 0 && <div className="cascade">↯ Kaskade: {d.cascadeImpacts.join(', ')}</div>}
        </div>
      ))}
    </div>
  )
}
