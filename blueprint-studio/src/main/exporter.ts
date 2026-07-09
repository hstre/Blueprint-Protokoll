import { BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'fs'
import type { Blueprint, GraphState, Snapshot } from '@shared/types'
import { validate, blockName } from '@shared/validation'
import { graphHash } from '@shared/graph'
import { MANDATORY_BLOCKS, BLOCK_NODE_TYPES } from '@shared/types'

/** JSON export: the machine-readable "Explanation view" feed (spec G2). */
export async function exportJson(win: BrowserWindow, bp: Blueprint, snapshot?: Snapshot): Promise<string | null> {
  const graph = snapshot ? snapshot.graph : bp.graph
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Blueprint als JSON exportieren',
    defaultPath: `${safe(bp.title)}${snapshot ? '_' + snapshot.label : ''}.blueprint.json`,
    filters: [{ name: 'Blueprint JSON', extensions: ['json'] }]
  })
  if (!filePath) return null
  const payload = {
    format: 'blueprint-studio/v1',
    blueprint: { id: bp.id, title: bp.title, description: bp.description, status: bp.status },
    snapshot: snapshot ? { label: snapshot.label, hash: snapshot.hash, createdAt: snapshot.createdAt } : { label: 'working', hash: graphHash(graph) },
    nodes: graph.nodes.map(({ x: _x, y: _y, ...n }) => n),
    edges: graph.edges,
    attacks: graph.attacks,
    deltaLog: bp.deltaLog
  }
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
  return filePath
}

