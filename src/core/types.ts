/**
 * Core type definitions for Agent Persona Academy
 * These types mirror the JSON Schema in schema/persona-schema.json
 */

// ============================================================================
// Identity Types
// ============================================================================

export interface PersonaIdentity {
  /** Display name of the persona */
  name: string;
  /** Title or position */
  role: string;
  /** Credentials, expertise, and relevant history */
  background: string;
  /** Time period of primary expertise (optional) */
  era?: string;
  /** Key publications, frameworks, or contributions */
  notable_works?: string[];
}

// ============================================================================
// Voice Types
// ============================================================================

export interface PersonaVoice {
  /** Descriptive tone characteristics */
  tone: string[];
  /** Characteristic expressions this persona uses */
  phrases: string[];
  /** Communication patterns and approaches */
  style: string[];
  /** What this persona would NOT say or do */
  constraints?: string[];
}

// ============================================================================
// Framework Types
// ============================================================================

export interface FrameworkConcept {
  /** Definition of the concept */
  definition: string;
  /** Examples illustrating the concept */
  examples?: string[];
  /** Key insight about this concept */
  insight?: string;
  /** Nested subconcepts */
  subconcepts?: Record<string, string>;
}

export interface Framework {
  /** Overview of the framework */
  description: string;
  /** Key concepts within this framework */
  concepts: Record<string, FrameworkConcept>;
  /** Diagnostic questions for applying this framework */
  questions?: string[];
  /** Situations where this framework applies */
  when_to_use?: string;
  /** Frequent misapplications to avoid */
  common_mistakes?: string[];
}

// ============================================================================
// Case Study Types
// ============================================================================

export interface CaseStudy {
  /** The pattern this case illustrates */
  pattern: string;
  /** Narrative of the case */
  story: string;
  /** Indicators that this pattern applies */
  signals?: string[];
  /** Key takeaways */
  lessons?: string[];
  /** Original publication or context */
  source?: string;
}

// ============================================================================
// Analysis Pattern Types
// ============================================================================

export interface OutputSection {
  /** Name of the section */
  section: string;
  /** Purpose of this section */
  purpose?: string;
}

