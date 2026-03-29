# Agent Persona Academy v2 -- Consolidated Redesign Plan

**Author**: Synthesis Lead (5-agent redesign team)
**Date**: 2026-03-02
**Status**: Final recommendation
**Inputs**: System Architecture, Tier 1 Agent Spec, Integration Map, Curriculum Design, Devil's Advocate

---

# Part I: Cross-Review and Debate

## Debate 1: Devil's Advocate vs System Architect -- Headmaster Design

### Position A: System Architect

The Headmaster is a CLI command with optional cron, not an always-on agent. It is stateless between runs -- all state lives in tier.yaml files (git-tracked), ST Records DB (metrics), and Metroplex DB (build status). It reads current state, makes decisions, writes updated state. Daily at 6am is sufficient cadence. The Headmaster automates five operations: intake new concepts, assign initial tiers, evaluate graduation criteria against metrics, trigger builds for promotions, and report. The design is conservative: no LLM for tier assignment (deterministic decision tree), 5+ consecutive passing evaluations required before promotion, and demotion requires manual confirmation.

### Position B: Devil's Advocate

The Headmaster automates a process that has never been performed manually. Zero tier transitions have occurred. The ST Records metrics that would drive Headmaster decisions are anemic: 2 outcome records, 2 persona patches (both never applied -- 3,412 consecutive Metroplex skips), and 8 improvement recommendations (3 are dry-run stubs). Building a control system for a process with no history and no data is premature optimization. Matthew manually added `agent_config` to code-reviewer in 15 minutes. This operation happens at most once per quarter.

### Resolution: DEFER the Headmaster. Build the data first.

**Reasoning**: The System Architect's design is technically sound -- CLI-with-cron, stateless, deterministic tier assignment. But the Devil's Advocate wins on timing. You cannot build a data-driven decision engine when the data does not exist. The Headmaster's graduation engine needs fidelity scores, patch success rates, outcome records, and invocation counts. Today those tables have near-zero useful data. The correct sequence is:

1. Fix the broken feedback loop (Metroplex patcher bug) so data starts flowing
2. Manually promote 2-3 personas and track the decisions you make
3. After 4-6 weeks of manual operation, assess whether there is enough volume and enough pattern to justify automation

The Headmaster design should be preserved as a specification (it is good design) but implementation is deferred until Phase 3 or 4, not Phase 1. Manual promotion via adding `agent_config` to persona.yaml and running through CI validation is the right approach for now.

**Decision**: Headmaster deferred to Phase 4 (earliest). Manual tier transitions with CI validation in Phases 1-3.

---

## Debate 2: Devil's Advocate vs Curriculum Designer -- Tiering Criteria

### Position A: Curriculum Designer

Three tiers are justified by distinct runtime forms: Tier 3 (YAML prompt template, zero autonomy), Tier 2 (MCP server with defined tools, low autonomy), Tier 1 (autonomous Agent SDK process, high autonomy). Each tier has its own graduation gates (11 for T3, 8 for T2, 11 for T1), syllabus modules, promotion criteria, and demotion triggers. A 5-dimension scoring rubric (tool requirement, autonomy level, state requirement, delegation need, risk profile) drives initial tier assignment with weighted scores.

### Position B: Devil's Advocate

9 of 10 personas are pure advisory (Tier 3). Only code-reviewer has agent_config. Tier 2 is the "squeezed middle" -- the Academy already has a unified MCP server with 7 tools that covers the "tools without autonomy" case via `switch_persona` + `persona_analyze`. The incremental value of wrapping a single persona in its own MCP server vs. promoting it to a full agent is unclear. Nobody has asked for per-persona MCP servers. Two tiers are sufficient: Persona (current) and Agent (YAML + agent_config -> AgentDefinition).

### Resolution: TWO tiers. Drop Tier 2.

**Reasoning**: The Devil's Advocate is right that Tier 2 is architecturally orphaned. The Academy's unified MCP server already provides persona-specific tool invocation. A standalone MCP server per persona adds deployment overhead (separate process, separate config in Claude Desktop) for marginal benefit. The Curriculum Designer's Tier 2 graduation gates (G2.1-G2.8) are well-designed but test a runtime form nobody needs yet.

The practical distinction is: either a persona is a prompt template (Tier 3) or it is an autonomous agent (Tier 1). The gap between them is bridged by `agent_config` in the persona YAML and the existing yaml_loader.py in yce-harness.

