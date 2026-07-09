import type { AttackVector, ClaimStatus, ClaimType, EdgeType, NodeType, BlueprintStatus } from '@shared/types'

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  QUESTION: 'Leitfrage',
  GOAL: 'Ziel',
  SCOPE: 'Scope',
  ASSUMPTION: 'Annahme',
  TERM: 'Begriff',
  CLAIM: 'Claim',
  TEST: 'Test',
  DECISION: 'Ergebnis',
  NOTE: 'Notiz'
}

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  E: 'empirisch',
  L: 'logisch',
  N: 'normativ',
  O: 'operativ',
  H: 'hypothetisch'
}

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  S: 'gesichert',
  W: 'wahrscheinlich',
  U: 'unsicher',
  X: 'verworfen'
}

export const STATUS_COLOR: Record<ClaimStatus, string> = {
  S: '#37b26c',
  W: '#d9a520',
  U: '#e07b39',
  X: '#c94f4f'
}

export const EDGE_TYPE_LABEL: Record<EdgeType, string> = {
  supports: 'stützt',
  requires: 'setzt voraus',
  contradicts: 'widerspricht',
  qualifies: 'präzisiert',
  generalizes: 'verallgemeinert',
  exception_to: 'Ausnahme von'
}

export const EDGE_COLOR: Record<EdgeType, string> = {
  supports: '#37b26c',
  requires: '#4f8fd9',
  contradicts: '#c94f4f',
  qualifies: '#9a7bd9',
  generalizes: '#7bb0d9',
  exception_to: '#d9a520'
}

export const ATTACK_VECTOR_LABEL: Record<AttackVector, string> = {
  scope_drift: 'Scope-Drift',
  hidden_assumption: 'Versteckte Annahme',
  weak_evidence: 'Schwache Evidenz',
  logical_gap: 'Logische Lücke',
  normative_smuggle: 'Norm-Schmuggel',
  circularity: 'Zirkularität',
  status_inflation: 'Status-Inflation',
  untestable: 'Unprüfbar'
}

export const BP_STATUS_LABEL: Record<BlueprintStatus, string> = {
  draft: 'Entwurf',
  in_review: 'In Review',
  validated: 'Validiert',
  certified: 'Zertifiziert',
  archived: 'Archiviert'
}

export const REASON_TEMPLATES = [
  'Begriff geschärft',
  'Scope eingegrenzt',
  'KI-Angriff beantwortet',
  'Evidenz ergänzt',
  'Gegenbeispiel eingearbeitet',
  'Status nach Prüfung angepasst',
  'Struktur ergänzt'
]
