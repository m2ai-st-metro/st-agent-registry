# Agent Persona Academy v2 Redesign -- Agent Team Prompt

Create an agent team to design the architecture and implementation plan for upgrading Agent Persona Academy from a YAML persona factory into a tiered agent graduation system with autonomous execution capabilities.

## Context

Agent Persona Academy currently creates YAML persona definitions (10 personas across 4 departments: engineering, business-strategy, operations, creative). These are NOT autonomous agents -- they are prompt injection templates served via a unified MCP server. The Academy needs to evolve into a system that can produce three tiers of output:

- **Tier 1**: Full autonomous agents built on the Anthropic Agent SDK with tool calling, memory, delegation, and self-directed execution
- **Tier 2**: MCP servers with defined tools, input/output schemas, and Claude Desktop/Code integration
- **Tier 3**: Persona prompt templates (current model -- YAML definitions with system prompts and fidelity validation)

A "Headmaster" agentic process will manage the curriculum: evaluate incoming agent concepts, assign tiers, set graduation criteria, trigger builds via YCE Harness, and promote/demote agents based on performance metrics from Sky-Lynx and ST Factory.

## Existing Codebase (what already exists)

- **Agent Persona Academy** (`projects/agent-persona-academy/`): TypeScript ESM project. 10 personas, unified MCP server, CLI factory, GitHub registry, AJV/Zod validation, fidelity scoring via regex markers. Phases 1-13 complete. Phase 14 ("Fully Developed Agent") is a TBD placeholder.
- **`agent_config` type**: Already added to the persona schema. Fields: `description`, `prompt_file`, `model` (haiku|sonnet|opus|inherit), `tools.groups[]`. Code-reviewer persona already has `agent_config` populated as a prototype.
- **ST Factory** (`projects/st-factory/`): Persona metrics DB, contract store, patch management. Stores performance data per persona. Sky-Lynx writes `PersonaUpgradePatch` records here.
- **Sky-Lynx** (remote: `m2ai-portfolio/sky-lynx`): Weekly analysis agent. Reads usage data, outcome records, and market signals. Generates CLAUDE.md updates and persona improvement patches.
- **Metroplex** (`projects/metroplex/`): L5 autonomous build layer. 3 gates: triage, build (dispatches to YCE Harness), patch (applies persona YAML patches from ST Factory). Already watches `academy_repo = "m2ai-portfolio/agent-persona-academy"`.
- **YCE Harness** (`projects/yce-harness/`): Autonomous AI software engineer. Multi-agent (Haiku orchestrator + Sonnet coders). Builds projects from app specs via Linear issues. Parallel execution via git worktrees.
- **Anthropic Agent SDK**: Python SDK for building autonomous agents with tool use, human-in-the-loop, agent handoffs, guardrails, and MCP server integration.

## Tech Stack Constraints

- Academy core: TypeScript ESM, `@modelcontextprotocol/sdk`, `.js` extensions on all imports
- Tier 1 agents: Python (Anthropic Agent SDK requirement)
- Tier 2 servers: TypeScript (MCP SDK) or Python (mcp[cli])
- Validation: AJV + Zod (existing), extend for tier-specific schemas
- All DB access through existing patterns (SQLite via ST Factory, aiosqlite for Python)

## Inputs

- Current Academy codebase: `projects/agent-persona-academy/`
- Current persona definitions: `projects/agent-persona-academy/personas/*/persona.yaml`
- ST Factory schema: `projects/st-factory/`
- Metroplex gate configs: `projects/metroplex/`
- Anthropic Agent SDK docs: https://docs.anthropic.com/en/docs/agents-and-tools/agent-sdk
- Academy BLUEPRINT.md: `projects/agent-persona-academy/BLUEPRINT.md`

## Team

Spawn 5 teammates with task dependencies:

**Phase 1 -- Parallel Design (all 5 work independently):**

1. **System Architect** -- Design the overall Academy v2 architecture. Your job is to define the system boundary: what stays in the Academy, what lives in ST Factory, what Metroplex handles. Produce:
   - High-level architecture diagram (components, data flow, integration points)
   - Data model for the tiering system (how tiers are stored, what metadata each tier carries)
   - The Headmaster process design: is it a CLI command, a cron job, an MCP tool, or an always-on agent? Define its decision loop, inputs, outputs, and state management
   - Migration path from current Phase 13 to v2 (what breaks, what stays, what gets extended)
   - File/module structure for the new Academy codebase
   Save to outputs/academy_redesign/system_architecture.md.

2. **Agent SDK Specialist** -- Define what Tier 1 autonomous agents look like technically. Read the Anthropic Agent SDK documentation thoroughly. Produce:
   - Reference architecture for a Tier 1 agent: directory structure, entry point, tool registration, memory pattern, guardrails, human-in-the-loop gates
   - How the Academy scaffolds a new Tier 1 agent (what the CLI generates, what the developer fills in, what gets auto-configured from the persona YAML)
   - Agent handoff patterns: how Tier 1 agents delegate to sub-agents or escalate to humans
   - Tool group catalog: define standard tool groups (code_review, research, content, deployment, etc.) that Tier 1 agents can compose from
   - Guardrail templates: what safety constraints ship by default, how they're configured per agent
   - How a Tier 1 agent's `agent_config` extends the existing schema (backward compatible with current Tier 3 personas)
   Save to outputs/academy_redesign/tier1_agent_spec.md.