However, the Curriculum Designer's scoring rubric and graduation gate design are valuable and should be preserved in simplified form. Instead of 3 tiers with 30 graduation gates and 23 syllabus modules, we use:

- **Persona mode** (default): YAML prompt template. Graduation = passing fidelity, voice, and framework coverage tests (existing validation pipeline).
- **Agent mode**: Persona YAML + agent_config -> Claude Agent SDK agent. Graduation = all Persona gates pass + agent-specific gates (guardrail verification, HIL gate testing, safety audit, burn-in).

The 5-dimension scoring rubric is simplified to a binary decision tree: Does this persona need tools and autonomous execution? If yes, Agent mode. If no, Persona mode.

**Decision**: Two tiers (Persona / Agent). Tier 2 dropped. Graduation gates consolidated to ~15 total (existing validation for Persona, agent-specific gates for Agent mode).

---

## Debate 3: Integration Architect vs System Architect -- Feasibility Check

### Position A: System Architect

The architecture is designed for minimal modification to external systems. Academy remains the persona authority, Metroplex handles builds, YCE Harness executes, ST Records stores metrics. The new components (Headmaster, Tier2Generator, Tier1Dispatcher, stfactory-reader) are all additive. Existing components get extended, not rewritten. The build pipeline flow is: Academy -> Metroplex priority queue -> SpecGenerator -> YCE Harness -> Gate 4 publish.

### Position B: Integration Architect

Verified the interfaces and found:

1. **Metroplex patcher bug (CONFIRMED)**: `gates/patcher.py` line 183 uses `personas/{persona_id}.yaml` but the actual layout is `personas/{persona_id}/persona.yaml`. This means the ST Records -> Academy feedback loop has never successfully applied a patch. Independently verified by grep.

2. **Metroplex PriorityItem.source needs "academy"**: `models.py` line 78 defines `source: Literal["ideaforge", "skylynx", "linear"]`. Adding "academy" is a one-line change.

3. **buildable_sources needs "academy"**: `gates/build.py` line 610 filters to `("ideaforge", "linear")`. Another one-line change.

4. **YCE Harness needs NO changes**: It is spec-driven. The spec template is the control surface.

5. **ST Records needs minimal changes**: Optional `tier_context` field on PersonaUpgradePatch, new enum values on RecommendationType. All backward-compatible.

Total external modification footprint: 3 files in Metroplex (models.py, build.py, patcher.py bugfix), 2 files in ST Records (improvement_recommendation.py, persona_upgrade_patch.py), 0 files in YCE Harness, 0 files in IdeaForge.

### Resolution: The design connects to existing components with a SMALL modification footprint, but the patcher bug must be fixed first.

**Reasoning**: The System Architect's design is feasible. The Integration Architect confirmed that the interfaces are real, the modifications are minimal, and the dependency order is clear. The modification footprint is 5 files across 2 projects, all additive/backward-compatible changes plus one bugfix.

The critical finding is the patcher bug. This is not a v2 issue -- it is an existing infrastructure failure that has silently broken the feedback loop for weeks. The patcher has attempted 3,412 cycles and skipped every single patch because it cannot find the target file. This bug must be fixed regardless of whether v2 proceeds, and it should be fixed first because it unblocks the data flow that all other decisions depend on.

With Tier 2 dropped (Debate 2 resolution) and Headmaster deferred (Debate 1 resolution), the modification footprint shrinks further. The Tier1Dispatcher, Tier2Generator, and stfactory-reader modules are deferred. What remains for near-term implementation:

- Fix patcher.py line 183 (bugfix)
- Add "academy" to PriorityItem.source and buildable_sources (when Headmaster is built later)
- Wire yaml_loader.py into yce-harness (connecting existing dead code)

**Decision**: Modification footprint is manageable. Fix patcher bug immediately. Defer Metroplex PriorityItem changes until Headmaster is built.

---

## Debate 4: Agent SDK Specialist vs Curriculum Designer -- Tier 1 Reality Check

### Position A: Agent SDK Specialist

The SDK spec defines a complete Tier 1 agent architecture: `main.py` entry point, `config.py` that loads persona YAML and resolves tool groups, `hooks.py` with guardrail hooks (bash security, read-only enforcement, persona boundary), `memory.py` for persistent learnings, and `tools.py` for custom in-process tools. The `agent_config` schema extension (v2) is backward-compatible: all new fields (guardrails, subagents, hil_gates, mcp_servers, permission_mode, thinking, effort) are optional. Tool groups are a shared catalog. Guardrails ship by default on all Tier 1 agents. The SDK supports all required features: hooks (PreToolUse, PostToolUse), AgentDefinition for subagents, HookMatcher for pattern-based hook registration, and single-depth delegation.