/** PDF export via a print-friendly HTML report rendered in a hidden window (spec G1). */
export async function exportPdf(win: BrowserWindow, bp: Blueprint, snapshot?: Snapshot): Promise<string | null> {
  const graph = snapshot ? snapshot.graph : bp.graph
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Blueprint als PDF exportieren',
    defaultPath: `${safe(bp.title)}${snapshot ? '_' + snapshot.label : ''}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (!filePath) return null

  const html = reportHtml(bp, graph, snapshot)
  const printWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try {
    await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    const pdf = await printWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 }
    })
    await fs.writeFile(filePath, pdf)
    return filePath
  } finally {
    printWin.destroy()
  }
}

const CLAIM_TYPE_NAME: Record<string, string> = {
  E: 'empirisch',
  L: 'logisch',
  N: 'normativ',
  O: 'operativ',
  H: 'hypothetisch'
}
const STATUS_NAME: Record<string, string> = {
  S: 'gesichert',
  W: 'wahrscheinlich',
  U: 'unsicher',
  X: 'verworfen'
}

function reportHtml(bp: Blueprint, graph: GraphState, snapshot?: Snapshot): string {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const v = validate(graph)
  const hash = snapshot ? snapshot.hash : graphHash(graph)

  const blocks = MANDATORY_BLOCKS.map((b) => {
    const nodes = graph.nodes.filter((n) => BLOCK_NODE_TYPES[b].includes(n.nodeType) && n.nodeType !== 'CLAIM' && n.nodeType !== 'TEST')
    if (!nodes.length) return ''
    return `<h2>${esc(blockName(b))}</h2>` + nodes.map((n) => `<p><b>${esc(n.humanId)} — ${esc(n.title)}</b><br>${esc(n.content || '')}${n.assumptionJustification ? `<br><i>Begründung: ${esc(n.assumptionJustification)}</i>` : ''}</p>`).join('')
  }).join('')

  const claims = graph.nodes
    .filter((n) => n.nodeType === 'CLAIM')
    .map((c) => {
      const scope = c.scopeId ? byId.get(c.scopeId) : undefined
      const deps = graph.edges
        .filter((e) => e.from === c.id || e.to === c.id)
        .map((e) => {
          const other = byId.get(e.from === c.id ? e.to : e.from)
          return other ? `${e.edgeType} ${e.from === c.id ? '→' : '←'} ${other.humanId}` : ''
        })
        .filter(Boolean)
        .join(', ')
      return `<tr>
        <td><b>${esc(c.humanId)}</b></td>
        <td>${esc(c.title)}${c.content ? `<br><small>${esc(c.content)}</small>` : ''}<br><small><i>${esc(c.statusRationale ?? '')}</i></small></td>
        <td>${CLAIM_TYPE_NAME[c.claimType ?? ''] ?? '—'}</td>
        <td>${STATUS_NAME[c.claimStatus ?? ''] ?? '—'}</td>
        <td>${scope ? esc(scope.title) : '—'}</td>
        <td><small>${esc(deps)}</small></td>
      </tr>`
    })
    .join('')

  const tests = graph.nodes
    .filter((n) => n.nodeType === 'TEST')
    .map((t) => {
      const target = t.testTargetClaimId ? byId.get(t.testTargetClaimId) : undefined
      return `<p><b>${esc(t.humanId)} — ${esc(t.title)}</b> (Ziel: ${target ? esc(target.humanId) : '—'}, Ausgang: ${esc(t.testOutcome ?? 'offen')})<br>${esc(t.content || '')}</p>`
    })
    .join('')

  const attacks = graph.attacks
    .map((a) => {
      const target = byId.get(a.targetClaimId)
      return `<tr>
        <td>${esc(target?.humanId ?? '?')}</td>
        <td>${esc(a.attackVector)}</td>
        <td>${a.source === 'ai' ? 'KI' : 'Peer'}</td>
        <td>${esc(a.attackText)}</td>
        <td>${a.responseState === 'open' ? '<b>offen</b>' : `${esc(a.responseAction ?? '')}: ${esc(a.responseText ?? '')}`}</td>
      </tr>`
    })
    .join('')

  const deltas = bp.deltaLog
    .slice(-40)
    .reverse()
    .map(
      (d) => `<tr><td><small>${esc(d.timestamp.slice(0, 16).replace('T', ' '))}</small></td><td>${esc(d.changeType)}</td><td>${esc(d.targetLabel)}</td><td>${esc(d.reason)}</td><td><small>${esc(d.cascadeImpacts.join(', '))}</small></td></tr>`
    )
    .join('')

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 11px; color: #1a1a1a; }
    h1 { font-size: 20px; margin-bottom: 2px; } h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 1px solid #999; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #eee; }
    .meta { color: #555; margin-bottom: 14px; }
    .status { display: inline-block; padding: 1px 8px; border: 1px solid #666; border-radius: 10px; }
  </style></head><body>
  <h1>${esc(bp.title)}</h1>
  <div class="meta">
    Blueprint-Studio-Report · Status: <span class="status">${esc(bp.status)}</span> ·
    Snapshot: <b>${snapshot ? esc(snapshot.label) : 'Arbeitsstand'}</b> · Hash: <code>${esc(hash)}</code> · ${new Date().toISOString().slice(0, 10)}<br>
    ${esc(bp.description)}
  </div>
  <div class="meta"><b>Compiler:</b> ${v.errors.length} Fehler, ${v.warnings.length} Warnungen${v.errors.length ? ' — <b>nicht einreichbar</b>' : ' — formal gültig'}</div>
  ${blocks}
  <h2>Claim-Liste</h2>
  <table><tr><th>ID</th><th>Aussage</th><th>Typ</th><th>Status</th><th>Scope</th><th>Abhängigkeiten</th></tr>${claims || '<tr><td colspan="6">—</td></tr>'}</table>
  <h2>Tests / Gegenbeispiele</h2>${tests || '<p>—</p>'}
  <h2>Angriffe (Adversarial)</h2>
  <table><tr><th>Ziel</th><th>Vektor</th><th>Quelle</th><th>Angriff</th><th>Antwort</th></tr>${attacks || '<tr><td colspan="5">—</td></tr>'}</table>
  <h2>Δ-Log (letzte Einträge)</h2>
  <table><tr><th>Zeit</th><th>Typ</th><th>Ziel</th><th>Begründung</th><th>Kaskade</th></tr>${deltas || '<tr><td colspan="5">—</td></tr>'}</table>
  </body></html>`
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

function safe(s: string): string {
  return s.replace(/[^\wäöüÄÖÜß -]/g, '_').slice(0, 60)
}