3. **Integration Architect** -- Map every touchpoint between Academy v2 and the ST Metro ecosystem. Produce:
   - Headmaster -> Metroplex: how the Headmaster submits build requests (triage gate input format, idea schema compatibility)
   - Metroplex -> YCE Harness: how Tier 1/2 agent builds get dispatched (app spec templates per tier, Linear issue format)
   - Sky-Lynx -> Academy: how improvement recommendations flow back (current PersonaUpgradePatch format, extensions needed for tier-aware patches)
   - ST Factory -> Headmaster: what metrics the Headmaster reads to make promotion/demotion decisions (query patterns, thresholds, data freshness)
   - Academy -> GitHub Registry: how graduated agents get published (current registry flow, extensions for Tier 1/2 artifacts)
   - Sequence diagram for the full lifecycle: concept -> tiering -> build -> test -> graduate -> deploy -> monitor -> improve/promote/demote
   Save to outputs/academy_redesign/integration_map.md.

4. **Curriculum Designer** -- Design the tiering criteria and graduation pipeline. This is the Headmaster's brain. Produce:
   - Tiering decision matrix: given an agent concept (name, purpose, required tools, autonomy level, risk profile), how does the Headmaster decide Tier 1 vs 2 vs 3?
   - Graduation criteria per tier:
     * Tier 3 (persona): fidelity score threshold, must_include/must_avoid validation passes, department review
     * Tier 2 (MCP server): all Tier 3 criteria + tool schema validation, input/output contract tests, error handling coverage
     * Tier 1 (autonomous agent): all Tier 2 criteria + guardrail verification, human-in-the-loop gate tests, delegation pattern validation, safety audit pass, performance benchmarks from ST Factory
   - Promotion criteria: what triggers a Tier 3 -> Tier 2 or Tier 2 -> Tier 1 upgrade (usage frequency, success rate, user satisfaction, Sky-Lynx recommendations)
   - Demotion criteria: what triggers a downgrade (failure rate, safety violations, negative feedback loops)
   - Best practices injection: how Sky-Lynx insights, CLAUDE.md patterns, and ST Factory metrics get baked into every agent at graduation time (not as static rules but as living configuration that updates)
   - The "syllabus" concept: a structured set of capabilities an agent must demonstrate before graduating each tier
   Save to outputs/academy_redesign/curriculum_design.md.

5. **Devil's Advocate** -- Your job is to find reasons this redesign could fail or is overengineered. Challenge every other teammate's assumptions. Specifically investigate:
   - Is a 3-tier system necessary or is 2 tiers sufficient? What's the marginal value of Tier 2 (MCP server) over just having Tier 1 (autonomous) and Tier 3 (persona)?
   - Does the Headmaster create a single point of failure? What happens when it makes a wrong tiering decision?
   - Is the Anthropic Agent SDK mature enough to build production Tier 1 agents, or are we building on shifting sand?
   - How much of this can be done with the EXISTING Academy + manual decisions vs. building an automated Headmaster?
   - What's the minimum viable version that delivers value in 2 weeks vs. the full vision that takes 2 months?
   - Are we solving a real problem (agents that need autonomy) or an aesthetic one (we don't like calling them "personas")?
   Save your contrarian analysis to outputs/academy_redesign/devils_advocate.md.

**Phase 2 -- Cross-Review and Debate:**

After each teammate completes their initial analysis, have them share their top 3 findings with the group. The Devil's Advocate should then challenge at least 2 other teammates' conclusions -- specifically the System Architect's Headmaster design and the Curriculum Designer's tiering criteria. Let the debate play out.

The Integration Architect should verify that the System Architect's design actually connects to the existing ST Metro components without requiring rewrites of Metroplex, ST Factory, or Sky-Lynx.

The Agent SDK Specialist should validate the Curriculum Designer's Tier 1 graduation criteria against what the Anthropic Agent SDK actually supports today (not what it might support in the future).

**Phase 3 -- Synthesis:**

After all 5 are done and the debate has resolved, synthesize into a single implementation plan with:

- Executive summary (5 sentences max): what we're building, why, and the key architectural decision
- GO / CONDITIONAL / RETHINK recommendation with top 3 reasons
- If CONDITIONAL: what conditions must be met before proceeding
- Phased implementation roadmap:
  * Phase 1 (Week 1-2): Minimum viable Headmaster + tiering data model
  * Phase 2 (Week 3-4): Tier 1 agent scaffolding via Agent SDK
  * Phase 3 (Week 5-6): Integration with Metroplex build pipeline
  * Phase 4 (Week 7-8): Graduation pipeline with Sky-Lynx feedback loop
- Risk register: top 5 risks with mitigations
- Migration plan: how existing 10 personas transition (which stay Tier 3, which are candidates for promotion)
- Decision log: key decisions made during the debate and their rationale

Save the consolidated plan to outputs/academy_redesign/consolidated_redesign_plan.md.