### Position B: Curriculum Designer

Tier 1 graduation requires 11 gates (G1.1-G1.11), including guardrail verification, HIL gate testing, delegation pattern validation, safety audit (manual), failure recovery, performance benchmarks, rollback capability, observability, outcome recording, confinement testing, and production burn-in (manual). Three of these gates are partially automatable and two require manual review (safety audit G1.4, production burn-in G1.11).

### Resolution: Tier 1 graduation criteria are ACHIEVABLE with the current SDK, but some gates need relaxation for the first agent.

**Reasoning**: The Agent SDK Specialist demonstrates that the SDK supports everything needed for Tier 1 agents. The reference architecture maps cleanly from persona YAML to runtime configuration. The Curriculum Designer's graduation gates are thorough but some are aspirational for the first agent:

**Achievable now (SDK supports directly):**
- G1.1 Guardrail verification: SDK hooks handle this
- G1.2 HIL gates: `permissionDecision: "ask"` in PreToolUse hooks
- G1.3 Delegation pattern validation: `Task` tool with `AgentDefinition`, single-depth constraint is enforced by SDK
- G1.8 Observability: SDK emits structured output (AssistantMessage, ToolUseBlock, ResultMessage)
- G1.9 Outcome recording: Agent can write to ST Records via Bash/custom tool

**Achievable with effort (need test infrastructure built):**
- G1.5 Failure recovery: Requires a chaos test suite (inject tool failures, API errors)
- G1.6 Performance benchmarks: Requires benchmark harness and SLO definitions
- G1.7 Rollback capability: Requires rollback tests per action type
- G1.10 Confinement test: Requires adversarial test prompts

**Must remain manual (not automatable with current tools):**
- G1.4 Safety audit: Human review of command allowlist, data access boundaries
- G1.11 Production burn-in: Human comparison of agent output vs expected quality

For the first Tier 1 agent (code-reviewer), the gates should be applied pragmatically:
- Required: G1.1, G1.2, G1.3, G1.4 (manual), G1.8
- Deferred until test infrastructure exists: G1.5, G1.6, G1.7, G1.10
- Required before production use: G1.11

The Curriculum Designer's Tier 2 gates (G2.1-G2.8) are moot since Tier 2 is dropped.

**Decision**: Tier 1 graduation gates G1.1-G1.4, G1.8 required for first agent. G1.5-G1.7, G1.9-G1.10 deferred until test infrastructure exists. G1.11 required before any agent handles production workloads.

---

## Debate 5: Devil's Advocate Reality Check -- Dead Code, Patcher Bug, Thin Data

### Position A: Devil's Advocate Findings

Three infrastructure failures that change implementation priority:

1. **Dead code (yaml_loader.py)**: The bridge from persona YAML to AgentDefinition exists in yce-harness but is never called. `LOAD_AGENTS_FROM_YAML` is documented in a comment but never referenced by any client initialization code. Verified by grep: no imports of `yaml_loader` exist anywhere in yce-harness except the file itself.

2. **Patcher bug**: Metroplex `gates/patcher.py` line 183 constructs `personas/{persona_id}.yaml` but Academy layout is `personas/{persona_id}/persona.yaml`. Result: 3,412 consecutive patch application skips. The ST Records -> Academy feedback loop has never completed a single cycle.

3. **Thin data**: 2 outcome records (1 published, 1 deferred), 8 improvement recommendations (3 dry-run stubs), 2 persona patches (neither applied), 0 applied patches, 0 applied recommendations. The metrics DB is not empty but it is far too thin to drive automated tiering decisions.

### Resolution: Fix existing infrastructure BEFORE building new features. Implementation order is repair-first.

**Reasoning**: The Devil's Advocate has identified a fundamental sequencing problem. The proposed v2 architecture assumes a functioning feedback loop: Sky-Lynx produces recommendations, ST Records stores them, Metroplex applies patches, Academy personas improve, metrics accumulate, and eventually personas get promoted. But this loop is broken at two points:

1. The patcher cannot find persona files (path bug) -- so patches never get applied
2. The yaml_loader is dead code -- so even a manually promoted persona cannot run as an agent via the designed bridge

