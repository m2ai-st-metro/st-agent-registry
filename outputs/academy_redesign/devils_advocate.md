# Devil's Advocate: Agent Persona Academy v2 Redesign

**Agent**: Devil's Advocate
**Date**: 2026-03-02
**Scope**: Critical analysis of the proposed 3-tier Academy redesign with Headmaster orchestrator

---

## Executive Summary

The proposed redesign layers significant new automation on top of a foundation that is largely unproven at runtime. The Academy is a well-built YAML definition system with 10 personas, but those personas have near-zero operational consumption today. The supporting ecosystem (ST Records, Metroplex, Sky-Lynx) has real infrastructure but extremely thin data -- 2 outcome records, 2 persona patches (both skipped 3,412 times by Metroplex), and 8 improvement recommendations (3 of which are dry-run stubs). Building a Headmaster to automate tiering decisions when there is no history of manual tiering decisions to learn from is building a control system for a process that does not yet exist.

**Recommendation: TRIM** -- build a minimal Tier 1 agent from an existing persona using the YAML loader that already exists in yce-harness, prove it works end-to-end with a real use case, then decide if automation is warranted.

---

## Investigation 1: Is a 3-Tier System Necessary, or Is 2 Tiers Sufficient?

### What I Found

The 10 existing personas break down as follows:

| Persona | Department | Has `agent_config`? | Realistic tier need |
|---------|-----------|---------------------|-------------------|
| christensen | business-strategy | No | Tier 3 (prompt template) -- advisory, no tool use |
| porter | business-strategy | No | Tier 3 -- advisory, no tool use |
| drucker | business-strategy | No | Tier 3 -- advisory, no tool use |
| carmack | engineering | No | Tier 3 -- advisory, no tool use |
| hopper | engineering | No | Tier 3 -- advisory, no tool use |
| lamport | engineering | No | Tier 3 -- advisory, no tool use |
| liskov | engineering | No | Tier 3 -- advisory, no tool use |
| michelangelo | creative | No | Tier 3 -- advisory, no tool use |
| sky-lynx | operations | No | Already operates as Sky-Lynx agent separately, not via Academy |
| code-reviewer | engineering | **Yes** | Tier 1 or Tier 2 -- only persona with agent_config |

### The Tier 2 Problem

Tier 2 (MCP server with defined tools) is the squeezed middle. Consider:

- **Tier 3** (prompt template) is what 9 of 10 personas already are. They work. They shape Claude's behavior through system prompts. No tool integration needed.
- **Tier 1** (autonomous agent) is what you actually want when a persona needs to DO things -- read code, run tests, interact with external systems.
- **Tier 2** (MCP server) is... what exactly? An MCP server that exposes persona-specific tools? The Academy already HAS a unified MCP server with 7 tools. The incremental value of wrapping a single persona in its own MCP server vs. just promoting it to a full agent is unclear.

The one valid Tier 2 use case would be: "I want a persona available as tools in Claude Desktop without running a full autonomous agent." But the Academy's unified server already does this via `switch_persona` + `persona_analyze`.

### Verdict

Two tiers are sufficient: Tier 3 (prompt template, the current model) and Tier 1 (autonomous agent via Claude Agent SDK). Tier 2 is architectural over-engineering that adds a middle layer nobody has asked for. The unified MCP server already covers the "tools without autonomy" case.

### Alternative

Drop Tier 2. Define two modes: **Persona** (YAML -> system prompt, current behavior) and **Agent** (YAML + agent_config -> AgentDefinition, using the yaml_loader.py pattern that already exists in yce-harness).

---

## Investigation 2: Does the Headmaster Create a Single Point of Failure?

### What I Found

The Headmaster concept proposes an agentic process that:
1. Reads ST Records metrics
2. Reads Sky-Lynx recommendations
3. Decides when to promote/demote personas between tiers
4. Executes the promotion (builds agent code, configures MCP servers)

### The Problems

**Problem 1: No training data.** There have been exactly zero tier transitions to date. The Headmaster would be making decisions with no historical precedent for what a "good" transition looks like. This is automating a process that has never been performed manually.

**Problem 2: Irreversibility risk.** Promoting a persona from Tier 3 to Tier 1 means generating agent code, prompt files, tool configurations, and potentially MCP server boilerplate. If the promotion is wrong (agent performs poorly), rollback requires understanding and reverting generated artifacts. There's no rollback mechanism proposed.

