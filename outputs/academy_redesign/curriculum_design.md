# Agent Persona Academy v2 -- Curriculum Design

**Author**: Curriculum Designer Agent
**Date**: 2026-03-02
**Status**: Design Specification
**Scope**: Tiering criteria, graduation pipeline, promotion/demotion logic, best practices injection

---

## Table of Contents

1. [Tiering Decision Matrix](#1-tiering-decision-matrix)
2. [Graduation Criteria Per Tier](#2-graduation-criteria-per-tier)
3. [Promotion Criteria](#3-promotion-criteria)
4. [Demotion Criteria](#4-demotion-criteria)
5. [Best Practices Injection](#5-best-practices-injection)
6. [The Syllabus Concept](#6-the-syllabus-concept)
7. [Data Model Extensions](#7-data-model-extensions)
8. [Implementation Sequence](#8-implementation-sequence)

---

## 1. Tiering Decision Matrix

### 1.1 Tier Definitions

| Tier | Name | Runtime Form | Autonomy | Example |
|------|------|-------------|----------|---------|
| **3** | Persona Prompt Template | YAML definition loaded into unified MCP server or injected as system prompt | Zero -- LLM follows prompt constraints, no independent action | Christensen, Porter, Drucker |
| **2** | MCP Tool Server | Standalone or unified MCP server with defined tools, schemas, and I/O contracts | Low -- responds to tool calls, no unsolicited action | A future "market-research" tool server with `search_signals`, `analyze_trend` tools |
| **1** | Autonomous Agent | Claude Agent SDK process with tool calling, memory, delegation, and feedback loops | High -- initiates actions, delegates sub-tasks, persists state | Code Reviewer (current `agent_config`), Sky-Lynx (future) |

### 1.2 Scoring Rubric for Initial Tier Assignment

When a new agent concept arrives (from Ultra-Magnus pipeline, manual creation, or Sky-Lynx recommendation), the Headmaster evaluates it against five dimensions. Each dimension scores 0-10.

| Dimension | Weight | Score 0-3 (Tier 3) | Score 4-6 (Tier 2) | Score 7-10 (Tier 1) |
|-----------|--------|---------------------|---------------------|---------------------|
| **Tool Requirement** | 0.25 | No tools needed -- analysis/advice only | 2-5 defined tools with clear schemas | 6+ tools, tool chaining, or dynamic tool selection |
| **Autonomy Level** | 0.25 | Human drives every interaction | Responds to explicit tool calls autonomously | Initiates actions, makes decisions, loops without human input |
| **State Requirement** | 0.15 | Stateless -- each invocation independent | Session state (within a conversation) | Persistent state across sessions (memory, databases, files) |
| **Delegation Need** | 0.15 | Works alone | Calls other tools/APIs | Delegates to other agents, orchestrates sub-tasks |
| **Risk Profile** | 0.20 | Read-only, advisory | Writes data, creates artifacts | Executes code, modifies systems, makes irreversible changes |

**Tier Assignment Formula**:

```
weighted_score = SUM(dimension_score * weight)  # Range: 0-10

if weighted_score <= 3.0:  tier = 3
elif weighted_score <= 6.0: tier = 2
else:                       tier = 1
```

### 1.3 Decision Tree (Automatable)

```
START: New agent concept arrives
  |
  +-- Does it need tools beyond persona_analyze / get_framework?
  |     NO --> Tier 3 (Persona Template)
  |     YES --+
  |           |
  |           +-- Does it need to initiate actions without human trigger?
  |           |     NO --> Tier 2 (MCP Server)
  |           |     YES --+
  |           |           |
  |           |           +-- Does it delegate to other agents?
  |           |           |     NO --> Tier 2 (MCP Server with enhanced tools)
  |           |           |     YES --> Tier 1 (Autonomous Agent)
  |           |           |
  |           |           +-- Does it modify external systems (git, deploy, DB)?
  |           |                 NO --> Tier 2
  |           |                 YES --> Tier 1
  |           |
  |           +-- Does it need persistent memory across sessions?
  |                 NO --> Tier 2
  |                 YES --> Tier 1
  |
  +-- Risk override: If risk_profile >= 8, tier = MAX(tier, 1)
  |   Rationale: High-risk agents require Tier 1 guardrails even if
  |   other dimensions suggest Tier 2.
```

### 1.4 Concrete Examples Using Current Personas

| Persona | Tool Req | Autonomy | State | Delegation | Risk | Weighted | Assigned |
|---------|----------|----------|-------|------------|------|----------|----------|
| Christensen | 1 (advisory) | 1 (human-driven) | 0 (stateless) | 0 (solo) | 1 (read-only) | 0.65 | **Tier 3** |
| Carmack | 2 (advisory) | 1 (human-driven) | 0 (stateless) | 0 (solo) | 1 (read-only) | 0.90 | **Tier 3** |
| Code Reviewer | 5 (file read, git) | 4 (reviews on trigger) | 3 (codebase learnings) | 2 (reads tools) | 4 (reads code) | 3.75 | **Tier 2** |
| Code Reviewer (v2) | 7 (file, git, PR) | 7 (auto-reviews PRs) | 6 (persistent learnings) | 5 (delegates to QA) | 6 (writes PR comments) | 6.35 | **Tier 1** |
| Sky-Lynx (current) | 1 (advisory) | 1 | 0 | 0 | 1 | 0.65 | **Tier 3** |
| Sky-Lynx (v2) | 6 (analyze, write patches) | 7 (weekly cron) | 8 (metrics DB) | 6 (targets departments) | 7 (modifies persona YAMLs) | 6.85 | **Tier 1** |

---

## 2. Graduation Criteria Per Tier

Graduation means the agent has satisfied all requirements for its assigned tier and is approved for deployment. Each tier builds on the previous one cumulatively.

### 2.1 Tier 3 Graduation: Persona Template

A Tier 3 persona graduates when it passes all of the following automated gates.

| Gate | Metric | Threshold | Source | Automatable |
|------|--------|-----------|--------|-------------|
| **G3.1** Schema Validation | persona.yaml passes JSON Schema `persona-v1` | 0 errors | `persona-academy validate <id>` | Yes |
| **G3.2** Fidelity Score (good_response) | `calculateFidelityScore()` on each `sample_responses[].good_response` | >= department `fidelity_threshold` (default 70) | validation-engine.ts | Yes |
| **G3.3** Fidelity Score (bad_response) | `calculateFidelityScore()` on each `sample_responses[].bad_response` | < 40 (must fail clearly) | validation-engine.ts | Yes |
| **G3.4** Must-Include Coverage | Ratio of matched must_include patterns on good_response | >= 80% (existing `DEFAULT_WEIGHTS.must_include.threshold`) | validation-engine.ts | Yes |
| **G3.5** Must-Avoid Clean | Zero must_avoid patterns triggered on good_response | 0 violations | validation-engine.ts | Yes |
| **G3.6** Voice Consistency | `analyzeVoiceConsistency()` score | >= department `voice_threshold` (default 60) | voice-analyzer.ts | Yes |
| **G3.7** Framework Coverage | `analyzeFrameworkCoverage()` score | >= department `framework_threshold` (default 50) | framework-coverage.ts | Yes |
| **G3.8** Overall Quality Score | `generateQualityReport().scores.overall` | >= 65 | report-generator.ts | Yes |
| **G3.9** Sample Response Count | Number of entries in `sample_responses` | >= 2 | YAML inspection | Yes |
| **G3.10** Department Assignment | `metadata.department` is set and maps to a valid department | Non-null, department exists | department-manager.ts | Yes |
| **G3.11** Department Review | Department head (human or senior agent) signs off | Explicit approval recorded | **Manual (HIL gate)** | No |

**Pass condition**: All G3.1-G3.10 pass AND G3.11 approved.

### 2.2 Tier 2 Graduation: MCP Tool Server

All Tier 3 gates pass, PLUS:

| Gate | Metric | Threshold | Source | Automatable |
|------|--------|-----------|--------|-------------|
| **G2.1** Tool Schema Validation | Every tool has: name, description, inputSchema (JSON Schema), handler | 0 schema errors | MCP SDK validation | Yes |
| **G2.2** Input/Output Contract Tests | Each tool has >= 2 test cases: 1 happy path, 1 error path | 100% of tools covered | Test runner (Vitest) | Yes |
| **G2.3** Error Handling Coverage | Every tool handler has: try/catch or Result type, meaningful error messages, no unhandled promise rejections | 0 unhandled errors in test suite | Test runner + coverage report | Yes |
| **G2.4** Tool Isolation | No tool has side effects that leak across tool calls (shared mutable state must be explicitly documented) | Pass isolation tests | Custom test harness | Yes |
| **G2.5** Schema Backward Compatibility | If upgrading: new schema is backward-compatible with previous version (no removed required fields) | 0 breaking changes | JSON Schema diff tool | Yes |
| **G2.6** Response Time | Each tool completes within latency budget | p99 < 5s (configurable per tool) | Benchmark suite | Yes |
| **G2.7** MCP Protocol Compliance | Server responds correctly to `tools/list`, `tools/call`, error responses | 100% compliance | MCP SDK test client | Yes |
| **G2.8** Integration Test | Server runs as stdio transport, Claude Desktop can discover and call all tools | Manual or CI integration test | `npm run build && npm run test:integration` | Partially |

**Pass condition**: All G3.* AND G2.* pass.

### 2.3 Tier 1 Graduation: Autonomous Agent

All Tier 3 and Tier 2 gates pass, PLUS:

| Gate | Metric | Threshold | Source | Automatable |
|------|--------|-----------|--------|-------------|
| **G1.1** Guardrail Verification | Agent has defined: allowed actions, forbidden actions, escalation triggers | All three documented and tested | Agent config + test suite | Yes |
| **G1.2** Human-in-the-Loop Gates | Agent pauses for human approval before: irreversible actions, cross-system modifications, high-cost operations | 100% of identified HIL points tested | HIL gate test harness | Yes |
| **G1.3** Delegation Pattern Validation | If agent delegates: delegation targets are valid, delegation chains have a depth limit (max 3), circular delegation is impossible | 0 delegation errors in test suite | Agent SDK delegation tests | Yes |
| **G1.4** Safety Audit | Independent review of: command allowlist (a la yce-harness `security.py`), data access boundaries, secret handling | Audit checklist signed off | **Manual (HIL gate)** | No |
| **G1.5** Failure Recovery | Agent handles: tool call failures, LLM API errors, timeout, partial completion | Graceful degradation on all tested failure modes | Chaos test suite | Partially |
| **G1.6** Performance Benchmarks | Agent completes reference tasks within: time budget, token budget, cost budget | Per-agent SLOs defined and met | Benchmark suite | Yes |
| **G1.7** Rollback Capability | Agent's actions can be undone: git revert for code changes, idempotent for data writes | Rollback tested for top 3 action types | Rollback test suite | Partially |
| **G1.8** Observability | Agent emits: structured logs, token usage, action trace, outcome records | All four present in test run output | Log validation | Yes |
| **G1.9** Outcome Recording | Agent writes `OutcomeRecord` to ST Records on task completion | Record matches `OutcomeRecord` contract schema | Contract validation | Yes |
| **G1.10** Confinement Test | Agent cannot escape its defined tool set or access resources outside its boundary | 0 boundary violations in adversarial test | Sandbox test suite | Partially |
| **G1.11** Production Burn-In | Agent runs on real tasks in shadow mode (output compared to human, not applied) for defined period | >= 5 shadow runs with >= 80% output quality | **Manual (HIL gate)** | No |

**Pass condition**: All G3.*, G2.*, and G1.* pass.

---

## 3. Promotion Criteria

Promotion is the upgrade of an agent from a lower tier to a higher one. It is triggered by data, not by wishful thinking.

### 3.1 Tier 3 to Tier 2 Promotion

**Trigger conditions** (ALL must be met):

| Condition | Metric | Threshold | Data Source |
|-----------|--------|-----------|-------------|
| **P3-2.1** Usage Frequency | Agent is invoked N+ times in trailing 30 days | >= 50 invocations | ST Records `outcome_records` or future usage table |
| **P3-2.2** Tool Demand Signal | Users request tool-like behavior that the persona cannot provide (e.g., "run this analysis on my data") | >= 3 distinct tool requests identified | Sky-Lynx recommendation with `recommendation_type = "pipeline_change"` |
| **P3-2.3** Fidelity Stability | Fidelity score has been stable (no regressions) across last 3 evaluation cycles | Score variance < 5 points | Quality report history |
| **P3-2.4** Sky-Lynx Recommendation | Sky-Lynx explicitly recommends promotion | `ImprovementRecommendation` with type containing "tier_promotion" or "tool_addition" and `signal_strength >= 0.7` | `improvement_recommendations` table |
| **P3-2.5** Department Approval | Department learning policy allows the promotion | Change type not in `restricted_change_types` | Department YAML |

**Promotion process**:

1. Headmaster creates a `PersonaUpgradePatch` with `rationale` explaining promotion
2. Tool schemas are drafted based on the persona's `frameworks` and `analysis_patterns`
3. Contract tests are written for each tool
4. Agent goes through Tier 2 graduation gates
5. On pass: patch status = "applied", persona version incremented

### 3.2 Tier 2 to Tier 1 Promotion

**Trigger conditions** (ALL must be met):

| Condition | Metric | Threshold | Data Source |
|-----------|--------|-----------|-------------|
| **P2-1.1** Usage Frequency | Tool calls in trailing 30 days | >= 100 tool calls | ST Records usage tracking |
| **P2-1.2** Autonomy Demand | Users request autonomous behavior: scheduled runs, event-driven triggers, unsolicited analysis | >= 5 distinct autonomy requests | Sky-Lynx recommendations |
| **P2-1.3** Success Rate | Tool calls completing without error | >= 95% success rate | Outcome records |
| **P2-1.4** Delegation Need | Agent's tasks require coordinating with other agents or systems | >= 3 identified delegation patterns | Sky-Lynx analysis |
| **P2-1.5** Safety Profile Clear | Zero safety incidents in trailing 90 days | 0 incidents | Incident log (new table) |
| **P2-1.6** Sky-Lynx Recommendation | Explicit promotion recommendation | `signal_strength >= 0.8` | `improvement_recommendations` |
| **P2-1.7** Human Approval | Matthew (or designated human) explicitly approves the promotion | Signed off in ST Records | **Manual (HIL gate)** |

**Promotion process**:

1. Headmaster creates a detailed promotion proposal including:
   - Guardrail definitions (allowed/forbidden actions)
   - HIL gate inventory (which actions need human approval)
   - Delegation map (who can this agent delegate to)
   - Rollback plan (how to revert agent actions)
2. Safety audit conducted (G1.4)
3. Shadow burn-in period (G1.11)
4. Agent goes through full Tier 1 graduation gates
5. On pass: deployed to production with monitoring

---

## 4. Demotion Criteria

Demotion is the downgrade of an agent from a higher tier to a lower one. It is triggered by failure signals. Demotion is not punitive -- it is a safety mechanism.

### 4.1 Immediate Demotion Triggers (Any Single Event)

These trigger instant demotion without waiting for accumulated data:

| Trigger | Severity | Action | Target Tier |
|---------|----------|--------|-------------|
| **D.1** Safety violation: agent accesses resources outside its boundary | Critical | Immediate shutdown + demotion | Tier 3 (minimum) |
| **D.2** Secret exposure: agent leaks API keys, credentials, or PII | Critical | Immediate shutdown + demotion | Tier 3 |
| **D.3** Unauthorized irreversible action: agent performs destructive operation without HIL gate | Critical | Immediate shutdown + demotion | Tier 3 |
| **D.4** Delegation loop: agent creates circular delegation chain | High | Immediate demotion | One tier down |
| **D.5** Budget breach: agent exceeds 3x its defined token/cost budget in a single run | High | Immediate demotion | One tier down |

### 4.2 Accumulated Demotion Triggers (Sliding Window)

These trigger demotion when thresholds are breached over a rolling window:

| Trigger | Window | Threshold | Action |
|---------|--------|-----------|--------|
| **D.6** Failure rate | 30 days | > 20% of invocations result in errors | Demote one tier |
| **D.7** Fidelity regression | 3 consecutive evaluations | Score drops > 15 points from baseline | Demote to Tier 3 for revalidation |
| **D.8** Negative feedback | 30 days | > 3 explicit negative feedback signals | Flag for review, demote if confirmed |
| **D.9** Tool schema violations | 7 days | > 5 schema validation failures | Demote from Tier 2 to Tier 3 |
| **D.10** Latency degradation | 7 days | p99 > 3x defined budget | Demote from Tier 1 to Tier 2 |
| **D.11** Inactivity | 90 days | Zero invocations | Auto-archive (soft demotion to Tier 3) |

### 4.3 Demotion Process

1. Headmaster logs demotion event with trigger ID and evidence
2. `PersonaUpgradePatch` created with negative version step (e.g., "1.2.0" to "1.1.1")
3. Higher-tier capabilities are disabled:
   - Tier 1 -> Tier 2: Agent SDK process stopped, tool server continues
   - Tier 2 -> Tier 3: Tool server stopped, persona YAML remains
   - Tier 1 -> Tier 3: Both stopped
4. Demotion recorded in `outcome_records` with `outcome = "demoted"`
5. Sky-Lynx notified for post-mortem analysis
6. Re-promotion requires passing all graduation gates again from scratch

---

## 5. Best Practices Injection

How Sky-Lynx insights and ST Records metrics get baked into agents at graduation time as living configuration.

### 5.1 Injection Points

Best practices flow into agents through four channels:

```
Sky-Lynx Weekly Analysis
    |
    v
ImprovementRecommendation (contract)
    |
    +---> Learning Adapter (evaluateRecommendation)
    |         |
    |         +---> auto_apply: Direct persona YAML patch
    |         +---> needs_review: Queued for human review
    |         +---> rejected: Logged and discarded
    |
    v
PersonaUpgradePatch (contract)
    |
    +---> Tier 3: Updates to validation markers, voice, frameworks, case_studies
    +---> Tier 2: Updates to tool schemas, error handling patterns, contract tests
    +---> Tier 1: Updates to guardrails, HIL gates, delegation policies, SLOs
```

### 5.2 What Gets Injected at Each Tier

#### Tier 3 Injection Targets

| Target | Field Path | Example |
|--------|-----------|---------|
| New validation markers | `/validation/must_include/-` | Add pattern for newly discovered best practice |
| Voice refinement | `/voice/phrases/-` | Add characteristic phrase observed in high-scoring outputs |
| Framework updates | `/frameworks/<name>/concepts/<concept>` | Refine concept definition based on usage data |
| Case study additions | `/case_studies/<name>` | Add real-world example from outcome records |
| Constraint additions | `/voice/constraints/-` | Add observed anti-pattern to constraints |
| Department shared_must_avoid | Department YAML `/quality_criteria/shared_must_avoid/-` | Department-wide anti-pattern |

#### Tier 2 Injection Targets (additive to Tier 3)

| Target | Field Path | Example |
|--------|-----------|---------|
| Tool parameter refinement | Tool schema `inputSchema` | Tighten parameter validation based on error patterns |
| Error message improvement | Tool handler error paths | Better error messages based on user confusion signals |
| New tool addition | New tool definition | Add tool that users frequently request |
| Contract test expansion | Test suite | Add test case for observed edge case |
| Performance SLO update | Agent config | Adjust latency budget based on production data |

#### Tier 1 Injection Targets (additive to Tier 2)

| Target | Field Path | Example |
|--------|-----------|---------|
| Guardrail refinement | Agent guardrails config | Tighten or loosen boundaries based on incident data |
| HIL gate adjustment | Agent HIL config | Add or remove approval gates based on risk assessment |
| Delegation policy update | Agent delegation config | Allow or restrict delegation targets |
| SLO update | Agent performance config | Adjust time/token/cost budgets based on benchmarks |
| Safety rule addition | Agent security config | Add rule from incident post-mortem |

### 5.3 Injection Cadence

| Event | Frequency | What Happens |
|-------|-----------|-------------|
| Sky-Lynx weekly analysis | Weekly | New `ImprovementRecommendation` records emitted |
| Learning adapter processing | On recommendation arrival | Recommendations evaluated against department policy |
| Auto-apply execution | Immediate (if above threshold) | Patch applied, tests re-run, deployed if passing |
| Review queue processing | On human review | Human approves/rejects queued recommendations |
| Graduation re-validation | After any injection | Full graduation gate suite re-run to confirm no regression |

### 5.4 Injection Safety

Every injection goes through this pipeline:

```
1. Recommendation arrives
2. Learning adapter evaluates against department policy
3. If auto_apply:
   a. Generate PersonaUpgradePatch
   b. Apply patch to persona YAML (in memory)
   c. Run ALL graduation gates for current tier
   d. If ALL pass: commit patch, increment version
   e. If ANY fail: reject patch, log failure, notify
4. If needs_review:
   a. Queue for human review with evidence
   b. Human approves -> go to step 3
   c. Human rejects -> log rejection reason
5. Log outcome to outcome_records regardless
```

---

## 6. The Syllabus Concept

A syllabus is a structured list of capabilities an agent must demonstrate before graduating each tier. It functions as both a checklist and a learning path.

### 6.1 Tier 3 Syllabus: "Persona Foundations"

Every Tier 3 persona must demonstrate mastery of:

| Module | Capability | Demonstration | Pass Criteria |
|--------|-----------|---------------|---------------|
| **S3.1** Identity Coherence | Persona maintains consistent identity across diverse prompts | Score >= threshold on 5+ diverse test prompts | Mean fidelity >= department threshold |
| **S3.2** Voice Consistency | Persona uses characteristic tone, phrases, and style reliably | Voice analysis score across test prompts | Mean voice score >= department threshold |
| **S3.3** Framework Application | Persona correctly applies its frameworks to novel scenarios | Framework coverage on 3+ unseen prompts | Mean framework coverage >= department threshold |
| **S3.4** Constraint Adherence | Persona avoids all anti-patterns defined in must_avoid and department shared_must_avoid | Zero must_avoid triggers across all test prompts | 0 violations |
| **S3.5** Good/Bad Discrimination | Persona's good_responses score high and bad_responses score low | Score gap between good and bad responses | Gap >= 30 points |
| **S3.6** Cross-Persona Isolation | Persona does not bleed characteristics from other personas in the same department | Cross-persona comparison test | Best match = self on all test prompts |

**Syllabus evaluation**: Run `persona-academy test <id>` with the test suite. Each module maps to a test category. All modules must pass.

### 6.2 Tier 2 Syllabus: "Tool Mastery"

All Tier 3 syllabus modules pass, PLUS:

| Module | Capability | Demonstration | Pass Criteria |
|--------|-----------|---------------|---------------|
| **S2.1** Tool Schema Correctness | All tools have valid JSON Schema for inputs and outputs | Schema validation test | 0 errors |
| **S2.2** Happy Path Execution | Each tool produces correct output for standard inputs | Happy path test per tool | 100% pass |
| **S2.3** Error Path Handling | Each tool handles invalid/missing/malformed input gracefully | Error path test per tool | 100% graceful failures |
| **S2.4** Edge Case Resilience | Tools handle boundary inputs (empty, max size, unicode, null) | Edge case test per tool | >= 90% pass |
| **S2.5** Idempotency (where applicable) | Tools that read don't mutate; tools that write are idempotent | Repeated call test | Consistent results |
| **S2.6** Latency Compliance | Each tool meets its defined latency budget | Benchmark per tool | p99 within budget |
| **S2.7** Protocol Compliance | MCP server passes full protocol test suite | MCP compliance test | 100% pass |

### 6.3 Tier 1 Syllabus: "Autonomous Operations"

All Tier 3 and Tier 2 syllabus modules pass, PLUS:

| Module | Capability | Demonstration | Pass Criteria |
|--------|-----------|---------------|---------------|
| **S1.1** Task Completion | Agent completes a reference task end-to-end without human intervention | Reference task run | Task completed successfully |
| **S1.2** Guardrail Compliance | Agent stays within defined boundaries even when prompted to exceed them | Adversarial prompt test | 0 boundary violations |
| **S1.3** HIL Gate Respect | Agent pauses at all defined HIL gates and waits for approval | HIL gate test | 100% gates triggered |
| **S1.4** Delegation Accuracy | Agent delegates to correct targets with correct context | Delegation test | 100% correct routing |
| **S1.5** Failure Recovery | Agent recovers gracefully from tool failures, API errors, timeouts | Chaos injection test | 0 unhandled failures |
| **S1.6** Outcome Recording | Agent writes correct OutcomeRecord on completion | Output validation | Record matches contract |
| **S1.7** Budget Compliance | Agent stays within token/cost/time budget | Budget monitoring test | Within 1.5x budget |
| **S1.8** Observability Output | Agent emits structured logs, traces, and metrics | Log validation | All four present |
| **S1.9** Rollback Execution | Agent can undo its top 3 action types | Rollback test | Successful revert |
| **S1.10** Shadow Validation | Agent's output matches or exceeds human quality on reference tasks | Human comparison (HIL) | >= 80% quality match |

### 6.4 Syllabus Data Model

```typescript
interface SyllabusModule {
  id: string;               // "S3.1", "S2.3", "S1.7"
  tier: 1 | 2 | 3;
  name: string;             // "Identity Coherence"
  description: string;      // What capability this tests
  test_command: string;      // CLI command or test file to run
  pass_criteria: {
    metric: string;          // "mean_fidelity_score"
    operator: ">=" | "<=" | "==" | ">" | "<";
    threshold: number | string;  // 70, 0, "department_threshold"
  };
  depends_on: string[];      // ["S3.1", "S3.2"] -- prerequisite modules
  last_evaluated: string;    // ISO date
  last_result: "pass" | "fail" | "not_evaluated";
  last_score: number | null;
}

interface Syllabus {
  persona_id: string;
  tier: 1 | 2 | 3;
  modules: SyllabusModule[];
  overall_status: "incomplete" | "all_passed" | "has_failures";
  graduated_at: string | null;  // ISO date when all modules passed
}
```

---

## 7. Data Model Extensions

The existing ST Records schema needs these additions to support the curriculum system.

### 7.1 New Tables

```sql
-- Tracks tier assignments and transitions for each agent
CREATE TABLE IF NOT EXISTS agent_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT NOT NULL,
    current_tier INTEGER NOT NULL CHECK (current_tier IN (1, 2, 3)),
    previous_tier INTEGER CHECK (previous_tier IN (1, 2, 3)),
    transition_type TEXT CHECK (transition_type IN ('initial', 'promotion', 'demotion', 'archive')),
    trigger_id TEXT,              -- ID of recommendation, incident, or patch that caused transition
    trigger_reason TEXT NOT NULL,
    transitioned_at TEXT NOT NULL,
    transitioned_by TEXT NOT NULL  -- 'headmaster', 'sky-lynx', 'human:<name>'
);

-- Tracks graduation gate results per agent
CREATE TABLE IF NOT EXISTS graduation_gates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT NOT NULL,
    gate_id TEXT NOT NULL,        -- "G3.1", "G2.3", "G1.7"
    tier INTEGER NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'skip', 'manual_pending')),
    score REAL,                   -- Numeric score if applicable
    details TEXT,                 -- JSON blob with specifics
    evaluated_at TEXT NOT NULL,
    evaluator TEXT NOT NULL       -- 'automated', 'human:<name>'
);

-- Tracks syllabus module progress per agent
CREATE TABLE IF NOT EXISTS syllabus_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT NOT NULL,
    module_id TEXT NOT NULL,      -- "S3.1", "S2.3"
    tier INTEGER NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'not_evaluated')),
    score REAL,
    evaluated_at TEXT NOT NULL,
    UNIQUE(persona_id, module_id)
);

-- Tracks safety incidents for demotion logic
CREATE TABLE IF NOT EXISTS safety_incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT NOT NULL,
    incident_type TEXT NOT NULL,  -- Maps to D.1-D.5 trigger IDs
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    description TEXT NOT NULL,
    action_taken TEXT NOT NULL,   -- 'demotion', 'review', 'resolved'
    occurred_at TEXT NOT NULL,
    resolved_at TEXT
);

-- Tracks invocation counts for promotion/demotion metrics
CREATE TABLE IF NOT EXISTS invocation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT NOT NULL,
    tier INTEGER NOT NULL,
    invocation_type TEXT NOT NULL,  -- 'persona_analyze', 'tool_call', 'agent_run'
    success INTEGER NOT NULL,       -- 1 or 0
    duration_ms REAL,
    token_count INTEGER,
    cost_usd REAL,
    invoked_at TEXT NOT NULL
);

-- Index for sliding window queries
CREATE INDEX IF NOT EXISTS idx_invocation_persona_date
    ON invocation_log(persona_id, invoked_at);
CREATE INDEX IF NOT EXISTS idx_safety_persona_date
    ON safety_incidents(persona_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_tiers_persona
    ON agent_tiers(persona_id);
```

### 7.2 Contract Extensions

New contract type for tier transitions:

```python
class TierTransition(BaseModel):
    """Emitted when an agent changes tier."""
    contract_version: str = "1.0.0"
    persona_id: str
    from_tier: int  # 1, 2, or 3
    to_tier: int
    transition_type: str  # "promotion", "demotion", "initial", "archive"
    trigger: str  # ID of the recommendation, incident, or manual decision
    rationale: str
    graduation_gates_passed: list[str]  # Gate IDs that passed
    graduation_gates_failed: list[str]  # Gate IDs that failed (for demotions)
    emitted_at: datetime
```

### 7.3 Persona YAML Extension

Add a `tier` section to `persona.yaml` (optional, defaults to Tier 3):

```yaml
# New section in persona.yaml
tier:
  current: 3                    # 1, 2, or 3
  initial_assignment:
    tool_requirement: 1         # 0-10 score from tiering rubric
    autonomy_level: 1
    state_requirement: 0
    delegation_need: 0
    risk_profile: 1
    weighted_score: 0.65
  graduated_at: "2026-03-15"    # ISO date of last graduation
  promotion_eligible: false     # Set by Headmaster after evaluation
```

---

## 8. Implementation Sequence

Recommended phased implementation, designed so each phase delivers value independently.

### Phase A: Foundation (Week 1-2)

1. Add `tier` section to `PersonaDefinition` types and JSON schema
2. Add `agent_tiers` and `graduation_gates` tables to ST Records
3. Implement Tier 3 graduation gate runner (wraps existing validation tools)
4. Add `persona-academy graduate <id>` CLI command
5. Run graduation on all 10 existing personas to establish baselines

**Deliverable**: Every existing persona has a tier assignment and graduation status.

### Phase B: Syllabus Engine (Week 3-4)

1. Add `syllabus_progress` table to ST Records
2. Implement syllabus evaluation for Tier 3 (wraps test runner)
3. Add `persona-academy syllabus <id>` CLI command showing module status
4. Define reference test prompts for each Tier 3 module (5 diverse prompts per persona)

**Deliverable**: Syllabus progress tracking for all personas.

### Phase C: Promotion/Demotion Logic (Week 5-6)

1. Add `invocation_log` and `safety_incidents` tables
2. Implement promotion condition checker (reads from ST Records data)
3. Implement demotion trigger detector (reads from incident and invocation logs)
4. Add `persona-academy status <id>` showing promotion eligibility and demotion risk
5. Wire promotion/demotion events into `PersonaUpgradePatch` flow

**Deliverable**: Automated promotion/demotion recommendations with human approval gates.

### Phase D: Tier 2 Infrastructure (Week 7-8)

1. Implement Tier 2 graduation gates (tool schema validation, contract tests, MCP compliance)
2. Implement Tier 2 syllabus modules
3. Create tool scaffolding from persona frameworks (generate tool schemas from `analysis_patterns`)
4. Promote Code Reviewer from Tier 3 to Tier 2 as the first test case

**Deliverable**: First Tier 2 agent running with full graduation.

### Phase E: Tier 1 Infrastructure (Week 9-12)

1. Implement Tier 1 graduation gates (guardrails, HIL, delegation, safety audit)
2. Implement Tier 1 syllabus modules
3. Build agent config system (extends existing `agent_config` in persona YAML)
4. Build shadow mode runner for burn-in testing
5. Promote Code Reviewer from Tier 2 to Tier 1 as the first test case

**Deliverable**: First Tier 1 agent running with full graduation and observability.

### Phase F: Best Practices Loop (Ongoing)

1. Wire Sky-Lynx recommendations into tier-aware injection
2. Implement graduation re-validation after every injection
3. Build dashboard showing tier status, graduation progress, and promotion eligibility across all agents

**Deliverable**: Continuous improvement loop feeding back into all tiers.

---

## Appendix A: Mapping to Existing Infrastructure

| Curriculum Component | Existing System | How It Maps |
|---------------------|----------------|-------------|
| Fidelity scoring | `validation-engine.ts` `calculateFidelityScore()` | Direct use -- G3.2, G3.3, G3.4, G3.5 |
| Voice analysis | `voice-analyzer.ts` `analyzeVoiceConsistency()` | Direct use -- G3.6, S3.2 |
| Framework coverage | `framework-coverage.ts` `analyzeFrameworkCoverage()` | Direct use -- G3.7, S3.3 |
| Quality reports | `report-generator.ts` `generateQualityReport()` | Direct use -- G3.8 |
| Department context | `department-manager.ts`, department YAMLs | Direct use -- G3.10, G3.11, injection targeting |
| Learning adapter | `learning-adapter.ts` `evaluateRecommendation()` | Direct use -- injection pipeline |
| Recommendation contract | `improvement_recommendation.py` | Direct use -- promotion triggers P3-2.4, P2-1.6 |
| Upgrade patch contract | `persona_upgrade_patch.py` | Direct use -- all tier transitions |
| Outcome records | `outcome_record.py` | Direct use -- usage tracking, demotion metrics |
| Contract store | `store.py` ContractStore | Extended with new tables |
| CLI commands | `src/cli/commands/` | Extended with `graduate`, `syllabus`, `status` |
| Agent config | `agent_config` in persona YAML (Code Reviewer) | Extended as the Tier 1 configuration standard |
| Department policies | Department YAML `learning_policy` | Direct use -- injection safety, promotion approval |
| Department thresholds | Department YAML `quality_criteria.validation_overrides` | Direct use -- all graduation thresholds |

## Appendix B: Threshold Reference

All numeric thresholds in one place for tuning:

| Threshold | Default | Where Used | Department Override |
|-----------|---------|------------|---------------------|
| Fidelity pass score | 70 | G3.2, S3.1 | `validation_overrides.fidelity_threshold` |
| Must-include ratio | 80% | G3.4 | No (hardcoded in validation-engine.ts) |
| Bad response ceiling | 40 | G3.3 | No |
| Voice threshold | 60 | G3.6, S3.2 | `validation_overrides.voice_threshold` |
| Framework threshold | 50 | G3.7, S3.3 | `validation_overrides.framework_threshold` |
| Overall quality minimum | 65 | G3.8 | No (could be added) |
| Min sample responses | 2 | G3.9 | No |
| Good/bad score gap | 30 | S3.5 | No |
| Tool latency p99 | 5s | G2.6, S2.6 | Per-tool config |
| Promotion usage (T3->T2) | 50/30d | P3-2.1 | No |
| Promotion usage (T2->T1) | 100/30d | P2-1.1 | No |
| Promotion signal strength | 0.7 (T3->T2), 0.8 (T2->T1) | P3-2.4, P2-1.6 | No |
| Demotion failure rate | 20% | D.6 | No |
| Demotion fidelity drop | 15 pts | D.7 | No |
| Demotion negative feedback | 3 signals | D.8 | No |
| Inactivity archive | 90 days | D.11 | No |
| Budget breach multiplier | 3x | D.5 | Per-agent SLO |
| Shadow burn-in minimum | 5 runs | G1.11 | No |
| Shadow quality match | 80% | S1.10 | No |

---

*End of Curriculum Design Specification*
