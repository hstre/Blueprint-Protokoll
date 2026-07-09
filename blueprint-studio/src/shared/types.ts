/**
 * Blueprint Studio — domain model.
 * Follows "Blueprint Studio — Data Model Specification v1.0" (MVP subset, ch. 13).
 */

export type NodeType = 'QUESTION' | 'GOAL' | 'SCOPE' | 'ASSUMPTION' | 'TERM' | 'CLAIM' | 'TEST' | 'DECISION' | 'NOTE'

export type ClaimType = 'E' | 'L' | 'N' | 'O' | 'H'
export type ClaimStatus = 'S' | 'W' | 'U' | 'X'

export type EdgeType = 'supports' | 'requires' | 'contradicts' | 'qualifies' | 'generalizes' | 'exception_to'

export type BlueprintStatus = 'draft' | 'in_review' | 'validated' | 'certified' | 'archived'

export type BlockId =
  | 'QUESTION'
  | 'GOAL'
  | 'SCOPE'
  | 'ASSUMPTIONS'
  | 'TERMS'
  | 'CLAIMS'
  | 'TESTS'
  | 'SYNTHESIS'

export const MANDATORY_BLOCKS: BlockId[] = [
  'QUESTION',
  'GOAL',
  'SCOPE',
  'ASSUMPTIONS',
  'TERMS',
  'CLAIMS',
  'TESTS',
  'SYNTHESIS'
]

/** Which node types satisfy which mandatory block. */
export const BLOCK_NODE_TYPES: Record<BlockId, NodeType[]> = {
  QUESTION: ['QUESTION'],
  GOAL: ['GOAL'],
  SCOPE: ['SCOPE'],
  ASSUMPTIONS: ['ASSUMPTION'],
  TERMS: ['TERM'],
  CLAIMS: ['CLAIM'],
  TESTS: ['TEST'],
  SYNTHESIS: ['DECISION']
}

export interface BpNode {
  id: string
  humanId: string // C1, A3, T7 …
  nodeType: NodeType
  title: string
  content: string
  /** CLAIM only */
  claimType?: ClaimType
  claimStatus?: ClaimStatus
  statusRationale?: string
  scopeId?: string // reference to a SCOPE node (claims + decision)
  /** ASSUMPTION only */
  assumptionJustification?: string
  /** TEST only */
  testTargetClaimId?: string
  testOutcome?: 'open' | 'passes' | 'fails' | 'inconclusive'
  /** layout */
  x: number
  y: number
  aiSuggested?: boolean
  createdAt: string
  updatedAt: string
}

export interface BpEdge {
  id: string
  from: string
  to: string
  edgeType: EdgeType
}

export type AttackVector =
  | 'scope_drift'
  | 'hidden_assumption'
  | 'weak_evidence'
  | 'logical_gap'
  | 'normative_smuggle'
  | 'circularity'
  | 'status_inflation'
  | 'untestable'

export type AttackSource = 'ai' | 'peer'
export type RequiredResponse = 'refine' | 'defend' | 'abandon'
export type ResponseState = 'open' | 'responded'

export interface AttackState {
  id: string
  source: AttackSource
  attackVector: AttackVector
  targetClaimId: string
  attackText: string
  requiredResponse: RequiredResponse | 'any'
  responseState: ResponseState
  responseAction?: RequiredResponse
  responseText?: string
  createdAt: string
  respondedAt?: string
}

export type ChangeType =
  | 'add_node'
  | 'edit_node'
  | 'delete_node'
  | 'add_edge'
  | 'remove_edge'
  | 'status_change'
  | 'attack_created'
  | 'attack_responded'
  | 'blueprint_status_change'
  | 'snapshot_created'

export type Actor = 'user' | 'ai_suggested' | 'peer_prompted'

export interface DeltaLogEntry {
  id: string
  timestamp: string
  actor: Actor
  changeType: ChangeType
  targetIds: string[]
  targetLabel: string
  reason: string
  cascadeImpacts: string[] // humanIds of downstream claims affected
}

/** The mutable working graph of a blueprint. */
export interface GraphState {
  nodes: BpNode[]
  edges: BpEdge[]
  attacks: AttackState[]
}

export interface Snapshot {
  id: string
  label: string // R-01, R-02 …
  reason: string
  createdAt: string
  hash: string
  graph: GraphState
}

export interface Blueprint {
  id: string
  title: string
  description: string
  status: BlueprintStatus
  createdAt: string
  updatedAt: string
  graph: GraphState
  snapshots: Snapshot[]
  deltaLog: DeltaLogEntry[]
  humanIdCounters: Partial<Record<NodeType, number>>
}

export interface BlueprintMeta {
  id: string
  title: string
  description: string
  status: BlueprintStatus
  updatedAt: string
  nodeCount: number
  openAttacks: number
}

/* ---------- validation ---------- */

export type ValidationErrorType =
  | 'missing_required_block'
  | 'claim_missing_type_or_status'
  | 'claim_missing_status_rationale'
  | 'claim_without_scope'
  | 'unresolved_attack'
  | 'circular_dependency_detected'
  | 'decision_without_supporting_claims'
  | 'assumption_without_justification'
  | 'contradiction_unresolved'

export type ValidationWarningType =
  | 'unused_assumption'
  | 'claim_without_test'
  | 'scope_too_broad'
  | 'secure_claim_never_attacked'
  | 'term_unused'

export interface ValidationIssue {
  type: ValidationErrorType | ValidationWarningType
  severity: 'error' | 'warning'
  message: string
  nodeIds: string[]
  blockId?: BlockId
}

export interface ValidationResult {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  blockStatus: Record<BlockId, 'missing' | 'invalid' | 'valid'>
  submittable: boolean
}

/* ---------- AI settings ---------- */

export interface AiSettings {
  /** empty ⇒ deterministic offline attack engine */
  apiBaseUrl: string
  apiKey: string
  model: string
}

export const HUMAN_ID_PREFIX: Record<NodeType, string> = {
  QUESTION: 'Q',
  GOAL: 'G',
  SCOPE: 'SC',
  ASSUMPTION: 'A',
  TERM: 'B', // Begriff
  CLAIM: 'C',
  TEST: 'T',
  DECISION: 'D',
  NOTE: 'N'
}