**Problem 3: ST Records metrics are too thin to drive decisions.** The data:
- 2 outcome records total (1 published, 1 deferred)
- 8 improvement recommendations (3 are dry-run stubs with "Example recommendation")
- 2 persona patches (both repeatedly skipped by Metroplex -- 3,412 skip records)
- 0 applied patches, 0 applied recommendations

This is not enough signal to make automated tiering decisions. The Headmaster would either make arbitrary decisions or sit idle.

**Problem 4: Matthew already decides.** The `code-reviewer` persona was manually given an `agent_config` section. That took maybe 15 minutes. The Headmaster would automate a decision that currently takes 15 minutes and happens maybe once a quarter.

### Verdict

The Headmaster is premature optimization. Automating a decision that has never been made manually, using metrics from a system with near-zero data, is building a thermostat for a house that has no heating system.

### Alternative

Manual promotion: Matthew tags a persona for upgrade in the YAML (`tier: agent`), the existing yaml_loader.py in yce-harness picks it up. If you want guardrails, add a `promotion_checklist` to the persona schema: minimum fidelity score, required agent_config fields, required test coverage. Let the CI pipeline validate these requirements. The Headmaster can be built later when there are enough promotions to justify automation.

---

## Investigation 3: Is the Anthropic Agent SDK Mature Enough?

### What I Found

The yce-harness project is a substantial implementation using `claude_agent_sdk`:
- Multi-agent orchestrator with 6 specialized agents (linear, coding, github, slack, qa, code_review)
- Parallel execution via git worktrees
- Security hooks (bash command allowlist)
- Pre/post tool-use hooks, subagent lifecycle hooks
- Worker subprocess model for isolation

**Positive indicators:**
- No TODO/FIXME/HACK/workaround comments in the codebase
- Clean type annotations throughout
- Production-level error handling with actionable guidance per error type
- Arcade MCP integration working for Linear, GitHub, Slack
- The SDK supports `AgentDefinition` with model selection, tool configuration, and hooks

**Concerns:**
- The `claude_agent_sdk` import is `from claude_agent_sdk`, not `from anthropic.agent` -- this appears to be a standalone SDK, not part of the main Anthropic Python client. SDK stability and long-term support are worth monitoring.
- `max_turns=500` in worker.py suggests sessions can get very long -- this is empirical tuning, not API-level guardrails
- Environment variable manipulation (`os.environ.pop("ANTHROPIC_API_KEY", None)`) in worker.py hints at SDK initialization quirks that needed working around
- The `LOAD_AGENTS_FROM_YAML` feature in yaml_loader.py is documented but never actually wired into any client initialization code -- it's dead functionality

**Metroplex is using yce-harness in production:**
- 31 completed build jobs
- 6 published items
- Systemd service running continuously (10,622+ cycles)
- Real specs being generated and dispatched

### Verdict

The SDK is mature enough for building agents. yce-harness proves this. But the Academy's yaml_loader bridge is NOT being used in production -- it exists as dead code. The claim that you can go from persona YAML to running agent is technically possible but has never been validated end-to-end.

### Recommendation

Before designing the v2 architecture, validate the existing bridge: set `LOAD_AGENTS_FROM_YAML=true`, wire it into the yce-harness client, and run `code-reviewer` (the only persona with `agent_config`) as an actual SDK agent against a real codebase. This proves the path from YAML to agent works before investing in automation around it.

---

## Investigation 4: How Much Can Be Done with Existing Academy + Manual Decisions?

### What Already Exists

1. **Academy YAML schema** -- mature, validated, 10 personas, CI/CD pipeline
2. **`agent_config` field in PersonaDefinition** -- already defined in `types.ts`, already used by `code-reviewer` persona
3. **`yaml_loader.py` in yce-harness** -- loads persona YAML, produces `AgentDefinition` objects, resolves tool groups, model selection with env var overrides
4. **Metroplex patcher (Gate 3)** -- reads patches from ST Records, applies YAML modifications to Academy repo via git
5. **yce-harness build orchestrator** -- dispatches to Claude Agent SDK, manages parallel workers

### What's Missing vs. What the Redesign Proposes

| Capability | Already Exists? | Redesign Proposes |
|-----------|----------------|------------------|
| Define a persona as YAML | Yes | Same |
| Tag a persona for agent promotion | Yes (`agent_config` field) | Headmaster decides automatically |
| Convert persona YAML to AgentDefinition | Yes (yaml_loader.py) | New "Agent Builder" component |
| Run the agent | Yes (yce-harness) | Same SDK, new wrapping |
| Apply persona patches | Yes (Metroplex Gate 3) | Headmaster coordinates |
| Validate promotion readiness | Partial (fidelity tests) | New promotion criteria engine |

