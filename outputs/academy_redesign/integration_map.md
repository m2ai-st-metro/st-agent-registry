# Academy v2 Integration Map

## ST Metro Ecosystem Touchpoint Analysis

**Author**: Integration Architect Agent
**Date**: 2026-03-02
**Scope**: Every integration point between Academy v2 (tiered agent graduation) and existing ST Metro components

---

## Table of Contents

1. [System Inventory & Current State](#1-system-inventory--current-state)
2. [Headmaster -> Metroplex: Build Request Submission](#2-headmaster---metroplex-build-request-submission)
3. [Metroplex -> YCE Harness: Agent Build Dispatch](#3-metroplex---yce-harness-agent-build-dispatch)
4. [Sky-Lynx -> Academy: Improvement Recommendations](#4-sky-lynx---academy-improvement-recommendations)
5. [ST Records -> Headmaster: Metrics for Promotion/Demotion](#5-st-records---headmaster-metrics-for-promotiondemotion)
6. [Academy -> GitHub Registry: Graduated Agent Publishing](#6-academy---github-registry-graduated-agent-publishing)
7. [Full Lifecycle Sequence Diagram](#7-full-lifecycle-sequence-diagram)
8. [Interface Gap Analysis](#8-interface-gap-analysis)
9. [Modification Impact Matrix](#9-modification-impact-matrix)

---

## 1. System Inventory & Current State

### Academy (current)
- **Location**: `/home/apexaipc/projects/agent-persona-academy/`
- **What it is**: YAML persona definitions + TypeScript MCP server + CLI tools
- **Personas**: 10 personas across 4 departments (engineering, business-strategy, operations, creative)
- **Schema**: `schema/persona-schema.json` -- JSON Schema v7 with `agent_config` optional section
- **MCP tools**: 7 tools (list_personas, switch_persona, persona_analyze, get_framework, get_case_study, get_active_persona, list_departments)
- **Registry**: GitHub-based at `m2ai-portfolio/persona-registry`, cached locally at `~/.persona-academy/personas/`
- **Key type**: `PersonaDefinition` in `src/core/types.ts` (lines 289-310)
- **Agent config**: Optional `agent_config` section with `description`, `prompt_file`, `model` (haiku|sonnet|opus|inherit), and `tools` (groups/additional/exclude)

### ST Records
- **Location**: `/home/apexaipc/projects/st-records/`
- **Database**: `data/persona_metrics.db` (SQLite)
- **Tables**: `outcome_records`, `improvement_recommendations`, `persona_patches`, `research_signals`
- **Contract store**: `contracts/store.py` -- `ContractStore` class, dual-writes JSONL + SQLite
- **Key contracts**:
  - `ImprovementRecommendation` (`contracts/improvement_recommendation.py`) -- Sky-Lynx -> Academy
  - `PersonaUpgradePatch` (`contracts/persona_upgrade_patch.py`) -- Academy patching
  - `OutcomeRecord` (`contracts/outcome_record.py`) -- terminal pipeline results
  - `ResearchSignal` (`contracts/research_signal.py`) -- market signals

### Metroplex
- **Location**: `/home/apexaipc/projects/metroplex/`
- **Database**: `data/metroplex.db` (SQLite)
- **Config**: `config.py` -- `academy_repo = "m2ai-portfolio/agent-persona-academy"`
- **Gates**:
  - Gate 1 (Triage): `gates/triage.py` -- reads IdeaForge, scores, enqueues to priority queue
  - Gate 2 (Build): `gates/build.py` -- generates specs, dispatches YCE Harness builds
  - Gate 3 (Patch): `gates/patcher.py` -- reads proposed patches from ST Records, applies to Academy repo
  - Gate 4 (Publish): `gates/publish.py` -- pushes completed builds to GitHub
- **Priority queue model**: `PriorityItem` -- `source` is `Literal["ideaforge", "skylynx", "linear"]`
- **Spec templates**: `spec_templates/app_spec_template.md` -- Jinja2 with `artifact_type` branching (tool|agent|product)
- **LLM expander**: `gates/llm_expander.py` -- Claude-powered spec generation for idea-specific builds
- **Dispatcher**: `dispatcher.py` -- routes to EA-Claude workers (starscream, ravage, soundwave, astrotrain)

### YCE Harness
- **Location**: `/home/apexaipc/projects/yce-harness/`
- **App spec format**: Markdown document at `prompts/app_spec.txt`
- **Orchestrator**: Multi-agent (Haiku orchestrator -> linear, coding, qa, code_review, github, slack agents)
- **Build output**: `generations/<job-id>/` with isolated git repos
- **Queue runner**: `queue_runner.py` with add/start/status commands

### IdeaForge
- **Location**: `/home/apexaipc/projects/ideaforge/`
- **Database**: `data/ideaforge.db` (SQLite)
- **Key table**: `ideas` with columns: id, title, description, problem_statement, target_audience, weighted_score, artifact_type, status
- **Idea statuses**: unscored -> scored -> classified -> exported
- **Artifact types**: tool, agent, product, dismiss

### Sky-Lynx
- **Remote**: `m2ai-portfolio/sky-lynx`
- **Function**: Weekly analysis of usage insights, generates `ImprovementRecommendation` records in ST Records
- **Output**: Recommendations with `RecommendationType` enum and `TargetScope` (specific_persona, all_personas, all_in_department)

---

## 2. Headmaster -> Metroplex: Build Request Submission

### Current Interface: Metroplex Triage Gate Input

Metroplex Gate 1 reads from IdeaForge's `ideas` table via `readers/ideaforge_reader.py`:

```python
# IdeaForgeReader.get_unprocessed_ideas() returns ideas where:
# - status = 'classified'
# - weighted_score IS NOT NULL
# Fields: id, title, description, problem_statement, target_audience,
#         weighted_score, artifact_type, signal_count, status
```

Gate 1 then converts approved ideas into `PriorityItem` objects:

```python
class PriorityItem(BaseModel):
    source: Literal["ideaforge", "skylynx", "linear"]
    source_id: str
    title: str
    description: str
    priority_score: float
    status: Literal["pending", "dispatched", "completed", "failed"] = "pending"
    idea_data: str = ""  # JSON string with full data for spec generation
```

### What Headmaster Needs to Do

The Headmaster process decides that a persona should be promoted to Tier 1 (autonomous agent) or Tier 2 (MCP server). It needs to submit a build request to Metroplex.

**Option A: Write directly to Metroplex priority queue (RECOMMENDED)**

The Headmaster can write a `PriorityItem` directly to the Metroplex priority queue via the `StateDB.enqueue_item()` method, bypassing triage (like Sky-Lynx recommendations already do). This requires:

1. **New source value**: Add `"academy"` to the `PriorityItem.source` literal union:
   - File: `/home/apexaipc/projects/metroplex/models.py`, line 78
   - Change: `source: Literal["ideaforge", "skylynx", "linear"]` -> `source: Literal["ideaforge", "skylynx", "linear", "academy"]`

2. **New reader**: Create `readers/academy_reader.py` that reads promotion decisions from a Headmaster-maintained table or JSONL file. Pattern follows `readers/skylynx_reader.py`.

3. **idea_data format**: The JSON payload stored in `idea_data` must contain the fields expected by `SpecGenerator.generate_spec()`:
   ```json
   {
     "id": "promo-christensen-t1-20260302",
     "title": "Christensen Tier 1 Agent",
     "description": "Autonomous agent implementing Clayton Christensen's disruption theory...",
     "problem_statement": "Need an autonomous agent that can run JTBD analyses without human steering",
     "target_audience": "ST Metro ecosystem",
     "artifact_type": "agent",
     "_source": "academy",
     "_tier": "tier1",
     "_persona_id": "christensen",
     "_promotion_reason": "90/100 fidelity, 15 successful analyses, 0 failures in 30 days"
   }
   ```

4. **Build gate filtering**: Metroplex `BuildOrchestrator.run_from_queue()` (line 610) currently filters to `buildable_sources = ("ideaforge", "linear")`. Add `"academy"` to this tuple.

**Option B: Write to IdeaForge as a synthetic idea**

The Headmaster writes promotion requests as new rows in the IdeaForge `ideas` table with status='classified' and a high weighted_score. This avoids any Metroplex changes but conflates persona promotions with market-signal ideas. NOT RECOMMENDED due to semantic pollution.

### Spec Template Extension for Agent Tiers

The current `spec_templates/app_spec_template.md` branches on `artifact_type` (tool|agent|product). For Academy v2:

- **Tier 1 (autonomous agent)**: Needs a NEW spec template section that includes:
  - Claude Agent SDK setup (from `yce-harness/agents/` pattern)
  - Persona YAML injection into system prompt
  - Tool group resolution from `agent_config.tools`
  - Model tier from `agent_config.model`
  - Linear integration for task tracking
  - Deployment config (systemd service or Docker)

- **Tier 2 (MCP server)**: Needs a template that:
  - Generates a standalone MCP server (TypeScript, `@modelcontextprotocol/sdk`)
  - Imports persona YAML and generates tools from frameworks
  - Follows the existing `src/unified-server/` pattern but for a single persona

**Recommendation**: Create two new Jinja2 templates:
- `spec_templates/tier1_agent_template.md`
- `spec_templates/tier2_mcp_template.md`

The LLM expander (`gates/llm_expander.py`) should also receive a tier-aware prompt variant.

### Changes Required to Metroplex

| Change | File | Type | Impact |
|--------|------|------|--------|
| Add `"academy"` to PriorityItem.source | `models.py:78` | Modify enum | LOW -- backward compatible |
| Add `"academy"` to buildable_sources | `gates/build.py:610` | Modify tuple | LOW |
| Create `readers/academy_reader.py` | New file | New file | NONE -- additive |
| Create tier1/tier2 spec templates | `spec_templates/` | New files | NONE -- additive |
| Update LLM expander prompt for tier awareness | `gates/llm_expander.py` | Modify prompt | LOW |

---

## 3. Metroplex -> YCE Harness: Agent Build Dispatch

### Current Flow

1. Metroplex `BuildOrchestrator.run_from_queue()` pulls pending items from priority queue
2. `SpecGenerator.generate_spec()` produces a markdown app spec file at `data/specs/app_spec_{id}.txt`
3. `queue_build()` calls `queue_runner.py add <spec_path> --id <job_id> --model <model>`
4. `start_queue_background()` starts `queue_runner.py start --concurrency N`
5. YCE orchestrator reads `prompts/app_spec.txt` (or specified spec) and coordinates agents
6. Build output lands at `generations/<job_id>/` with an initialized git repo

### App Spec Format Requirements

The YCE orchestrator (`prompts/orchestrator_prompt.md`) expects a spec with:
- Title and overview
- Tech stack
- Features (numbered, with test steps)
- File structure
- Success criteria
- Environment setup

### Tier-Specific Build Dispatch

**Tier 1 Agent Builds**

A Tier 1 agent needs:
1. **System prompt**: Generated from the persona YAML's voice, frameworks, case_studies, and analysis_patterns
2. **Agent scaffolding**: Claude Agent SDK setup with tool definitions resolved from `agent_config.tools.groups`
3. **Model selection**: From `agent_config.model` (haiku/sonnet/opus)
4. **Deployment artifacts**: systemd service file, health check endpoint
5. **Integration hooks**: Linear issue tracking, Slack notifications

The app spec for a Tier 1 build should include:
```markdown
# {Persona Name} - Tier 1 Autonomous Agent

## Persona Source
- Academy persona: {persona_id}
- Persona YAML path: personas/{persona_id}/persona.yaml
- Agent config model: {agent_config.model}
- Tool groups: {agent_config.tools.groups}

## Architecture
Claude Agent SDK orchestrator with:
- System prompt: loaded from persona YAML
- Tools: resolved from tool group definitions
- Model: {model}
...
```

**Tier 2 MCP Server Builds**

A Tier 2 MCP server needs:
1. **MCP server scaffold**: TypeScript with `@modelcontextprotocol/sdk`
2. **Persona-specific tools**: Generated from frameworks and analysis_patterns
3. **Tool definitions**: From the existing Academy tool pattern (`src/unified-server/tools.ts`)
4. **Build & deploy**: `npm run build`, Claude Desktop config pointing to `dist/index.js`

### Linear Issue Format

Metroplex currently creates Linear issues via the `linear_reader.py` intake path. For Academy builds, the Headmaster should create a Linear issue with:

```
Title: [Academy] Promote {persona_name} to Tier {N}
Description: Build autonomous agent/MCP server for {persona_name}
Labels: metroplex, academy, tier-{n}
Priority: Based on promotion score
```

The `linear_reader.py` already handles ingestion of labeled Linear issues into the priority queue with `linear_weight = 2.0` (highest weight).

### Changes Required to YCE Harness

| Change | File | Type | Impact |
|--------|------|------|--------|
| None required | -- | -- | YCE Harness is spec-driven; it builds whatever the spec says |

The YCE Harness itself needs NO modification. The spec template is the control surface. All tier-specific behavior is encoded in the generated app spec that Metroplex produces.

---

## 4. Sky-Lynx -> Academy: Improvement Recommendations

### Current Flow

1. Sky-Lynx runs weekly analysis of Claude Code usage insights
2. Generates `ImprovementRecommendation` records via `ContractStore.write_recommendation()`
3. Records land in ST Records's `improvement_recommendations` table
4. `persona_upgrader.py` (`st-records/scripts/`) consumes recommendations where `target_system = "persona"`
5. Calls Claude to generate `PersonaUpgradePatch` records
6. Patches stored in `persona_patches` table with status='proposed'
7. Metroplex Gate 3 (`gates/patcher.py`) reads proposed patches and applies to Academy repo

### ImprovementRecommendation Format (current)

```python
class ImprovementRecommendation(BaseModel):
    recommendation_id: str
    recommendation_type: RecommendationType  # voice_adjustment, framework_addition, etc.
    target_system: str = "persona"           # persona | claude_md | pipeline
    title: str
    description: str
    suggested_change: str
    scope: TargetScope                        # specific_persona | all_personas | all_in_department
    target_persona_ids: list[str]
    target_department: str | None
    priority: str = "medium"                  # high | medium | low
    evidence: EvidenceBasis
    status: str = "pending"
```

### PersonaUpgradePatch Format (current)

```python
class PersonaUpgradePatch(BaseModel):
    patch_id: str
    persona_id: str
    patches: list[PersonaFieldPatch]  # JSON Pointer operations
    rationale: str
    source_recommendation_ids: list[str]
    from_version: str = "0.0.0"
    to_version: str = "0.1.0"
    schema_valid: bool = True
    status: str = "proposed"  # proposed | applied | rejected
```

### Extensions Needed for Tier-Aware Patches

Currently, the `PersonaUpgradePatch` operates on persona YAML fields via JSON Pointer paths (e.g., `/voice/phrases/-`, `/frameworks/new_fw`). For Academy v2 with tiers:

**1. Tier metadata in patches**

The `PersonaUpgradePatch` needs an optional `tier_context` field:

```python
class PersonaUpgradePatch(BaseModel):
    # ... existing fields ...
    tier_context: dict | None = None  # NEW
    # Example: {"current_tier": "tier3", "recommended_tier": "tier1", "promotion_evidence": "..."}
```

This is backward compatible -- existing patches leave `tier_context = None`.

**2. New RecommendationType values**

Add to the `RecommendationType` enum in `contracts/improvement_recommendation.py`:

```python
class RecommendationType(str, Enum):
    # ... existing values ...
    TIER_PROMOTION = "tier_promotion"       # NEW: recommend moving to higher tier
    TIER_DEMOTION = "tier_demotion"         # NEW: recommend moving to lower tier
    AGENT_CONFIG_CHANGE = "agent_config_change"  # NEW: change agent_config section
```

**3. Patch gate awareness of tiers**

Metroplex Gate 3 (`gates/patcher.py`) currently patches `personas/{persona_id}.yaml` files. For tier promotions, the patcher needs to:
- Detect `tier_promotion` patches
- Trigger a build request (enqueue a `PriorityItem` with source="academy") rather than modifying YAML

**4. Target file path update**

The patcher currently assumes `personas/{persona_id}.yaml` (line 183). The actual Academy layout is `personas/{persona_id}/persona.yaml` (with persona.yaml inside a directory). This is already a latent bug that needs fixing.

### Changes Required

| Change | File | Project | Impact |
|--------|------|---------|--------|
| Add `tier_context` to PersonaUpgradePatch | `contracts/persona_upgrade_patch.py` | ST Records | LOW -- optional field |
| Add TIER_PROMOTION/DEMOTION/AGENT_CONFIG types | `contracts/improvement_recommendation.py` | ST Records | LOW -- enum extension |
| Fix target path to `personas/{id}/persona.yaml` | `gates/patcher.py:183` | Metroplex | BUG FIX |
| Handle tier_promotion patches as build requests | `gates/patcher.py` | Metroplex | MEDIUM -- new logic branch |

---

## 5. ST Records -> Headmaster: Metrics for Promotion/Demotion

### Available Data in ST Records

The Headmaster needs to make tier decisions. Here is what it can read from ST Records's `persona_metrics.db`:

#### Table: `outcome_records`
Pipeline terminal results. Shows whether builds using a persona succeeded or failed.

```sql
-- Get build outcomes for persona-related ideas
SELECT idea_title, outcome, overall_score, build_outcome, artifact_count, tech_stack
FROM outcome_records
WHERE outcome IN ('published', 'build_failed')
ORDER BY emitted_at DESC;
```

Relevant fields:
- `outcome`: published | rejected | deferred | build_failed | feature_backlog
- `overall_score`: numeric quality score
- `build_outcome`: text description of build result
- `pipeline_trace`: JSON array of stage transitions with `persona_used` field

#### Table: `improvement_recommendations`
Sky-Lynx assessments of persona quality.

```sql
-- Get recommendation history for a specific persona
SELECT recommendation_type, title, priority, status, emitted_at
FROM improvement_recommendations
WHERE target_system = 'persona'
  AND (raw_json LIKE '%"christensen"%' OR scope = 'all_personas')
ORDER BY emitted_at DESC;
```

#### Table: `persona_patches`
Patch application history -- shows improvement trajectory.

```sql
-- Get patch success rate for a persona
SELECT persona_id,
       COUNT(*) as total_patches,
       SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
       SUM(CASE WHEN schema_valid = 1 THEN 1 ELSE 0 END) as valid
FROM persona_patches
WHERE persona_id = ?
GROUP BY persona_id;
```

#### Table: `research_signals`
Market context that could inform whether a persona serves a growing need.

### Promotion/Demotion Thresholds (Proposed)

The Headmaster should evaluate personas on these dimensions:

| Metric | Source | Tier 3 -> Tier 2 Threshold | Tier 2 -> Tier 1 Threshold |
|--------|--------|---------------------------|---------------------------|
| Fidelity score | Academy validation CLI | >= 75/100 | >= 85/100 |
| Patch success rate | `persona_patches` table | >= 70% applied | >= 90% applied |
| Schema validity rate | `persona_patches.schema_valid` | >= 80% | >= 95% |
| Framework count | Persona YAML | >= 2 | >= 3 |
| Case study count | Persona YAML | >= 1 | >= 3 |
| `agent_config` present | Persona YAML | Required | Required with tools defined |
| Recommendation sentiment | `improvement_recommendations` | No critical pending | No high/critical pending |
| Build success (if prev build) | `outcome_records` | N/A | >= 1 successful build |
| Time at current tier | Headmaster tracking | >= 7 days | >= 14 days |

### Demotion Triggers

| Condition | Source | Action |
|-----------|--------|--------|
| Fidelity drops below 60 | Academy validation | Demote one tier |
| 3+ failed patches | `persona_patches` | Demote to Tier 3 |
| Build failure | `outcome_records` | Demote to Tier 2 |
| Critical recommendation unresolved 30+ days | `improvement_recommendations` | Flag for review |

### Query Patterns for Headmaster

```python
# Headmaster reads these databases in read-only mode:
# 1. ST Records DB: /home/apexaipc/projects/st-records/data/persona_metrics.db
# 2. Metroplex DB: /home/apexaipc/projects/metroplex/data/metroplex.db
# 3. Academy personas: /home/apexaipc/projects/agent-persona-academy/personas/

import sqlite3

# Connect read-only
stf_conn = sqlite3.connect("file:/path/to/persona_metrics.db?mode=ro", uri=True)
stf_conn.row_factory = sqlite3.Row

# Get persona health summary
def get_persona_health(persona_id: str) -> dict:
    """Aggregate metrics for promotion/demotion decision."""

    # Patch history
    patches = stf_conn.execute("""
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status='applied' THEN 1 ELSE 0 END) as applied,
               SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
               SUM(CASE WHEN schema_valid=1 THEN 1 ELSE 0 END) as valid
        FROM persona_patches WHERE persona_id = ?
    """, (persona_id,)).fetchone()

    # Pending recommendations
    pending_recs = stf_conn.execute("""
        SELECT COUNT(*) as count,
               GROUP_CONCAT(priority) as priorities
        FROM improvement_recommendations
        WHERE status = 'pending'
          AND target_system = 'persona'
          AND (raw_json LIKE ? OR scope = 'all_personas')
    """, (f'%"{persona_id}"%',)).fetchone()

    return {
        "persona_id": persona_id,
        "total_patches": patches["total"],
        "patch_success_rate": patches["applied"] / max(patches["total"], 1),
        "schema_validity_rate": patches["valid"] / max(patches["total"], 1),
        "pending_recommendations": pending_recs["count"],
        "has_critical_pending": "critical" in (pending_recs["priorities"] or ""),
    }
```

### Data Freshness

- `improvement_recommendations`: Updated weekly by Sky-Lynx cron
- `persona_patches`: Updated per Metroplex cycle (every 60 seconds when running)
- `outcome_records`: Updated when ideas reach terminal states
- Academy validation: Run on-demand via `npm run cli test` or `npm run cli report`

### Changes Required to ST Records

| Change | File | Type | Impact |
|--------|------|------|--------|
| None for reads | -- | -- | Headmaster reads existing tables |
| Optional: Add `tier_history` table | `contracts/store.py` | New table | LOW -- additive |

The Headmaster DOES need somewhere to store tier state. Options:
1. **In Academy repo**: Add `tier.yaml` alongside `persona.yaml` in each persona directory (git-tracked, auditable)
2. **In ST Records DB**: New `tier_history` table (centralized, queryable)
3. **In Headmaster's own DB**: Separate SQLite (isolated)

**Recommendation**: Use option 1 (tier.yaml in Academy repo) for current state, with option 2 for history logging. This keeps the source of truth in git while maintaining query access.

---

## 6. Academy -> GitHub Registry: Graduated Agent Publishing

### Current Registry Flow

1. Academy personas live in `m2ai-portfolio/agent-persona-academy` repo under `personas/`
2. Registry config points to `m2ai-portfolio/persona-registry` (defined in `src/registry/types.ts:26-31`)
3. `pull` command fetches personas from registry to local cache at `~/.persona-academy/personas/`
4. `push` command is deferred (not implemented, listed in BLUEPRINT.md backlog item 4.3)
5. Metroplex Gate 3 (patcher) clones the Academy repo, applies patches, and pushes directly

### Registry Entry Format

```typescript
interface RegistryEntry {
    id: string;              // kebab-case persona ID
    name: string;            // Display name
    summary: string;
    author: string;
    version: string;         // Semantic version
    category: PersonaCategory;  // business-strategist, technical-architect, etc.
    tags: string[];
    frameworkCount: number;
    caseStudyCount: number;
    updated: string;         // ISO timestamp
    sha?: string;            // Latest commit SHA
}
```

### Extensions for Tier 1/2 Artifacts

Currently, the registry only tracks persona YAML files. For graduated agents:

**Tier 3 (current)**: Persona YAML only -- no changes needed.

**Tier 2 (MCP server)**: After a successful Tier 2 build via YCE Harness:
- Build output at `yce-harness/generations/<job-id>/` contains the MCP server source
- Metroplex Gate 4 (publish) already pushes to `m2ai-portfolio/<repo-name>` on GitHub
- The registry entry needs an additional field:

```typescript
interface RegistryEntry {
    // ... existing fields ...
    tier: "tier1" | "tier2" | "tier3";          // NEW
    buildRepo?: string;                          // NEW: "m2ai-portfolio/christensen-mcp-server"
    deploymentType?: "mcp-server" | "agent" | "persona-only";  // NEW
}
```

**Tier 1 (autonomous agent)**: After a successful Tier 1 build:
- Build output is a standalone Claude Agent SDK application
- Published to GitHub via Gate 4
- Registry entry includes deployment information:

```typescript
interface RegistryEntry {
    // ... existing + tier fields ...
    agentConfig?: {
        model: string;
        toolGroups: string[];
        deploymentTarget: "systemd" | "docker" | "manual";
    };
}
```

### Publishing Flow for Graduated Agents

```
Headmaster decides promotion
    |
    v
Metroplex receives build request (PriorityItem source="academy")
    |
    v
Gate 2: Spec generation using tier-specific template
    |
    v
YCE Harness builds agent/MCP server at generations/<job-id>/
    |
    v
Gate 4: Publish to m2ai-portfolio/<derived-repo-name>
    |
    v
Headmaster updates persona's tier.yaml in Academy repo
    |
    v
Registry index regenerated (either manually or via CI)
```

### Changes Required to Academy

| Change | File | Type | Impact |
|--------|------|------|--------|
| Add `tier` field to RegistryEntry | `src/registry/types.ts` | Modify type | LOW |
| Add `buildRepo` field to RegistryEntry | `src/registry/types.ts` | Modify type | LOW |
| Add `tier.yaml` per persona | `personas/*/tier.yaml` | New files | NONE -- additive |
| Update index generation to include tier | Registry CI/scripts | Modify | LOW |

---

## 7. Full Lifecycle Sequence Diagram

```
                          CONCEPT PHASE
                          =============

  [IdeaForge signals] ----> [IdeaForge synthesize/score/classify]
                                        |
                                        v
                              ideas table (status=classified)
                                        |
                                        v
                         TIERING PHASE (NEW - Headmaster)
                         ================================

  [Academy persona.yaml] ---> [Headmaster evaluates persona metrics]
                                        |
                    +-------------------+-------------------+
                    |                   |                   |
              Stays Tier 3        Promote to T2       Promote to T1
              (no action)              |                   |
                                       v                   v
                              [Headmaster writes      [Headmaster writes
                               PriorityItem to         PriorityItem to
                               Metroplex queue]        Metroplex queue]
                                       |                   |
                                       +--------+----------+
                                                |
                                                v
                          BUILD PHASE (Metroplex -> YCE)
                          ==============================

  [Metroplex Gate 2] ----> [SpecGenerator with tier template]
                                        |
                                        v
                              app_spec_{id}.txt (tier-specific)
                                        |
                                        v
  [queue_runner.py add] ----> [YCE Harness orchestrator]
                                        |
                    +-------------------+-------------------+
                    |                                       |
              Tier 2 Build                            Tier 1 Build
              (MCP Server)                            (Agent SDK App)
                    |                                       |
                    v                                       v
              generations/<id>/                    generations/<id>/
              ├── src/                             ├── agent/
              │   └── index.ts                     │   ├── core.py
              ├── dist/                            │   ├── prompts/
              │   └── index.js                     │   └── tools.py
              └── package.json                     ├── requirements.txt
                                                   └── systemd/

                          TEST PHASE (YCE QA + Code Review)
                          ==================================

  [YCE QA agent] ----> verification gate ----> regression tests
  [YCE code_review agent] ----> security/architecture review
                                        |
                                        v
                          GRADUATE PHASE (Metroplex Gate 4)
                          ==================================

  [Gate 4 Publish] ----> gh repo create m2ai-portfolio/<name>
                                        |
                                        v
                          [Headmaster updates tier.yaml]
                                        |
                                        v
                          [Registry index updated]

                          DEPLOY PHASE
                          ============

  Tier 2: Claude Desktop config points to dist/index.js
  Tier 1: systemd service started, or Docker container deployed
                                        |
                                        v
                          MONITOR PHASE (Continuous)
                          ==========================

  [Sky-Lynx weekly analysis] ----> ImprovementRecommendation
                                        |
                                        v
  [persona_upgrader.py] ----> PersonaUpgradePatch (status=proposed)
                                        |
                                        v
  [Metroplex Gate 3] ----> Apply patches to Academy repo
                                        |
                                        v
                          IMPROVE/PROMOTE/DEMOTE
                          ======================

  [Headmaster re-evaluates metrics]
      |
      +-- Metrics improving? --> Promote (back to BUILD PHASE)
      +-- Metrics stable? -----> Maintain current tier
      +-- Metrics declining? --> Demote (update tier.yaml)
      +-- Critical failure? ---> Emergency demotion + alert
```

---

## 8. Interface Gap Analysis

### Existing Interfaces That Academy v2 Can Reuse (NO changes needed)

| Interface | Used By | Academy v2 Usage |
|-----------|---------|------------------|
| IdeaForge `ideas` table schema | Metroplex triage | Not needed -- Headmaster bypasses triage |
| `PriorityItem` enqueue pattern | Sky-Lynx/Linear intake | Headmaster uses same pattern |
| `SpecGenerator.generate_spec()` | Gate 2 build | Works as-is with new templates |
| `queue_runner.py add/start` CLI | Gate 2 dispatch | Works as-is |
| `ContractStore.write_recommendation()` | Sky-Lynx | Already supports persona targeting |
| `ContractStore.write_patch()` | persona_upgrader.py | Already supports all patch operations |
| `ContractStore.query_patches()` | Headmaster reads | Read-only, no changes |
| Gate 4 publish flow | Metroplex | Publishes any generation/<id>/ to GitHub |
| Metroplex `DATA_CONTRACT.md` | Sky-Lynx, dashboards | Headmaster reads same tables |

### New Interfaces Required

| Interface | From -> To | Purpose | Effort |
|-----------|-----------|---------|--------|
| Headmaster -> Metroplex queue | Academy -> Metroplex | Submit tier promotion builds | SMALL -- write PriorityItem |
| Tier-specific spec templates | Metroplex -> YCE | Tier 1/2 build instructions | MEDIUM -- 2 new templates |
| Tier metadata in persona dirs | Headmaster -> Academy repo | Track current tier per persona | SMALL -- tier.yaml files |
| Headmaster metrics reader | ST Records -> Headmaster | Aggregate persona health | SMALL -- read-only queries |
| Tier-aware patch handling | Metroplex Gate 3 | Detect promotion patches | MEDIUM -- new branch in patcher |

### Interfaces That Need Modification (MINIMIZE THESE)

| Interface | Project | Change | Justification |
|-----------|---------|--------|---------------|
| `PriorityItem.source` enum | Metroplex | Add "academy" | Required to distinguish build source |
| `buildable_sources` tuple | Metroplex | Add "academy" | Required for Gate 2 to pick up academy items |
| `patcher.py` target path | Metroplex | Fix `personas/{id}.yaml` -> `personas/{id}/persona.yaml` | Existing bug fix |
| `RecommendationType` enum | ST Records | Add tier_promotion/demotion types | Enables Sky-Lynx to recommend tier changes |
| `PersonaUpgradePatch` | ST Records | Add optional tier_context field | Backward compatible |
| `RegistryEntry` type | Academy | Add tier, buildRepo fields | Backward compatible |

---

## 9. Modification Impact Matrix

### Risk Assessment

| Modified System | Files Changed | Breaking? | Rollback Difficulty |
|----------------|---------------|-----------|---------------------|
| Metroplex | 3 files (models.py, build.py, patcher.py) | No -- additive + bugfix | Easy -- revert 3 files |
| ST Records | 2 files (improvement_recommendation.py, persona_upgrade_patch.py) | No -- additive enums + optional field | Easy -- revert 2 files |
| Academy | 1 file (registry/types.ts) | No -- additive fields | Easy -- revert 1 file |
| YCE Harness | 0 files | N/A | N/A |
| IdeaForge | 0 files | N/A | N/A |
| Sky-Lynx | 0 files (reads new enum values when available) | N/A | N/A |

### Dependency Order for Implementation

```
Phase 1: ST Records contract extensions (no downstream impact)
    - Add RecommendationType enum values
    - Add tier_context to PersonaUpgradePatch
    - Regenerate JSON schemas

Phase 2: Metroplex modifications
    - Fix patcher.py target path bug
    - Add "academy" to PriorityItem.source and buildable_sources
    - Create tier-specific spec templates
    - Add academy_reader.py

Phase 3: Academy extensions
    - Add tier field to RegistryEntry
    - Create tier.yaml schema and initial files
    - Create Headmaster process skeleton

Phase 4: Headmaster implementation
    - Metrics aggregation from ST Records
    - Promotion/demotion decision logic
    - PriorityItem submission to Metroplex
    - tier.yaml management

Phase 5: Integration testing
    - End-to-end: Headmaster promotes persona -> Metroplex builds -> YCE generates -> Gate 4 publishes
    - Demotion: Headmaster detects failure -> updates tier.yaml
    - Sky-Lynx loop: recommendation -> patch -> re-evaluate
```

---

## Appendix A: File Reference

| File | Project | Role in Integration |
|------|---------|---------------------|
| `/home/apexaipc/projects/agent-persona-academy/schema/persona-schema.json` | Academy | Persona definition schema (includes agent_config) |
| `/home/apexaipc/projects/agent-persona-academy/src/core/types.ts` | Academy | TypeScript types for all persona structures |
| `/home/apexaipc/projects/agent-persona-academy/src/registry/types.ts` | Academy | Registry entry types (needs tier extension) |
| `/home/apexaipc/projects/agent-persona-academy/src/unified-server/tools.ts` | Academy | MCP tool definitions (pattern for Tier 2 builds) |
| `/home/apexaipc/projects/st-records/contracts/store.py` | ST Records | ContractStore -- Headmaster reads this |
| `/home/apexaipc/projects/st-records/contracts/improvement_recommendation.py` | ST Records | Sky-Lynx recommendation format (needs tier types) |
| `/home/apexaipc/projects/st-records/contracts/persona_upgrade_patch.py` | ST Records | Patch format (needs tier_context) |
| `/home/apexaipc/projects/st-records/schemas/persona_upgrade_patch.v1.json` | ST Records | Patch JSON schema |
| `/home/apexaipc/projects/st-records/schemas/improvement_recommendation.v1.json` | ST Records | Recommendation JSON schema |
| `/home/apexaipc/projects/st-records/scripts/persona_upgrader.py` | ST Records | Consumes recommendations, generates patches |
| `/home/apexaipc/projects/metroplex/models.py` | Metroplex | PriorityItem model (needs "academy" source) |
| `/home/apexaipc/projects/metroplex/config.py` | Metroplex | academy_repo config, threshold settings |
| `/home/apexaipc/projects/metroplex/gates/triage.py` | Metroplex | Gate 1 -- not used by Headmaster (bypass) |
| `/home/apexaipc/projects/metroplex/gates/build.py` | Metroplex | Gate 2 -- spec generation + YCE dispatch |
| `/home/apexaipc/projects/metroplex/gates/patcher.py` | Metroplex | Gate 3 -- applies patches to Academy repo |
| `/home/apexaipc/projects/metroplex/gates/publish.py` | Metroplex | Gate 4 -- pushes builds to GitHub |
| `/home/apexaipc/projects/metroplex/gates/llm_expander.py` | Metroplex | LLM-powered spec generation |
| `/home/apexaipc/projects/metroplex/spec_templates/app_spec_template.md` | Metroplex | Jinja2 spec template (needs tier variants) |
| `/home/apexaipc/projects/metroplex/readers/skylynx_reader.py` | Metroplex | Pattern for academy_reader.py |
| `/home/apexaipc/projects/metroplex/readers/stfactory_reader.py` | Metroplex | Reads patches for Gate 3 |
| `/home/apexaipc/projects/metroplex/dispatcher.py` | Metroplex | Worker routing (may need academy worker route) |
| `/home/apexaipc/projects/metroplex/DATA_CONTRACT.md` | Metroplex | Stable read interface for downstream |
| `/home/apexaipc/projects/yce-harness/prompts/orchestrator_prompt.md` | YCE | Multi-agent orchestration prompt |
| `/home/apexaipc/projects/yce-harness/prompts/app_spec.txt` | YCE | Example spec format |
| `/home/apexaipc/projects/yce-harness/queue_runner.py` | YCE | Build queue CLI |
| `/home/apexaipc/projects/ideaforge/src/ideaforge/models.py` | IdeaForge | Idea model (reference for idea_data format) |
| `/home/apexaipc/projects/ideaforge/src/ideaforge/db.py` | IdeaForge | Database schema |

## Appendix B: Existing Bug Found During Analysis

**Metroplex Gate 3 patcher target path is wrong**

In `/home/apexaipc/projects/metroplex/gates/patcher.py`, line 183:
```python
target_file = f"personas/{persona_id}.yaml"
```

The actual Academy file layout is `personas/{persona_id}/persona.yaml` (each persona has its own directory). This means the patcher would fail to find any persona file. The fix:

```python
target_file = f"personas/{persona_id}/persona.yaml"
```

This needs to be fixed regardless of Academy v2.

## Appendix C: Headmaster Process Skeleton

```python
"""
Academy v2 Headmaster - Tier Management Process

Runs periodically (e.g., daily via cron or as part of Metroplex cycle).
Reads metrics from ST Records and Academy, makes promotion/demotion decisions,
and submits build requests to Metroplex when promotions are approved.
"""

import json
import sqlite3
import subprocess
import yaml
from pathlib import Path
from datetime import datetime

# Paths
ACADEMY_PATH = Path.home() / "projects" / "agent-persona-academy"
PERSONAS_PATH = ACADEMY_PATH / "personas"
STF_DB = Path.home() / "projects" / "st-records" / "data" / "persona_metrics.db"
METROPLEX_DB = Path.home() / "projects" / "metroplex" / "data" / "metroplex.db"

# Thresholds
TIER2_FIDELITY = 75
TIER1_FIDELITY = 85
TIER2_PATCH_SUCCESS = 0.70
TIER1_PATCH_SUCCESS = 0.90
DEMOTION_FIDELITY = 60

class Headmaster:
    def __init__(self):
        self.stf_conn = sqlite3.connect(f"file:{STF_DB}?mode=ro", uri=True)
        self.stf_conn.row_factory = sqlite3.Row

    def get_current_tier(self, persona_id: str) -> str:
        """Read current tier from persona's tier.yaml."""
        tier_path = PERSONAS_PATH / persona_id / "tier.yaml"
        if not tier_path.exists():
            return "tier3"  # Default for all existing personas
        data = yaml.safe_load(tier_path.read_text())
        return data.get("current_tier", "tier3")

    def get_fidelity_score(self, persona_id: str) -> float:
        """Run Academy validation and return fidelity score."""
        result = subprocess.run(
            ["npm", "run", "cli", "test", persona_id, "--json"],
            capture_output=True, text=True,
            cwd=str(ACADEMY_PATH)
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get("score", 0)
        return 0.0

    def get_patch_metrics(self, persona_id: str) -> dict:
        """Query ST Records for patch history."""
        row = self.stf_conn.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status='applied' THEN 1 ELSE 0 END) as applied,
                   SUM(CASE WHEN schema_valid=1 THEN 1 ELSE 0 END) as valid
            FROM persona_patches WHERE persona_id = ?
        """, (persona_id,)).fetchone()
        total = row["total"] or 0
        return {
            "total": total,
            "success_rate": (row["applied"] or 0) / max(total, 1),
            "validity_rate": (row["valid"] or 0) / max(total, 1),
        }

    def has_agent_config(self, persona_id: str) -> bool:
        """Check if persona has agent_config section."""
        persona_path = PERSONAS_PATH / persona_id / "persona.yaml"
        data = yaml.safe_load(persona_path.read_text())
        return "agent_config" in data and data["agent_config"] is not None

    def evaluate_promotion(self, persona_id: str) -> str | None:
        """Returns target tier if promotion warranted, None otherwise."""
        current = self.get_current_tier(persona_id)
        fidelity = self.get_fidelity_score(persona_id)
        patches = self.get_patch_metrics(persona_id)
        has_config = self.has_agent_config(persona_id)

        if current == "tier3" and fidelity >= TIER2_FIDELITY and has_config:
            if patches["success_rate"] >= TIER2_PATCH_SUCCESS:
                return "tier2"

        if current == "tier2" and fidelity >= TIER1_FIDELITY and has_config:
            if patches["success_rate"] >= TIER1_PATCH_SUCCESS:
                return "tier1"

        # Check demotion
        if fidelity < DEMOTION_FIDELITY and current != "tier3":
            return "tier3"  # Demote

        return None  # No change

    def submit_build_request(self, persona_id: str, target_tier: str):
        """Write a PriorityItem to Metroplex's priority queue."""
        # Implementation writes directly to metroplex.db priority_queue table
        # Following the pattern in orchestrator.py ingest_skylynx()
        pass

    def update_tier(self, persona_id: str, new_tier: str):
        """Update persona's tier.yaml in Academy repo."""
        tier_path = PERSONAS_PATH / persona_id / "tier.yaml"
        tier_data = {
            "current_tier": new_tier,
            "updated_at": datetime.now().isoformat(),
            "history": []  # Append previous tier
        }
        tier_path.write_text(yaml.dump(tier_data, default_flow_style=False))
```

This skeleton demonstrates that the Headmaster can be built entirely on existing read interfaces with minimal new writes.