Building a Headmaster to automate tier transitions on top of these two broken links is like building an autopilot for a car that cannot steer.

The correct implementation order is:

**Step 0**: Fix the patcher bug (30 minutes of work, unlocks the entire feedback loop)
**Step 1**: Wire yaml_loader.py into yce-harness (prove the YAML-to-agent path works)
**Step 2**: Run one persona as a real agent (validate end-to-end)
**Step 3**: Accumulate data for 4-6 weeks
**Step 4**: Then and only then, assess whether Headmaster automation is justified

This is not a question of ambition -- it is a question of sequence. The full architecture vision is sound but the foundation has cracks that must be repaired first.

**Decision**: Phase 1 focuses exclusively on fixing broken infrastructure and proving the existing bridge. No new automation until the existing pipeline works end-to-end.

---

# Part II: Consolidated Implementation Plan

## 1. Executive Summary

Academy v2 extends the persona definition system from prompt-only output (current) to a two-tier model where personas can also become autonomous Claude Agent SDK agents. The critical architectural decision: we are NOT building a Headmaster, NOT building Tier 2 MCP servers, and NOT building an automated graduation pipeline at this stage. Instead, we fix two broken infrastructure pieces (Metroplex patcher path bug and dead yaml_loader bridge), prove one persona can run as a real agent end-to-end, and then accumulate operational data before automating tier decisions. This repair-first approach delivers the core value (personas that become agents) in 2-4 weeks instead of 8, using components that already exist but have never been connected.

## 2. Recommendation: CONDITIONAL GO

**Top 3 reasons:**

1. **The core capability (persona -> agent) already exists as disconnected pieces.** The Academy has persona YAML with `agent_config`, yce-harness has `yaml_loader.py`, and the Agent SDK is proven (31 completed builds via Metroplex). Connecting these pieces is a small-scope, high-value integration.

2. **The feedback loop is broken and must be fixed regardless of v2.** The Metroplex patcher bug at line 183 has caused 3,412 consecutive patch skips. Fixing this is a prerequisite for any improvement -- v2 or not.

3. **Two tiers are sufficient for current scale and foreseeable demand.** 9 of 10 personas are advisory (Tier 3 permanently). Only 1-3 personas warrant agent promotion in the next quarter. Manual promotion with CI validation is appropriate for this volume.

### Conditions that must be met before proceeding:

1. **Metroplex patcher bug is fixed** and at least one patch successfully applied to the Academy repo
2. **yaml_loader.py is wired into yce-harness** with feature flag and one persona validated as a running agent
3. **Matthew approves the 2-tier model** (Persona/Agent, no Tier 2 MCP servers) -- this is a design simplification that reduces scope but also removes a capability

## 3. Phased Implementation Roadmap

### Phase 1: Repair and Prove (Week 1-2)

**Goal**: Fix broken infrastructure, prove YAML-to-agent path works end-to-end.

| Task | Owner | Effort | Dependency |
|------|-------|--------|------------|
| Fix `gates/patcher.py` line 183: `personas/{id}.yaml` -> `personas/{id}/persona.yaml` | Metroplex | 30 min | None |
| Wire `yaml_loader.py` into yce-harness client init behind `LOAD_AGENTS_FROM_YAML=true` flag | YCE Harness | 1 day | None |
| Run code-reviewer persona as a real Agent SDK agent against a test codebase | Academy + YCE | 1-2 days | yaml_loader wired |
| Fix any issues discovered in the YAML-to-agent bridge | YCE Harness | 1-2 days | Test run |
| Add `tier` field to `PersonaDefinition` types and JSON schema (optional, defaults to "persona") | Academy | 2 hours | None |
| Create `tier.yaml` for all 10 existing personas (all set to `mode: persona`) | Academy | 1 hour | Schema updated |
| Add CI validation: if `agent_config` present, require fidelity >= 70, prompt_file exists, tools resolve | Academy CI | 1 day | None |

**Deliverable**: code-reviewer running as a real agent via the YAML bridge. Patcher bug fixed. All existing personas have tier metadata.

### Phase 2: Tier 1 Agent Scaffolding (Week 3-4)

**Goal**: Scaffold Tier 1 agent infrastructure, promote second persona.