### Verdict

80% of the redesign's capabilities already exist as disconnected pieces. The missing piece is not a Headmaster -- it's wiring the existing pieces together and proving they work. Specifically:

1. Wire `yaml_loader.py` into yce-harness client initialization (currently dead code)
2. Add more `agent_config` sections to personas that warrant agent behavior
3. Use existing Metroplex + ST Records pipeline for patches

The redesign proposes building new coordination layers when the existing layers have not been connected yet.

---

## Investigation 5: Minimum Viable Version (2 Weeks) vs. Full Vision (2 Months)

### 2-Week MVP: "Academy Agent Bridge"

**Goal**: One persona running as a real agent, end-to-end, consumed by yce-harness or Metroplex.

**Week 1:**
1. Wire `yaml_loader.py` into yce-harness client startup (add feature flag, not a rewrite)
2. Validate `code-reviewer` agent_config produces a working AgentDefinition
3. Run code-reviewer as an actual agent against a real PR or codebase
4. Fix any issues in the YAML-to-agent bridge

**Week 2:**
5. Add `agent_config` to one more persona (e.g., sky-lynx operations persona)
6. Add promotion validation to CI: if `agent_config` is present, require minimum fidelity score, require prompt_file exists, require tools resolve
7. Document the persona-to-agent path in CLAUDE.md

**Deliverables:**
- Proven YAML-to-agent pipeline
- 2 personas running as real agents
- CI gate for agent-capable personas
- Documentation

### 2-Month Full Vision

Everything above plus:
- Headmaster orchestrator (automated tiering)
- Tier 2 MCP server generation
- Promotion/demotion state machine
- ST Records metrics integration for tiering decisions
- Dashboard showing persona tiers and transition history
- Automated agent test suite (beyond fidelity -- behavioral testing)

### Verdict

The 2-week version delivers the core value (personas that actually run as agents) while the 2-month version adds automation around decisions that don't need automation yet. Ship the bridge first. You can always add the Headmaster when there are enough manual tier transitions to justify it.

---

## Investigation 6: Are We Solving a Real Problem or an Aesthetic One?

### The Real Problem Test

**Has anyone NEEDED an autonomous agent and couldn't get one?**

No. The yce-harness already has 6 hardcoded agent definitions that work. Metroplex uses them to build real projects (31 completed builds, 6 published). When Matthew needed a code review agent, he added `agent_config` directly to the persona YAML and created `yaml_loader.py`. This took hours, not weeks.

**What problem does the redesign actually solve?**

The redesign solves: "I want to add a new persona and have it automatically become an agent when it's ready, without manually editing agent definitions."

This is a valid problem, but it's a workflow optimization problem, not a capability gap. The current process works. It's manual. The redesign automates it. The question is whether the automation cost (2 months) is justified by the frequency of the operation (maybe 2-3 new agents per quarter).

**What we actually don't like:**

We don't like that:
1. The persona YAMLs are beautifully defined but mostly unused at runtime
2. The yaml_loader.py bridge exists but is dead code
3. The ST Records data loop (Sky-Lynx -> recommendations -> patches -> Academy) has never successfully applied a single patch

These are real problems, but they're connectivity problems, not architectural problems. The redesign proposes new architecture when the fix is plugging existing pieces together.

### Verdict

This is 30% real problem (disconnected systems) and 70% aesthetic problem (desire for elegant automation). The real problem can be solved in 2 weeks. The aesthetic problem requires 2 months and creates new systems that need maintenance.

---

## Investigation 7: Reality Check -- Is the Ecosystem Ready?

### ST Records Metrics DB

| Table | Records | Status |
|-------|---------|--------|
| outcome_records | 2 | Minimal -- 1 published, 1 deferred |
| improvement_recommendations | 8 | 3 are dry-run stubs ("Example recommendation") |
| persona_patches | 2 | Both proposed, neither applied |
| research_signals | 266 | Active -- research agents are producing |

**Assessment**: Research signal ingestion works. Everything downstream is starved for data. The feedback loop (outcomes -> recommendations -> patches -> applied) has never completed a single cycle.

### Metroplex Build System

| Metric | Value | Assessment |
|--------|-------|------------|
| Cycles | 10,622+ | Running continuously |
| Triage approvals | 159 | Active |
| Build jobs completed | 31 | Working |
| Published items | 6 | Working |
| Patches applied | 0 | ZERO -- all 3,412 attempts skipped |
| Skip reason | "no operations in patch" | Patch format mismatch |

