import {
  HUMAN_ID_PREFIX,
  type Blueprint,
  type BpEdge,
  type BpNode,
  type NodeType
} from './types'

let counter = 0
/** Unique-enough id: timestamp + monotonic counter (no PRNG → replay-friendly logs). */
export function uid(prefix: string): string {
  counter = (counter + 1) % 100000
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(4, '0')}`
}

export function nextHumanId(bp: Blueprint, nodeType: NodeType): string {
  const n = (bp.humanIdCounters[nodeType] ?? 0) + 1
  bp.humanIdCounters[nodeType] = n
  return `${HUMAN_ID_PREFIX[nodeType]}${n}`
}

export function newNode(
  bp: Blueprint,
  nodeType: NodeType,
  partial: Partial<BpNode> & { title: string },
  pos: { x: number; y: number }
): BpNode {
  const now = new Date().toISOString()
  return {
    id: uid('n'),
    humanId: nextHumanId(bp, nodeType),
    nodeType,
    content: '',
    x: pos.x,
    y: pos.y,
    createdAt: now,
    updatedAt: now,
    ...partial
  }
}

export function newBlueprint(title: string, description = ''): Blueprint {
  const now = new Date().toISOString()
  return {
    id: uid('bp'),
    title,
    description,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    graph: { nodes: [], edges: [], attacks: [] },
    snapshots: [],
    deltaLog: [],
    humanIdCounters: {}
  }
}

/** Demo blueprint (CO₂ tax example from the Blueprint Project paper, ch. 7.3). */
export function demoBlueprint(): Blueprint {
  const bp = newBlueprint(
    'Demo: CO₂-Steuer im Verkehrssektor',
    'Beispiel-Blueprint nach dem Blueprint-Protokoll (Kapitel 7.3 des Papers).'
  )
  const add = (t: NodeType, p: Partial<BpNode> & { title: string }, x: number, y: number): BpNode => {
    const n = newNode(bp, t, p, { x, y })
    bp.graph.nodes.push(n)
    return n
  }
  const q = add(
    'QUESTION',
    {
      title: 'Ist eine nationale CO₂-Steuer 2025–2035 im Verkehrssektor wirksam?',
      content:
        'Unter welchen Annahmen ist eine nationale CO₂-Steuer ein effektives Instrument zur Emissionsreduktion im Verkehrssektor zwischen 2025 und 2035? Ergebnisformat: Entscheidungsvorschlag.'
    },
    40,
    40
  )
  add(
    'GOAL',
    {
      title: 'Entscheidungsvorschlag für Politikberatung',
      content: 'Abbruchkriterium: Die Frage ist beantwortet, wenn ein begründeter, scope-gebundener Entscheidungsvorschlag mit benannten kritischen Annahmen vorliegt.'
    },
    40,
    170
  )
  const scope = add(
    'SCOPE',
    {
      title: 'Deutschland, Verkehrssektor, 2025–2035',
      content: 'Geltungsbereich: Deutschland, Personen- und Güterverkehr, 2025–2035. Nicht im Scope: geopolitische Ursachen, Luftfahrt international, EU-ETS-Wechselwirkungen im Detail.'
    },
    40,
    300
  )
  const term = add(
    'TERM',
    {
      title: '„Effektiv“',
      content: 'Arbeitsdefinition: Reduktion der Sektoremissionen um ≥ 20 % gegenüber Referenzpfad bis 2035, ohne Ausweichverkehr, der die Einsparung > 25 % kompensiert.'
    },
    40,
    430
  )
  const a1 = add(
    'ASSUMPTION',
    {
      title: 'A: Preiselastizität der Verkehrsnachfrage ist mittelfristig ≥ 0,3',
      content: 'Datenannahme auf Basis von Metastudien zur Kraftstoffpreiselastizität.',
      assumptionJustification: 'Mehrere Metastudien (langfristige Elastizität 0,3–0,8); konservativer unterer Rand gewählt.'
    },
    340,
    40
  )
  const c1 = add(
    'CLAIM',
    {
      title: 'Ein CO₂-Preis ≥ 200 €/t senkt Verkehrsemissionen im Scope messbar',
      content: 'Empirische Aussage: Bei Preisen ab ~200 €/t sinken die Emissionen des Sektors gegenüber Referenzpfad signifikant.',
      claimType: 'E',
      claimStatus: 'W',
      statusRationale: 'Gut gestützt durch Elastizitätsstudien, aber Unsicherheit über Anpassungsverhalten (W, nicht S).',
      scopeId: scope.id
    },
    340,
    200
  )
  const c2 = add(
    'CLAIM',
    {
      title: 'Sozialer Ausgleich ist Bedingung politischer Durchsetzbarkeit',
      content: 'Operative Aussage: Ohne Rückverteilung (Klimageld) scheitert das Instrument am politischen Widerstand. Kriterium: Zustimmung > 50 % in Umfragen bei Rückverteilung.',
      claimType: 'O',
      claimStatus: 'U',
      statusRationale: 'Plausibel aus Fallstudien (CH, CA), aber Übertragbarkeit unsicher.',
      scopeId: scope.id
    },
    340,
    380
  )
  const test1 = add(
    'TEST',
    {
      title: 'Gegenbeispiel-Versuch: Tanktourismus',
      content: 'Randfall: Grenzregionen weichen auf Nachbarländer aus. Prüfkriterium: Kompensiert Ausweichverkehr > 25 % der Einsparung, kippt C1.',
      testTargetClaimId: c1.id,
      testOutcome: 'passes'
    },
    640,
    120
  )
  const decision = add(
    'DECISION',
    {
      title: 'Unter A1 und C1–C2: CO₂-Steuer mit Klimageld einführen',
      content: 'Unter den expliziten Annahmen und im gesetzten Scope ist eine CO₂-Steuer ≥ 200 €/t mit vollständiger Pro-Kopf-Rückverteilung vertretbar. Kritischste Annahme: Preiselastizität (A1). Nächster Schritt: Elastizität für Güterverkehr separat prüfen.',
      scopeId: scope.id
    },
    640,
    320
  )
  const edge = (from: BpNode, to: BpNode, edgeType: BpEdge['edgeType']): void => {
    bp.graph.edges.push({ id: uid('e'), from: from.id, to: to.id, edgeType })
  }
  edge(a1, c1, 'supports')
  edge(test1, c1, 'supports')
  edge(c1, decision, 'supports')
  edge(c2, decision, 'supports')
  edge(term, c1, 'qualifies')
  edge(q, decision, 'qualifies')

  bp.deltaLog.push({
    id: uid('d'),
    timestamp: new Date().toISOString(),
    actor: 'user',
    changeType: 'add_node',
    targetIds: bp.graph.nodes.map((n) => n.id),
    targetLabel: 'Demo-Blueprint',
    reason: 'Demo-Blueprint angelegt (Beispielstruktur aus dem Blueprint-Paper).',
    cascadeImpacts: []
  })
  return bp
}