export interface AnalysisPatterns {
  /** Step-by-step analysis methodology */
  approach?: string[];
  /** Expected sections in analysis output */
  output_structure?: OutputSection[];
  /** How to combine multiple frameworks */
  synthesis_guidance?: string;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationMarker {
  /** Regex pattern or keyword to detect */
  pattern: string;
  /** Why this pattern matters */
  description?: string;
  /** Importance weight (1-10, default 5) */
  weight?: number;
}

export interface PersonaValidation {
  /** Patterns essential to this persona (need 80%+) */
  must_include: ValidationMarker[];
  /** Patterns that strengthen authenticity */
  should_include?: ValidationMarker[];
  /** Antipatterns that break character */
  must_avoid?: ValidationMarker[];
}

// ============================================================================
// Sample Response Types
// ============================================================================

export interface SampleResponse {
  /** User input to test */
  prompt: string;
  /** Example of high-fidelity response */
  good_response: string;
  /** Example of low-fidelity response */
  bad_response?: string;
  /** Why good is good and bad is bad */
  explanation?: string;
}

// ============================================================================
// Metadata Types
// ============================================================================

export type PersonaCategory =
  | 'business-strategist'
  | 'technical-architect'
  | 'domain-expert'
  | 'creative'
  | 'custom';

export interface PersonaMetadata {
  /** Schema version */
  version?: string;
  /** Persona author */
  author?: string;
  /** Creation date (YYYY-MM-DD) */
  created?: string;
  /** Last update date (YYYY-MM-DD) */
  updated?: string;
  /** Categorization tags */
  tags?: string[];
  /** Persona category */
  category?: PersonaCategory;
  /** Department this persona belongs to */
  department?: string;
}

// ============================================================================
// Department Types
// ============================================================================

export interface DepartmentIdentity {
  /** Display name of the department */
  name: string;
  /** Unique identifier (kebab-case) */
  id: string;
  /** Department mission statement */
  mission: string;
}

export type DepartmentChangeType =
  | 'framework_refinement'
  | 'validation_marker_change'
  | 'voice_adjustment'
  | 'case_study_addition'
  | 'constraint_addition'
  | 'constraint_removal';

export interface DepartmentValidationOverrides {
  /** Minimum fidelity score to pass */
  fidelity_threshold?: number;
  /** Minimum voice consistency score */
  voice_threshold?: number;
  /** Minimum framework coverage score */
  framework_threshold?: number;
  /** Custom weights for scoring dimensions */
  weights?: {
    fidelity?: number;
    voice?: number;
    framework?: number;
  };
}

export interface DepartmentQualityMetric {
  /** Override default validation thresholds */
  validation_overrides: DepartmentValidationOverrides;
  /** Validation patterns all department personas must avoid */
  shared_must_avoid?: ValidationMarker[];
}

export interface DepartmentLearningPolicy {
  /** Confidence threshold above which changes are auto-applied (0-1) */
  auto_apply_threshold: number;
  /** Confidence threshold below which changes are dropped (0-1) */
  review_threshold: number;
  /** Maximum number of changes per learning cycle */
  max_changes_per_cycle: number;
  /** Change types this department prefers */
  preferred_change_types?: DepartmentChangeType[];
  /** Change types that require manual review regardless of confidence */
  restricted_change_types?: DepartmentChangeType[];
}

export interface DepartmentDefinition {
  /** Department identity */
  identity: DepartmentIdentity;
  /** Quality criteria and validation overrides */
  quality_criteria: DepartmentQualityMetric;
  /** Learning policy for Sky-Lynx integration */
  learning_policy: DepartmentLearningPolicy;
  /** Persona IDs belonging to this department */
  personas: string[];
}

export interface LoadedDepartment {
  /** The parsed department definition */
  definition: DepartmentDefinition;
  /** Path to the source YAML file */
  sourcePath: string;
  /** Timestamp of when department was loaded */
  loadedAt: Date;
}

// ============================================================================
// Style Reference Types
// ============================================================================

export interface StyleReference {
  /** What this reference demonstrates */
  description: string;
  /** Key design principles this reference embodies */
  design_principles: string[];
  /** The emotional quality this design evokes */
  emotional_quality: string;
  /** Which persona frameworks this reference exemplifies */
  relevant_frameworks?: string[];
}

// ============================================================================
// Agent Config Types (for Claude Agent SDK instantiation)
// ============================================================================

export type AgentModelOption = 'haiku' | 'sonnet' | 'opus' | 'inherit';

export interface AgentToolConfig {
  /** Named tool groups to include (e.g., linear, github, coding, file) */
  groups?: string[];
  /** Individual tool names to add beyond group membership */
  additional?: string[];
  /** Individual tool names to remove from the resolved set */
  exclude?: string[];
}

export interface AgentGuardrails {
  /** Allowed bash commands (allowlist pattern) */
  bash_allowlist?: string[];
  /** Blocked regex patterns in outputs */
  blocked_patterns?: string[];
  /** Restrict file access to these paths */
  allowed_paths?: string[];
  /** Max file size in bytes for write operations */
  max_file_size?: number;
  /** Enforce read-only mode (no Write/Edit tools) */
  read_only?: boolean;
}

export interface SubagentConfig {
  /** Subagent name (maps to another persona or hardcoded agent) */
  name: string;
  /** When to delegate to this subagent */
  description: string;
  /** Override model for this subagent */
  model?: AgentModelOption;
}

export interface HilGate {
  /** Gate name */
  name: string;
  /** When this gate triggers (e.g., "before_deploy", "on_safety_concern") */
  trigger: string;
  /** Message to show the human reviewer */
  prompt: string;
}

export interface AgentConfig {
  /** Routing description for orchestrator delegation */
  description?: string;
  /** Path to system prompt markdown file, relative to the prompts directory */
  prompt_file?: string;
  /** Default model tier for this agent */
  model?: AgentModelOption;
  /** Tool configuration for this agent */
  tools?: AgentToolConfig;
  /** Maximum agentic turns before stopping */
  max_turns?: number;
  /** Safety constraints and guardrails */
  guardrails?: AgentGuardrails;
  /** Subagents this agent can delegate to */
  subagents?: SubagentConfig[];
  /** Human-in-the-loop gates */
  hil_gates?: HilGate[];
  /** MCP servers to connect */
  mcp_servers?: string[];
  /** Permission mode: acceptEdits, acceptAll, ask */
  permission_mode?: 'acceptEdits' | 'acceptAll' | 'ask';
}

// ============================================================================
// Tier Metadata Types (for Academy v2 tiering system)
// ============================================================================

export type PersonaMode = 'persona' | 'agent';

export interface GraduationGateResult {
  /** Gate identifier (e.g., G1.1, G1.2) */
  gate_id: string;
  /** Gate name */
  name: string;
  /** Whether this gate passed */
  passed: boolean;
  /** Details or error message */
  details: string;
  /** When this gate was last evaluated */
  evaluated_at: string;
}

export interface TierTransition {
  /** Previous mode */
  from_mode: PersonaMode;
  /** New mode */
  to_mode: PersonaMode;
  /** Who made the decision */
  decided_by: string;
  /** Why */
  reason: string;
  /** When */
  transitioned_at: string;
}

export interface TierMetadata {
  /** Current mode: persona or agent */
  mode: PersonaMode;
  /** When this persona was promoted to agent mode */
  promoted_at?: string;
  /** Who approved the promotion */
  promoted_by?: string;
  /** Reason for promotion */
  promotion_reason?: string;
  /** Results of graduation gate evaluations */
  graduation_gates: Record<string, GraduationGateResult>;
  /** History of mode transitions */
  history: TierTransition[];
}

// ============================================================================
// Complete Persona Definition
// ============================================================================

export interface PersonaDefinition {
  /** Core identity of the persona */
  identity: PersonaIdentity;
  /** Communication characteristics */
  voice: PersonaVoice;
  /** Mental models and analytical frameworks */
  frameworks: Record<string, Framework>;
  /** Canonical examples and stories */
  case_studies?: Record<string, CaseStudy>;
  /** How this persona approaches problems */
  analysis_patterns?: AnalysisPatterns;
  /** Fidelity markers for validation */
  validation: PersonaValidation;
  /** Modern design references for creative generation */
  style_references?: Record<string, StyleReference>;
  /** Example prompt/response pairs */
  sample_responses?: Record<string, SampleResponse>;
  /** Operational agent definition for Claude Agent SDK instantiation */
  agent_config?: AgentConfig;
  /** Administrative metadata */
  metadata?: PersonaMetadata;
}

// ============================================================================
// Prompt Generation Options
// ============================================================================

export interface PromptGenerationOptions {
  /** 'full' includes all content (default). 'lean' provides summaries with tool-call hints. */
  mode?: 'full' | 'lean';
}

// ============================================================================
// Runtime Types (for loaded/processed personas)
// ============================================================================

export interface LoadedPersona {
  /** The parsed persona definition */
  definition: PersonaDefinition;
  /** Path to the source YAML file */
  sourcePath: string;
  /** Generated system prompt */
  systemPrompt: string;
  /** Timestamp of when persona was loaded */
  loadedAt: Date;
}

export interface FidelityScore {
  /** Overall score (0-100) */
  score: number;
  /** Breakdown by category */
  breakdown: {
    must_include: { matched: number; total: number; patterns: string[] };
    should_include: { matched: number; total: number; patterns: string[] };
    must_avoid: { triggered: number; patterns: string[] };
  };
  /** Pass/fail determination */
  passed: boolean;
  /** Human-readable assessment */
  assessment: string;
}

// ============================================================================
// Tool Generation Types
// ============================================================================

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
}

export interface GeneratedTool {
  /** Tool name (snake_case) */
  name: string;
  /** Tool description for Claude */
  description: string;
  /** Input parameters */
  parameters: ToolParameter[];
  /** Frameworks to inject into prompt */
  frameworkInjection: string[];
  /** Template for generating the prompt */
  promptTemplate: string;
}

// ============================================================================
// Registry Types
// ============================================================================

export interface RegistryEntry {
  /** Unique persona identifier */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  summary: string;
  /** Author info */
  author: string;
  /** Version string */
  version: string;
  /** Category tag */
  category: PersonaCategory;
  /** All tags */
  tags: string[];
  /** Download URL or path */
  location: string;
  /** Last updated timestamp */
  updated: string;
  /** Download count (if available) */
  downloads?: number;
}

export interface RegistryIndex {
  /** Schema version for the registry */
  schema_version: string;
  /** When the index was last updated */
  updated: string;
  /** List of available personas */
  personas: RegistryEntry[];
}