**Assessment**: Metroplex is a real, running production system. Its build pipeline works (31 completed builds, 6 published). But its patch pipeline is completely broken -- 3,412 consecutive failures with the same error ("no operations in patch"). The patches from ST Records are being read but their operations aren't being extracted correctly. This is a bug, not a design issue, but it means the Academy feedback loop has never closed.

### Sky-Lynx

- Produced 8 recommendations, 5 real + 3 dry-run stubs
- None have been applied
- The recommendation -> patch path has produced 2 patches but neither has been successfully applied by Metroplex
- Sky-Lynx is producing signal but the downstream pipeline cannot consume it

### YCE Harness

- Working production system with Claude Agent SDK
- 6 hardcoded agent definitions, tested and operational
- yaml_loader.py exists but is dead code (never called by any client)
- `LOAD_AGENTS_FROM_YAML` env var documented but not wired in

### Academy

- 10 well-defined personas with validation, fidelity testing, CI/CD
- Only 1 persona (code-reviewer) has an `agent_config` section
- The unified MCP server works but it's unclear how often it's actually used
- The yaml_loader bridge to yce-harness has never been exercised in production

### Verdict

The ecosystem is half-built. Research signals flow. Builds work. But the feedback loop from Sky-Lynx through ST Records through Metroplex back to Academy has never completed. Specifically:

1. The patch format between ST Records and Metroplex is broken (3,412 skips)
2. The yaml_loader bridge is dead code
3. Only 1 of 10 personas has agent_config

**Layering a Headmaster on top of this is premature.** Fix the existing pipeline first:
- Fix the Metroplex patcher to correctly extract operations from ST Records patches
- Wire yaml_loader.py into yce-harness
- Add agent_config to more personas
- Close one complete feedback loop cycle

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Headmaster makes wrong tiering decision | High (no training data) | Medium (generates bad agent code) | Don't build it yet; manual tiering |
| Tier 2 layer adds complexity with no users | High | Low (just wasted effort) | Drop Tier 2 |
| SDK breaking changes invalidate agent code | Medium | High | Pin SDK version, validate bridge first |
| Full redesign takes 2+ months, delays other work | High (ENTP scope creep risk) | High (opportunity cost) | Ship 2-week MVP instead |
| Existing patch pipeline remains broken | Very High (it's broken now) | High (no feedback loop) | Fix Metroplex patcher bug first |
| yaml_loader dead code drifts from SDK API | Medium | Medium | Wire it in now, keep it tested |

---

## Final Recommendation: TRIM

**Do not build the full 3-tier system with Headmaster.**

Instead, execute this phased approach:

### Phase 0: Fix What's Broken (1-2 days)
- Fix the Metroplex patcher bug ("no operations in patch") so the ST Records -> Academy feedback loop can close
- This is blocking everything downstream and has been broken for weeks

### Phase 1: Prove the Bridge (1 week)
- Wire yaml_loader.py into yce-harness client initialization behind `LOAD_AGENTS_FROM_YAML=true`
- Run code-reviewer as a real agent via the YAML bridge
- Fix any issues discovered

### Phase 2: Expand Coverage (1 week)
- Add `agent_config` to 1-2 more personas that warrant it (sky-lynx is the obvious candidate)
- Add CI validation: if `agent_config` present, require fidelity score, prompt file, tool resolution
- Document the promotion path

### Phase 3: Evaluate (after 4-6 weeks of operation)
- How many personas actually needed agent promotion?
- Did the manual process bottleneck anything?
- Is there enough data in ST Records to justify automated tiering?
- Only THEN consider building a Headmaster

### What Gets Cut
- Tier 2 (MCP server per persona) -- the unified server already covers this
- Headmaster orchestrator -- manual tiering is sufficient for the current scale
- Automated promotion/demotion state machine -- no training data exists
- New dashboard for tiering -- the weekly retrospective already shows ecosystem health

### What Gets Built
- Working yaml_loader.py integration (connecting existing dead code)
- 2-3 more agent_configs in persona YAMLs
- CI gate for agent-capable personas
- Fixed Metroplex patcher (closing the feedback loop)

This delivers the core value (personas that become agents) in 2 weeks instead of 2 months, without building automation for decisions that happen quarterly at most.

---

*The filter exists to prevent optionality-as-strategy and keep focus on the beachhead market.*
