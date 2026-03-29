# Agent Persona Academy v2 -- System Architecture

**Author**: System Architect Agent
**Date**: 2026-03-02
**Status**: Design Proposal
**Scope**: Full architecture for tiered agent production (Tier 1/2/3) with Headmaster process

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Data Model for the Tiering System](#3-data-model-for-the-tiering-system)
4. [The Headmaster Process](#4-the-headmaster-process)
5. [Migration Path from Phase 13 to v2](#5-migration-path-from-phase-13-to-v2)
6. [File/Module Structure](#6-filemodule-structure)
7. [Integration Contracts](#7-integration-contracts)
8. [Open Questions and Risks](#8-open-questions-and-risks)

---

## 1. Executive Summary

Academy v1 (Phases 1-13) produces a single output type: Tier 3 persona prompt templates in YAML. These are loaded by a unified MCP server and injected into Claude as system prompts. The system works. It validates fidelity, organizes personas into departments, and integrates with Sky-Lynx for continuous improvement via the learning adapter.

Academy v2 extends this to produce three tiers of output from a single persona definition:

- **Tier 1**: Full autonomous agents (Anthropic Agent SDK) with tool calling, memory, delegation, and self-directed execution
- **Tier 2**: MCP servers with defined tools, input/output schemas, and Claude Desktop/Code integration
- **Tier 3**: Persona prompt templates (current model)

The critical architectural decision is: **the Academy remains the persona definition authority and build trigger source, but it does NOT contain build infrastructure**. Tier 1 agent builds are dispatched to YCE Harness via Metroplex. Tier 2 MCP server generation uses a code generator within the Academy. Tier 3 is the existing system, unchanged.

### System Boundary Summary

| Concern | Owner | Why |
|---------|-------|-----|
| Persona YAML definitions (all tiers) | Academy | Single source of truth for identity, voice, frameworks, validation |
| Department quality policies | Academy | Department isolation, learning policies |
| Tier assignment and graduation criteria | Academy (Headmaster) | Tier decisions are persona-domain knowledge |
| Tier 2 MCP server code generation | Academy | Template-based, deterministic, no LLM needed |
| Tier 1 agent build orchestration | Metroplex + YCE Harness | Build infrastructure already exists and is proven |
| Performance metrics and outcome tracking | ST Records | Already stores outcome_records, persona_patches, improvement_recommendations |
| Persona patches (YAML modifications) | Metroplex (PatchGate) | Already applies patches via git operations |
| Continuous improvement recommendations | Sky-Lynx + ST Records | Already produces typed ImprovementRecommendations |

---

## 2. High-Level Architecture

### 2.1 Component Diagram

```
                                    ACADEMY v2
 ================================================================
 |                                                                |
 |  ┌─────────────────────────────────────────────────────────┐  |
 |  |                    HEADMASTER                            |  |
 |  |  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  |  |
 |  |  | Evaluator |  | Tier     |  | Graduation           |  |  |
 |  |  | (assess   |  | Assigner |  | Engine               |  |  |
 |  |  |  concept) |  | (T1/2/3) |  | (promote/demote/     |  |  |
 |  |  |           |  |          |  |  retire)              |  |  |
 |  |  └──────────┘  └──────────┘  └──────────────────────┘  |  |
 |  └──────────┬───────────┬──────────────┬───────────────────┘  |
 |             |           |              |                       |
 |  ┌──────────▼───────────▼──────────────▼───────────────────┐  |
 |  |                PERSONA STORE (YAML)                      |  |
 |  |  personas/<id>/persona.yaml     (identity, voice, etc.)  |  |
 |  |  personas/<id>/tier.yaml        (tier metadata, NEW)     |  |
 |  |  personas/<id>/agent_config     (Tier 1 config)          |  |
 |  |  personas/<id>/mcp_config.yaml  (Tier 2 config, NEW)     |  |
 |  └──────────┬───────────┬──────────────┬───────────────────┘  |
 |             |           |              |                       |
 |  ┌──────────▼──┐ ┌──────▼──────┐ ┌────▼────────────────┐     |
 |  | CORE ENGINE | | DEPARTMENTS | | BUILDERS             |     |
 |  | (loader,    | | (manager,   | | ┌─────────────────┐  |     |
 |  |  validator, | |  learning   | | | Tier2Generator  |  |     |
 |  |  prompt     | |  adapter)   | | | (MCP codegen)   |  |     |
 |  |  gen)       | |             | | └─────────────────┘  |     |
 |  └─────────────┘ └─────────────┘ | ┌─────────────────┐  |     |
 |                                   | | Tier1Dispatcher |  |     |
 |                                   | | (spec -> queue) |  |     |
 |                                   | └─────────────────┘  |     |
 |                                   └──────────────────────┘     |
 |                                                                |
 |  ┌─────────────────────────────────────────────────────────┐  |
 |  |              UNIFIED MCP SERVER (extended)               |  |
 |  |  Existing 7 tools + new: evaluate_concept,               |  |
 |  |  get_tier_status, trigger_build, list_graduates           |  |
 |  └─────────────────────────────────────────────────────────┘  |
 |                                                                |
 |  ┌─────────────────────────────────────────────────────────┐  |
 |  |              CLI (extended)                              |  |
 |  |  Existing commands + new: tier, graduate, build-mcp,     |  |
 |  |  headmaster                                              |  |
 |  └─────────────────────────────────────────────────────────┘  |
 |                                                                |
 ================================================================

         EXTERNAL SYSTEMS (unchanged, accessed via contracts)
 ================================================================

 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 | ST FACTORY   |  | METROPLEX    |  | YCE HARNESS  |
 | - outcome    |  | - TriageGate |  | - Agent SDK  |
 |   records    |  | - BuildOrch. |  |   client     |
 | - improve.   |  | - PatchGate  |  | - worktrees  |
 |   recomm.    |  | - PublishGate|  | - queue      |
 | - persona    |  | - PriorityQ  |  |   runner     |
 |   patches    |  |              |  |              |
 | - research   |  |              |  |              |
 |   signals    |  |              |  |              |
 └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
        |                 |                  |
        └─────────────────┼──────────────────┘
                          |
              Contracts: JSONL + SQLite
              (improvement_recommendation.py,
               persona_upgrade_patch.py,
               outcome_record.py)
```

### 2.2 Data Flow: Concept to Deployed Agent

```
 1. NEW CONCEPT ARRIVES
    (manual persona-academy create, Ultra-Magnus idea, or Sky-Lynx recommendation)
           |
           v
 2. HEADMASTER EVALUATES
    - Is this a persona (voice/frameworks) or an operational agent (tools/delegation)?
    - What tier fits? (complexity, tooling needs, autonomy requirements)
    - What department?
    - Graduation criteria assigned
           |
           v
 3. PERSONA YAML CREATED/UPDATED
    - persona.yaml: identity, voice, frameworks, validation
    - tier.yaml: assigned tier, graduation criteria, metrics history
    - agent_config (Tier 1): SDK config, tool groups, model, prompt_file
    - mcp_config.yaml (Tier 2): tool schemas, server config
           |
           v
 4. TIER-SPECIFIC BUILD
    ┌─────────┬─────────────┬────────────────────┐
    | Tier 3  | Tier 2      | Tier 1             |
    | (done)  | Academy     | Metroplex ->       |
    | YAML is | generates   | YCE Harness        |
    | the     | MCP server  | builds full        |
    | output  | from        | Agent SDK          |
    |         | template    | project            |
    └─────────┴─────────────┴────────────────────┘
           |
           v
 5. VALIDATION
    - Tier 3: fidelity score (existing)
    - Tier 2: schema validation + tool schema check + fidelity
    - Tier 1: build success + test pass + fidelity + runtime metrics
           |
           v
 6. DEPLOYMENT & MONITORING
    - Tier 3: loaded by unified MCP server
    - Tier 2: deployed as standalone MCP server (npm run build)
    - Tier 1: deployed via Metroplex PublishGate
    - All tiers: metrics tracked in ST Records
           |
           v
 7. GRADUATION LOOP
    - Headmaster reviews metrics from ST Records
    - Promote: T3 -> T2 (add MCP tools), T2 -> T1 (add autonomy)
    - Demote: T1 -> T2 (remove autonomy), T2 -> T3 (remove tools)
    - Retire: remove from active roster
```

---

## 3. Data Model for the Tiering System

### 3.1 Tier Definition

```typescript
// New type in src/core/types.ts

export type AgentTier = 1 | 2 | 3;

export interface TierMetadata {
  /** Current assigned tier */
  current_tier: AgentTier;
  /** Tier the persona started at */
  initial_tier: AgentTier;
  /** When the current tier was assigned */
  tier_assigned_at: string; // ISO 8601
  /** Who/what assigned this tier */
  tier_assigned_by: 'headmaster' | 'manual';
  /** Graduation criteria for promotion to next tier */
  graduation_criteria?: GraduationCriteria;
  /** History of tier changes */
  tier_history: TierTransition[];
  /** Current graduation progress */
  graduation_progress?: GraduationProgress;
}

export interface GraduationCriteria {
  /** Target tier to promote to */
  target_tier: AgentTier;
  /** Minimum fidelity score sustained over N evaluations */
  min_fidelity: number;
  /** Number of consecutive evaluations above threshold */
  sustained_evaluations: number;
  /** Minimum number of successful tool invocations (Tier 2+) */
  min_tool_invocations?: number;
  /** Minimum number of successful autonomous runs (Tier 1) */
  min_autonomous_runs?: number;
  /** Maximum error rate over evaluation window */
  max_error_rate?: number;
  /** Custom criteria (key-value, evaluated by Headmaster) */
  custom?: Record<string, string>;
}

export interface GraduationProgress {
  /** Current consecutive evaluations above fidelity threshold */
  consecutive_passing: number;
  /** Total tool invocations tracked */
  tool_invocations: number;
  /** Total autonomous runs tracked */
  autonomous_runs: number;
  /** Current error rate */
  error_rate: number;
  /** Last evaluation timestamp */
  last_evaluated: string;
  /** Whether all criteria are currently met */
  ready_to_graduate: boolean;
}

export interface TierTransition {
  /** From tier */
  from_tier: AgentTier;
  /** To tier */
  to_tier: AgentTier;
  /** When transition occurred */
  transitioned_at: string;
  /** Reason for transition */
  reason: string;
  /** Who/what triggered it */
  triggered_by: 'headmaster' | 'manual';
}
```

### 3.2 Tier Storage: `personas/<id>/tier.yaml`

Each persona gets a `tier.yaml` alongside `persona.yaml`. This separation keeps tier lifecycle metadata out of the persona definition itself, which remains focused on identity/voice/frameworks.

```yaml
# personas/carmack/tier.yaml
current_tier: 3
initial_tier: 3
tier_assigned_at: "2026-03-02T00:00:00Z"
tier_assigned_by: manual

graduation_criteria:
  target_tier: 2
  min_fidelity: 80
  sustained_evaluations: 5
  min_tool_invocations: 0

graduation_progress:
  consecutive_passing: 3
  tool_invocations: 0
  autonomous_runs: 0
  error_rate: 0
  last_evaluated: "2026-03-01T14:00:00Z"
  ready_to_graduate: false

tier_history: []
```

### 3.3 Tier 2 MCP Config: `personas/<id>/mcp_config.yaml`

Only present for Tier 2 personas. Defines the tools the generated MCP server will expose.

```yaml
# personas/carmack/mcp_config.yaml (when promoted to Tier 2)
server:
  name: "carmack-advisor"
  version: "1.0.0"
  description: "Systems architecture review with Carmack's frameworks"

tools:
  - name: "architecture_review"
    description: "Review a system architecture through Carmack's lens"
    input_schema:
      type: object
      properties:
        system_description:
          type: string
          description: "Description of the system to review"
        constraints:
          type: string
          description: "Hard constraints (latency, memory, team, deadline)"
      required: ["system_description"]
    frameworks_to_inject:
      - ruthless_simplicity
      - measure_first_optimization
      - vertical_slice_delivery

  - name: "performance_review"
    description: "Review performance claims against measurement data"
    input_schema:
      type: object
      properties:
        claim:
          type: string
          description: "The performance claim to evaluate"
        measurements:
          type: string
          description: "Available measurement data"
      required: ["claim"]
    frameworks_to_inject:
      - measure_first_optimization
      - constraint_driven_engineering
```

### 3.4 Tier 1 Agent Config (existing `agent_config` in `persona.yaml`)

The existing `agent_config` section in `persona.yaml` already models Tier 1 agent configuration. It is already consumed by YCE Harness via `agents/yaml_loader.py`. No changes needed to the schema -- only to the process that triggers builds.

Existing schema reference (`src/core/types.ts`, lines 263-283):
```typescript
export interface AgentConfig {
  description?: string;
  prompt_file?: string;
  model?: AgentModelOption;  // 'haiku' | 'sonnet' | 'opus' | 'inherit'
  tools?: AgentToolConfig;   // groups[], additional[], exclude[]
}
```

### 3.5 What Each Tier Carries

| Field | Tier 3 | Tier 2 | Tier 1 |
|-------|--------|--------|--------|
| `persona.yaml` (identity, voice, frameworks, validation) | Required | Required | Required |
| `tier.yaml` (tier metadata, graduation) | Required | Required | Required |
| `metadata.department` | Required | Required | Required |
| `sample_responses` | Required | Required | Optional |
| `mcp_config.yaml` | N/A | Required | Optional |
| `agent_config` (in persona.yaml) | N/A | N/A | Required |
| `prompt_file` (in agent_config) | N/A | N/A | Required |
| Generated MCP server code | N/A | `generated/` | N/A |
| Generated Agent SDK project | N/A | N/A | Via YCE Harness |

---

## 4. The Headmaster Process

### 4.1 What is the Headmaster?

The Headmaster is a **CLI command with an optional cron schedule**. It is NOT an always-on agent. It is NOT an MCP tool (though some of its outputs are surfaced via MCP tools).

Rationale:
- An always-on agent wastes resources when there is nothing to evaluate (most of the time)
- A CLI command can be triggered manually (`persona-academy headmaster run`) or on cron
- Cron cadence: daily at 6am is sufficient -- tier evaluations do not need real-time responsiveness
- MCP tools expose read-only status queries, not the decision loop itself

### 4.2 Headmaster Decision Loop

```
 HEADMASTER RUN
 ==============

 1. SCAN: Load all personas with tier.yaml
    - For each persona, load current tier, graduation criteria, progress

 2. INTAKE: Check for new agent concepts
    - Sources:
      a. Manual: new persona.yaml without tier.yaml -> needs evaluation
      b. ST Records: improvement_recommendations with target_system = 'new_agent'
      c. Ultra-Magnus: ideas tagged 'agent-concept' at BUILD stage
    - For each concept: run Tier Assignment

 3. TIER ASSIGNMENT (for new concepts)
    Input: concept description, capabilities needed, tooling requirements
    Decision tree:
      - Has agent_config with tools.groups? -> Tier 1 candidate
      - Has mcp_config.yaml with tool definitions? -> Tier 2 candidate
      - Identity + voice + frameworks only? -> Tier 3
    Set initial graduation_criteria based on department defaults
    Write tier.yaml

 4. GRADUATION EVALUATION (for existing personas)
    For each persona with graduation_criteria:
      a. Read metrics from ST Records:
         - outcome_records for this persona
         - fidelity scores from most recent evaluations
         - tool invocation counts (if applicable)
         - error rates
      b. Update graduation_progress in tier.yaml
      c. If ready_to_graduate:
         - Tier 3 -> 2: Generate mcp_config.yaml from frameworks, run Tier2Generator
         - Tier 2 -> 1: Validate agent_config exists, dispatch build via Tier1Dispatcher
         - Record TierTransition in tier_history
      d. If performance degraded below demotion threshold:
         - Tier 1 -> 2: Revoke agent_config active status
         - Tier 2 -> 3: Remove generated MCP server
         - Record TierTransition with reason

 5. BUILD TRIGGERS
    - Tier 2 promotions: run Tier2Generator inline (fast, template-based)
    - Tier 1 promotions: write spec to data/specs/, enqueue via Metroplex priority queue
      (source = "academy", priority = department learning_policy weight)

 6. REPORT
    Output a summary: new concepts evaluated, graduations, demotions, build triggers
    Write to outputs/headmaster_runs/<timestamp>.json
```

### 4.3 Headmaster State Management

The Headmaster is stateless between runs. All state is persisted in:
- `personas/<id>/tier.yaml` -- tier metadata, graduation progress
- ST Records DB -- outcome records, metrics
- Metroplex DB -- build status (if Tier 1 builds were triggered)
- `outputs/headmaster_runs/` -- run logs (append-only, for audit)

This means the Headmaster can be killed, restarted, or run on any schedule without state corruption. Each run reads current state, makes decisions, writes updated state.

### 4.4 Headmaster Inputs and Outputs

```
INPUTS:
  - personas/*/persona.yaml (persona definitions)
  - personas/*/tier.yaml (tier state)
  - departments/*/department.yaml (quality criteria, graduation defaults)
  - ST Records DB: outcome_records, improvement_recommendations
  - Metroplex DB: build_jobs (for Tier 1 build status)

OUTPUTS:
  - Updated personas/*/tier.yaml (graduation progress, tier transitions)
  - New personas/*/mcp_config.yaml (on Tier 2 promotion)
  - New personas/*/generated/ (on Tier 2 MCP server generation)
  - Metroplex priority queue entries (on Tier 1 build trigger)
  - outputs/headmaster_runs/<timestamp>.json (run log)
```

### 4.5 Headmaster CLI Interface

```bash
# Run full Headmaster cycle (intake + evaluation + builds)
persona-academy headmaster run [--dry-run]

# Evaluate a single persona
persona-academy headmaster evaluate <persona-id> [--dry-run]

# Force-promote a persona to a specific tier
persona-academy headmaster promote <persona-id> --tier <1|2|3> --reason "manual override"

# Force-demote a persona
persona-academy headmaster demote <persona-id> --tier <1|2|3> --reason "performance regression"

# Show graduation status for all personas
persona-academy headmaster status

# Show graduation status for one persona
persona-academy headmaster status <persona-id>
```

### 4.6 Cron Configuration

```bash
# Daily Headmaster run at 6am
0 6 * * * cd /home/apexaipc/projects/agent-persona-academy && node dist/cli/index.js headmaster run >> /var/log/academy-headmaster.log 2>&1
```

---

## 5. Migration Path from Phase 13 to v2

### 5.1 What Stays Unchanged

These components are proven and require zero modifications:

| Component | Path | Reason |
|-----------|------|--------|
| Core types | `src/core/types.ts` | Extended, not modified (new types added) |
| Persona loader | `src/core/persona-loader.ts` | YAML loading unchanged |
| Validation engine | `src/core/validation-engine.ts` | Fidelity scoring unchanged |
| Department system | `src/departments/*` | Department isolation unchanged |
| Learning adapter | `src/departments/learning-adapter.ts` | Sky-Lynx bridge unchanged |
| Unified MCP server | `src/unified-server/*` | Extended with new tools, core unchanged |
| CLI framework | `src/cli/index.ts` | New commands added, existing unchanged |
| Validation suite | `src/validation/*` | Report/compare/coverage unchanged |
| Registry | `src/registry/*` | GitHub registry unchanged |
| All persona YAMLs | `personas/*` | Identity/voice/frameworks unchanged |
| Department YAMLs | `departments/*` | Quality criteria unchanged |
| CI/CD workflow | `.github/workflows/*` | Extended, not replaced |

### 5.2 What Gets Extended

| Component | Change | Risk |
|-----------|--------|------|
| `src/core/types.ts` | Add `TierMetadata`, `GraduationCriteria`, `GraduationProgress`, `TierTransition`, `AgentTier`, `Tier2Config` types | Low -- additive only |
| `src/unified-server/tools.ts` | Add 4 new MCP tools: `evaluate_concept`, `get_tier_status`, `trigger_build`, `list_graduates` | Low -- additive, existing tools untouched |
| `src/cli/index.ts` | Register new `headmaster`, `tier`, `build-mcp` commands | Low -- additive |
| `package.json` | Add `@anthropic-ai/claude-code-sdk` as optional peer dependency (for Tier 1 type references only) | Low -- optional dep |
| `schema/persona-schema.json` | No change needed -- `agent_config` already in schema | None |

### 5.3 What Gets Added (New Modules)

| Module | Purpose | Depends On |
|--------|---------|------------|
| `src/headmaster/` | Headmaster process: evaluator, tier-assigner, graduation engine | core, departments, st-records reader |
| `src/headmaster/evaluator.ts` | Assess incoming concepts, determine initial tier | core types |
| `src/headmaster/tier-assigner.ts` | Assign tier based on concept complexity | core types, departments |
| `src/headmaster/graduation-engine.ts` | Evaluate graduation criteria against metrics | ST Records reader, core types |
| `src/headmaster/index.ts` | Orchestrate full Headmaster run cycle | All headmaster modules |
| `src/builders/` | Tier-specific build logic | core types |
| `src/builders/tier2-generator.ts` | Generate MCP server from mcp_config.yaml + persona YAML | core, templates |
| `src/builders/tier1-dispatcher.ts` | Write spec, enqueue to Metroplex priority queue | Metroplex DB path |
| `src/builders/index.ts` | Builder dispatch | tier2-generator, tier1-dispatcher |
| `src/readers/stfactory-reader.ts` | Read-only SQLite reader for ST Records metrics | sqlite3 (via better-sqlite3) |
| `src/cli/commands/headmaster.ts` | CLI commands for Headmaster | headmaster module |
| `src/cli/commands/tier.ts` | CLI commands for tier inspection | core types, persona loader |
| `src/cli/commands/build-mcp.ts` | CLI command for manual Tier 2 build | tier2-generator |
| `templates/mcp-server/` | Template files for Tier 2 MCP server generation | N/A (static files) |

### 5.4 What Breaks (Breaking Changes)

**Nothing in the existing system breaks.** The migration is purely additive. Key safeguards:

1. **Existing personas without `tier.yaml`**: The Headmaster treats these as Tier 3 by default. The first Headmaster run creates `tier.yaml` for all existing personas with `current_tier: 3`.

2. **Existing MCP server**: All 7 existing tools remain unchanged. New tools are added alongside them.

3. **Existing CLI**: All existing commands remain unchanged. New commands are added.

4. **Existing CI/CD**: The validation workflow continues to work. A new CI step for tier validation is additive.

5. **Existing ST Records integration**: The learning adapter continues to work. The Headmaster reads from ST Records but does not write to it.

### 5.5 Phased Migration Plan

```
Phase 14: Foundation (Tier infrastructure)
  14.1  Add tier types to src/core/types.ts
  14.2  Create src/headmaster/ with evaluator and tier-assigner
  14.3  Create src/readers/stfactory-reader.ts
  14.4  Create persona-academy tier CLI command
  14.5  Bootstrap tier.yaml for all 10 existing personas (all start at Tier 3)
  14.6  Add schema/tier-schema.json
  14.7  Tests for tier assignment logic

Phase 15: Headmaster Core
  15.1  Create graduation-engine.ts
  15.2  Create headmaster/index.ts orchestrator
  15.3  Create persona-academy headmaster CLI commands
  15.4  Integrate ST Records reader for metrics
  15.5  Create outputs/headmaster_runs/ logging
  15.6  Tests for graduation evaluation

Phase 16: Tier 2 Builder
  16.1  Design mcp_config.yaml schema (schema/mcp-config-schema.json)
  16.2  Create templates/mcp-server/ with TypeScript MCP server template
  16.3  Create src/builders/tier2-generator.ts
  16.4  Create persona-academy build-mcp CLI command
  16.5  Manually promote one persona (e.g., carmack) to Tier 2 for testing
  16.6  Tests for Tier 2 generation

Phase 17: Tier 1 Dispatcher
  17.1  Create src/builders/tier1-dispatcher.ts
  17.2  Integrate with Metroplex priority queue (direct SQLite write)
  17.3  Create app spec template for Academy-sourced builds
  17.4  Tests for dispatch logic

Phase 18: MCP Server + Automation
  18.1  Add new tools to unified MCP server
  18.2  Set up cron for daily Headmaster run
  18.3  Update CI/CD to validate tier.yaml files
  18.4  End-to-end test: concept -> tier assignment -> graduation -> build
```

---

## 6. File/Module Structure

### 6.1 New Directory Tree

```
agent-persona-academy/
|-- BLUEPRINT.md                          # Updated with Phases 14-18
|-- CLAUDE.md                             # Updated with new commands
|-- package.json                          # Updated deps
|-- schema/
|   |-- persona-schema.json               # UNCHANGED
|   |-- department-schema.json            # UNCHANGED
|   |-- tier-schema.json                  # NEW: validates tier.yaml
|   |-- mcp-config-schema.json            # NEW: validates mcp_config.yaml
|
|-- departments/                          # UNCHANGED
|   |-- engineering/department.yaml
|   |-- business-strategy/department.yaml
|   |-- operations/department.yaml
|   |-- creative/department.yaml
|
|-- personas/
|   |-- carmack/
|   |   |-- persona.yaml                  # UNCHANGED
|   |   |-- tier.yaml                     # NEW: tier metadata
|   |   |-- mcp_config.yaml              # NEW: when promoted to Tier 2
|   |   |-- generated/                    # NEW: Tier 2 MCP server output
|   |       |-- src/
|   |       |-- package.json
|   |       |-- tsconfig.json
|   |-- christensen/
|   |   |-- persona.yaml
|   |   |-- tier.yaml                     # NEW
|   |-- sky-lynx/
|   |   |-- persona.yaml
|   |   |-- tier.yaml                     # NEW
|   |-- ... (other personas)
|
|-- src/
|   |-- core/
|   |   |-- types.ts                      # EXTENDED: TierMetadata, etc.
|   |   |-- persona-loader.ts             # UNCHANGED
|   |   |-- validation-engine.ts          # UNCHANGED
|   |   |-- index.ts                      # EXTENDED: re-export new types
|   |   |-- __tests__/
|   |       |-- persona-loader.test.ts    # UNCHANGED
|   |       |-- validation-engine.test.ts # UNCHANGED
|   |
|   |-- departments/                      # UNCHANGED
|   |   |-- department-loader.ts
|   |   |-- department-manager.ts
|   |   |-- learning-adapter.ts
|   |   |-- index.ts
|   |   |-- __tests__/
|   |
|   |-- headmaster/                       # NEW MODULE
|   |   |-- evaluator.ts                  # Concept evaluation + tier assignment
|   |   |-- tier-assigner.ts              # Tier assignment decision tree
|   |   |-- graduation-engine.ts          # Graduation criteria evaluation
|   |   |-- tier-loader.ts                # Load/save tier.yaml files
|   |   |-- index.ts                      # Headmaster run orchestrator
|   |   |-- __tests__/
|   |       |-- evaluator.test.ts
|   |       |-- tier-assigner.test.ts
|   |       |-- graduation-engine.test.ts
|   |
|   |-- builders/                         # NEW MODULE
|   |   |-- tier2-generator.ts            # Generate MCP server from template
|   |   |-- tier1-dispatcher.ts           # Dispatch Tier 1 build to Metroplex
|   |   |-- index.ts
|   |   |-- __tests__/
|   |       |-- tier2-generator.test.ts
|   |       |-- tier1-dispatcher.test.ts
|   |
|   |-- readers/                          # NEW MODULE
|   |   |-- stfactory-reader.ts           # Read ST Records metrics via SQLite
|   |   |-- metroplex-reader.ts           # Read Metroplex build status
|   |   |-- index.ts
|   |   |-- __tests__/
|   |       |-- stfactory-reader.test.ts
|   |
|   |-- unified-server/                   # EXTENDED
|   |   |-- persona-manager.ts            # UNCHANGED
|   |   |-- tools.ts                      # EXTENDED: 4 new tools
|   |   |-- index.ts                      # UNCHANGED
|   |   |-- __tests__/
|   |       |-- tools.test.ts             # EXTENDED
|   |
|   |-- validation/                       # UNCHANGED
|   |-- registry/                         # UNCHANGED
|   |
|   |-- cli/
|   |   |-- index.ts                      # EXTENDED: register new commands
|   |   |-- commands/
|   |       |-- cache.ts                  # UNCHANGED
|   |       |-- compare.ts               # UNCHANGED
|   |       |-- create.ts                # UNCHANGED
|   |       |-- department.ts            # UNCHANGED
|   |       |-- info.ts                  # UNCHANGED
|   |       |-- list.ts                  # UNCHANGED
|   |       |-- pull.ts                  # UNCHANGED
|   |       |-- remote.ts               # UNCHANGED
|   |       |-- report.ts               # UNCHANGED
|   |       |-- serve.ts                # UNCHANGED
|   |       |-- test.ts                 # UNCHANGED
|   |       |-- validate.ts             # UNCHANGED
|   |       |-- headmaster.ts           # NEW: headmaster run/evaluate/promote/demote/status
|   |       |-- tier.ts                 # NEW: tier info/list
|   |       |-- build-mcp.ts            # NEW: manual Tier 2 build trigger
|
|-- templates/
|   |-- persona.yaml.template            # UNCHANGED
|   |-- mcp-server/                       # NEW: Tier 2 MCP server template
|       |-- src/
|       |   |-- index.ts.template
|       |   |-- tools.ts.template
|       |-- package.json.template
|       |-- tsconfig.json.template
|
|-- outputs/
|   |-- headmaster_runs/                  # NEW: Headmaster run logs
|   |-- academy_redesign/                 # NEW: This document
```

### 6.2 Module Dependency Graph

```
                         ┌──────────────┐
                         |  CLI         |
                         |  commands/*  |
                         └──────┬───────┘
                                |
              ┌─────────────────┼─────────────────┐
              |                 |                   |
     ┌────────▼───────┐ ┌──────▼───────┐  ┌───────▼──────┐
     |  headmaster/   | |  builders/   |  |  unified-    |
     |  (evaluator,   | |  (tier2-gen, |  |  server/     |
     |   graduation)  | |   tier1-disp)|  |  (tools,     |
     |                | |              |  |   manager)   |
     └───┬──────┬─────┘ └──────┬───────┘  └───────┬──────┘
         |      |              |                   |
         |      |       ┌──────▼───────┐           |
         |      |       |  templates/  |           |
         |      |       |  mcp-server/ |           |
         |      |       └──────────────┘           |
         |      |                                  |
    ┌────▼──────▼──────────────────────────────────▼─────┐
    |                    core/                            |
    |  (types, persona-loader, validation-engine)        |
    └────────────────────────┬───────────────────────────┘
                             |
              ┌──────────────┼──────────────┐
              |              |              |
     ┌────────▼───┐  ┌──────▼─────┐  ┌─────▼────────┐
     | departments |  | validation |  | registry     |
     | (manager,   |  | (voice,    |  | (github,     |
     |  learning)  |  |  coverage) |  |  cache)      |
     └─────────────┘  └────────────┘  └──────────────┘

              External (read-only access via src/readers/)
     ┌───────────────┐  ┌───────────────┐
     | ST Records DB |  | Metroplex DB  |
     | (metrics)     |  | (build status)|
     └───────────────┘  └───────────────┘
```

---

## 7. Integration Contracts

### 7.1 Academy -> ST Records (Read-Only)

The Academy reads from ST Records's SQLite database at `/home/apexaipc/projects/st-records/data/persona_metrics.db` using a new `src/readers/stfactory-reader.ts` module. This mirrors what Metroplex already does (`readers/stfactory_reader.py`) but in TypeScript with `better-sqlite3`.

Tables read:
- `outcome_records`: persona performance outcomes (fidelity scores, build results)
- `improvement_recommendations`: pending recommendations (for new agent concept intake)
- `persona_patches`: patch history (for graduation progress tracking)

The Academy NEVER writes to ST Records. The feedback loop is:
```
Academy (persona definition) -> YCE Harness (build) -> ST Records (metrics) -> Academy (read metrics for graduation)
```

### 7.2 Academy -> Metroplex (Write to Priority Queue)

When the Headmaster promotes a persona to Tier 1, it writes a build spec and enqueues a priority queue item in Metroplex's state DB at `/home/apexaipc/projects/metroplex/data/metroplex.db`. The priority queue item has `source = "academy"` and carries the persona ID, spec path, and build parameters.

This is the same pattern Metroplex uses for IdeaForge and Linear intake. The build gate (`gates/build.py`, `run_from_queue()`) already filters by source -- it only builds `ideaforge` and `linear` sources. This filter needs to be extended to include `academy`.

Change required in Metroplex (`gates/build.py`, line 610):
```python
# Current:
buildable_sources = ("ideaforge", "linear")
# Updated:
buildable_sources = ("ideaforge", "linear", "academy")
```

### 7.3 Academy -> YCE Harness (via Metroplex Build Gate)

No direct integration. The Academy's Tier 1 builds flow through Metroplex's existing build pipeline:
1. Academy Headmaster enqueues spec to Metroplex priority queue
2. Metroplex BuildOrchestrator generates app spec via SpecGenerator
3. Metroplex dispatches to YCE Harness queue_runner.py
4. YCE Harness builds the agent using Claude Agent SDK
5. Build results are tracked in Metroplex build_jobs table

The YCE Harness `agents/yaml_loader.py` already knows how to read `agent_config` from persona YAML files. This is the runtime loading path for Tier 1 agents. The build path produces the project; the YAML loader provides the agent definition at runtime.

### 7.4 Sky-Lynx -> Academy (via ST Records Contracts)

Unchanged. Sky-Lynx writes `ImprovementRecommendation` contracts to ST Records. The Academy's learning adapter (`src/departments/learning-adapter.ts`) reads and evaluates them against department policies. The Headmaster adds a new intake path: recommendations with `target_system = 'new_agent'` trigger Tier Assignment instead of being processed as persona patches.

### 7.5 Metroplex PatchGate -> Academy (via Git)

Unchanged. Metroplex PatchGate reads proposed patches from ST Records, clones the Academy repo, applies YAML patches, and pushes via git. This workflow is unaffected by the tiering system because patches target `persona.yaml` files, not `tier.yaml` files. Tier transitions are managed by the Headmaster, not by patches.

---

## 8. Open Questions and Risks

### 8.1 Open Questions

1. **Tier 2 MCP server deployment**: Where do generated MCP servers get deployed? Options:
   a. Stay in `personas/<id>/generated/` and are built/served locally
   b. Published to the GitHub registry alongside persona YAML
   c. Published as npm packages
   Recommendation: Option (a) for now, extend to (b) when the registry matures.

2. **Tier 1 agent runtime hosting**: Tier 1 agents need a runtime environment (Python venv, node_modules, etc.). Do they run:
   a. As YCE Harness workers (current model)
   b. As standalone services on the ProBook
   c. Deployed to cloud (Railway, etc.)
   Recommendation: Option (a) for initial builds, then (c) via Metroplex PublishGate for production.

3. **Graduation metrics source**: ST Records currently tracks outcome records at the idea/build level, not at the persona level. Per-persona metrics would require:
   a. A new `persona_outcomes` table in ST Records
   b. Tagging existing outcome_records with the persona that produced them
   Recommendation: Option (b) -- add `persona_id` column to outcome_records.

4. **Department graduation defaults**: Should each department define default graduation criteria, or should the Headmaster compute them? Recommendation: Departments define them as optional fields in `department.yaml`, Headmaster uses them as defaults when creating `tier.yaml` for new personas.

### 8.2 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tier 2 codegen produces broken MCP servers | Tier 2 builds fail silently | Schema validation + `npm run build` + `npm test` in generated server |
| Headmaster promotes too aggressively | Resources wasted on premature Tier 1 builds | Conservative graduation criteria (5+ consecutive passing evaluations) |
| ST Records DB schema changes break reader | Headmaster crashes on stale schema | Version check on reader init, graceful degradation to Tier 3 defaults |
| Metroplex priority queue contention | Academy builds compete with IdeaForge builds | Academy uses lower priority weight (0.8) vs IdeaForge (1.0) |
| Persona YAML backward compatibility | Old personas fail new validation | All new fields optional, Headmaster bootstraps defaults |
| Tier 1 builds are expensive (Claude API costs) | Budget overrun | max_tier1_builds_per_day config in Headmaster |

### 8.3 Non-Goals (Explicitly Out of Scope)

- **Multi-model agent support**: Tier 1 agents use Claude only (Anthropic Agent SDK). Other LLMs are out of scope.
- **Agent-to-agent communication**: Tier 1 agents do not communicate with each other. Orchestration is via YCE Harness's existing orchestrator pattern.
- **Real-time monitoring dashboard**: Monitoring is via ST Records dashboard and EAC Command Center. No new UI.
- **Automatic demotion**: Demotion requires manual confirmation or Headmaster CLI command. Automatic demotion is deferred to avoid oscillation.

---

## Appendix A: Existing Code References

All paths are absolute from `/home/apexaipc/projects/`.

### Academy (TypeScript ESM)
- Types: `agent-persona-academy/src/core/types.ts` -- `PersonaDefinition`, `AgentConfig`, `DepartmentDefinition`
- Persona loader: `agent-persona-academy/src/core/persona-loader.ts`
- Validation: `agent-persona-academy/src/core/validation-engine.ts`
- Department manager: `agent-persona-academy/src/departments/department-manager.ts`
- Learning adapter: `agent-persona-academy/src/departments/learning-adapter.ts`
- MCP tools: `agent-persona-academy/src/unified-server/tools.ts` (7 tools, `ALL_TOOLS` array)
- MCP server: `agent-persona-academy/src/unified-server/index.ts`
- CLI entry: `agent-persona-academy/src/cli/index.ts`
- Schema: `agent-persona-academy/schema/persona-schema.json`, `schema/department-schema.json`

### ST Records (Python, Pydantic)
- ContractStore: `st-records/contracts/store.py` -- dual-write JSONL + SQLite
- ImprovementRecommendation: `st-records/contracts/improvement_recommendation.py`
- PersonaUpgradePatch: `st-records/contracts/persona_upgrade_patch.py`
- OutcomeRecord: `st-records/contracts/outcome_record.py`
- DB: `st-records/data/persona_metrics.db`

### Metroplex (Python)
- Config: `metroplex/config.py` -- `academy_repo`, `stfactory_db`, `yce_dir`
- Orchestrator: `metroplex/orchestrator.py` -- `CycleOrchestrator.run_cycle()`
- Build gate: `metroplex/gates/build.py` -- `BuildOrchestrator.run_from_queue()`, `buildable_sources` on line 610
- Patch gate: `metroplex/gates/patcher.py` -- `PatchGate.run()`
- ST Records reader: `metroplex/readers/stfactory_reader.py`

### YCE Harness (Python, Claude Agent SDK)
- Agent definitions: `yce-harness/agents/definitions.py` -- `AgentDefinition`, `AGENT_DEFINITIONS`
- YAML loader: `yce-harness/agents/yaml_loader.py` -- `load_agent_from_yaml()`, `load_all_agents_from_yaml()`
- Orchestrator: `yce-harness/agents/orchestrator.py` -- `run_orchestrated_session()`
- Queue runner: `yce-harness/queue_runner.py`

---

## Appendix B: Tier Assignment Decision Tree (Pseudocode)

```typescript
function assignTier(concept: PersonaDefinition): AgentTier {
  // Tier 1: Has agent_config with tool groups AND prompt_file
  if (concept.agent_config?.tools?.groups?.length > 0 &&
      concept.agent_config?.prompt_file) {
    return 1;
  }

  // Tier 2: Has 3+ frameworks with diagnostic questions
  // AND analysis_patterns with structured output
  // (sufficient complexity to generate meaningful MCP tools)
  const frameworksWithQuestions = Object.values(concept.frameworks)
    .filter(fw => fw.questions && fw.questions.length > 0);

  if (frameworksWithQuestions.length >= 3 &&
      concept.analysis_patterns?.output_structure?.length > 0) {
    return 2;
  }

  // Tier 3: Default - prompt template
  return 3;
}
```

This is deterministic and LLM-free. The Headmaster does not use an LLM for tier assignment -- it uses structural analysis of the persona YAML. An LLM would add latency, cost, and non-determinism to a decision that can be made with simple heuristics.

---

## Appendix C: Tier 2 MCP Server Generation (Template Approach)

The Tier 2 generator does NOT use an LLM. It uses Mustache/Handlebars-style templates to produce a working MCP server from the persona's frameworks and mcp_config.yaml.

Generated server structure:
```
personas/<id>/generated/
|-- src/
|   |-- index.ts          # MCP server entry point (stdio transport)
|   |-- tools.ts           # Tool definitions from mcp_config.yaml
|-- package.json           # Dependencies: @modelcontextprotocol/sdk, yaml
|-- tsconfig.json          # ESM config matching Academy conventions
```

Each tool defined in `mcp_config.yaml` becomes:
1. A `CallToolRequestSchema` handler in `tools.ts`
2. A system prompt that injects the persona's identity, voice, and specified frameworks
3. Input validation via the tool's `input_schema`

The generated server is self-contained and can be added to Claude Desktop's MCP config independently of the Academy unified server.

---

*End of System Architecture Document*