| Task | Owner | Effort | Dependency |
|------|-------|--------|------------|
| Add `agent_config` to 1-2 more personas (sky-lynx and/or carmack) | Academy | 2-4 hours per persona | Phase 1 complete |
| Extend `persona-academy create` CLI with `--agent` flag for Agent mode scaffolding | Academy CLI | 2 days | None |
| Implement Agent mode graduation gates: G1.1 (guardrails), G1.2 (HIL), G1.3 (delegation), G1.4 (safety audit), G1.8 (observability) | Academy | 3 days | Phase 1 complete |
| Create shared `tool_groups.py` module (from Agent SDK Specialist spec) | Academy | 1 day | None |
| Create guardrail hook templates (bash security, read-only, persona boundary) | Academy | 1 day | None |
| Add `agent_config` v2 schema extensions (guardrails, subagents, hil_gates -- all optional) | Academy | 1 day | None |
| Run second persona as real agent, validate graduation gates | Academy + YCE | 2 days | Agent config added |

**Deliverable**: 2-3 personas running as agents. Graduation gates automated where possible. CLI scaffolding for new Agent-mode personas.

### Phase 3: Integration with Metroplex Build Pipeline (Week 5-6)

**Goal**: Connect Academy agent promotions to Metroplex build pipeline.

| Task | Owner | Effort | Dependency |
|------|-------|--------|------------|
| Add `"academy"` to `PriorityItem.source` in Metroplex `models.py` | Metroplex | 15 min | None |
| Add `"academy"` to `buildable_sources` in `gates/build.py` | Metroplex | 15 min | None |
| Create `readers/academy_reader.py` (pattern: `readers/skylynx_reader.py`) | Metroplex | 1 day | Source enum updated |
| Create `spec_templates/tier1_agent_template.md` for Agent SDK builds | Metroplex | 2 days | None |
| Add optional `tier_context` to `PersonaUpgradePatch` in ST Records | ST Records | 1 hour | None |
| Add `TIER_PROMOTION` to `RecommendationType` enum in ST Records | ST Records | 30 min | None |
| Test end-to-end: Academy flags promotion -> Metroplex builds -> YCE generates | All | 2 days | All above |
| Monitor the feedback loop: confirm patches are being applied post-bugfix | Metroplex | Ongoing | Phase 1 bugfix |

**Deliverable**: Academy promotions flow through Metroplex build pipeline. Feedback loop confirmed working.

### Phase 4: Graduation Pipeline with Headmaster (Week 7-8, CONDITIONAL)

**Goal**: If enough data has accumulated and manual promotion has been performed 3+ times, build the Headmaster.

**Gate condition**: Proceed only if:
- At least 10 outcome records in ST Records
- At least 3 manual tier transitions have been performed
- At least 1 patch has been successfully applied by Metroplex
- Matthew confirms the Headmaster adds value over manual promotion

| Task | Owner | Effort | Dependency |
|------|-------|--------|------------|
| Implement Headmaster as CLI command (`persona-academy headmaster run`) | Academy | 3 days | Gate conditions met |
| Implement `stfactory-reader.ts` (read-only SQLite reader for metrics) | Academy | 1 day | None |
| Implement graduation engine (evaluate criteria against ST Records metrics) | Academy | 2 days | Reader built |
| Implement tier-assigner (deterministic decision tree from System Architect spec) | Academy | 1 day | None |
| Add `headmaster run`, `headmaster status`, `headmaster promote` CLI commands | Academy CLI | 1 day | Engine built |
| Set up daily cron for Headmaster (optional, manual invocation first) | Academy | 30 min | CLI working |
| Add 4 new MCP tools to unified server (evaluate_concept, get_tier_status, trigger_build, list_graduates) | Academy | 1 day | Engine built |

**Deliverable**: Headmaster CLI operational, optionally on cron. Automated tier evaluation with manual override capability.

If the gate conditions are NOT met by Week 7, this phase slides to a future quarter and manual promotion continues.

## 4. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | **yaml_loader bridge has undiscovered incompatibilities** with current SDK version | Medium | High (blocks Phase 1) | Test immediately with code-reviewer persona; fix issues before expanding to more personas |
| 2 | **Metroplex patcher bug fix reveals deeper format mismatch** between ST Records patches and Metroplex patch consumer | Medium | Medium (blocks feedback loop) | Inspect patch JSONL format, compare with Metroplex's expected format, fix both ends if needed |
| 3 | **Agent SDK breaking changes** invalidate generated agent code | Low | High | Pin SDK version in requirements.txt, test bridge on each SDK update, keep yce-harness as the canary |
| 4 | **Scope creep**: desire for Headmaster, Tier 2, or automated graduation pipeline creeps back in before data justifies it | High (ENTP pattern) | High (2-month detour) | This document is the scope contract. No Headmaster before 3 manual promotions. No Tier 2 until a concrete use case emerges |
| 5 | **Insufficient operational data** after 6 weeks to justify Headmaster | Medium | Low (manual process continues) | Manual promotion works fine at current scale (1-3 promotions/quarter). Headmaster is optimization, not capability |

## 5. Migration Plan: Existing Personas

All 10 existing personas start in Persona mode. Promotion candidates are identified by whether they need tools and autonomous execution:

| Persona | Current Mode | Target Mode | Rationale | Timeline |
|---------|-------------|-------------|-----------|----------|
| code-reviewer | Persona (has agent_config) | **Agent** | Only persona with agent_config; proven use case (code review) | Phase 1 (Week 1-2) |
| sky-lynx | Persona | **Agent candidate** | Already operates as a cron agent externally; formalizing it in Academy aligns the ecosystem | Phase 2 (Week 3-4) |
| carmack | Persona | Persona | Advisory, no tool use needed | Stays Persona |
| christensen | Persona | Persona | Advisory (JTBD analysis), no tool use needed | Stays Persona |
| porter | Persona | Persona | Advisory (competitive analysis), no tool use needed | Stays Persona |
| drucker | Persona | Persona | Advisory (management theory), no tool use needed | Stays Persona |
| hopper | Persona | Persona | Advisory (systems engineering), no tool use needed | Stays Persona |
| lamport | Persona | Persona | Advisory (distributed systems), no tool use needed | Stays Persona |
| liskov | Persona | Persona | Advisory (software design), no tool use needed | Stays Persona |
| michelangelo | Persona | Persona | Advisory (creative design), no tool use needed | Stays Persona |

**Why most stay Persona mode**: These personas serve their purpose as system prompt templates. They shape Claude's analytical lens through frameworks, voice, and constraints. They do not need tools, state, delegation, or autonomous execution. Promoting them would add complexity without adding capability.

**Future Agent candidates** (not in scope, track for later):
- A "deployment-ops" persona that could manage Railway/systemd deploys
- A "market-researcher" persona that could run research signal ingestion autonomously
- A "qa-engineer" persona that could run test suites and report results

These would be new personas created directly in Agent mode, not promotions of existing advisory personas.

## 6. Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Drop Tier 2 (MCP server per persona)** | Unified MCP server already provides persona-specific tools; nobody has requested per-persona MCP servers; squeezed middle adds complexity without demonstrated value |
| 2 | **Defer Headmaster to Phase 4 (conditional)** | Zero tier transitions have occurred; metrics data too thin for automated decisions; manual promotion takes 15 minutes and happens at most quarterly |
| 3 | **Fix patcher bug before any v2 work** | 3,412 consecutive patch skips; feedback loop has never completed; all downstream automation depends on data that cannot flow until this is fixed |
| 4 | **Wire yaml_loader.py before building new bridges** | The YAML-to-agent path already exists as dead code in yce-harness; connecting it is cheaper and faster than building a new Tier1Dispatcher |
| 5 | **Two modes (Persona/Agent) instead of three tiers** | 9/10 personas are advisory (permanent Persona mode); only 1-3 need Agent mode; binary decision is simpler than 3-tier scoring rubric |
| 6 | **Tier 1 graduation gates relaxed for first agent** | G1.1-G1.4, G1.8 required immediately; G1.5-G1.7, G1.9-G1.10 deferred until test infrastructure exists; G1.11 required before production use |
| 7 | **Preserve System Architect and Curriculum Designer specs as future reference** | Both documents contain sound design that becomes relevant when scale justifies automation; they are not wrong, just premature |
| 8 | **Manual promotion with CI validation is the Phase 1-3 mechanism** | Developer adds agent_config to persona.yaml, CI validates fidelity score, prompt file existence, and tool resolution; human-in-the-loop by default |
| 9 | **Phase 4 is gated on data thresholds** | At least 10 outcome records, 3 manual tier transitions, and 1 successful patch application before Headmaster proceeds; prevents building automation for a process with no training data |
| 10 | **YCE Harness requires ZERO modifications for Academy agents** | YCE is spec-driven; the spec template is the control surface; tier-specific behavior is encoded in generated app specs, not in YCE code |

---

*End of Consolidated Redesign Plan*
