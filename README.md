# Agent Persona Academy

Factory and runtime system for creating Claude persona agents. Build high-fidelity AI personas for use in Claude Desktop, Claude Code, and multi-agent workflows.

## Features

- **Factory CLI** - Scaffold new personas with interactive prompts
- **Schema Validation** - JSON Schema validation for persona definitions
- **Fidelity Testing** - Automated testing against voice and framework markers
- **YAML-Based** - Human-readable persona definitions, no compilation needed
- **Multi-Agent Ready** - Designed for both CD integration and orchestration

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Create a new persona
npm run cli create michael-porter

# List available personas
npm run cli list

# Validate a persona
npm run cli validate ./personas/christensen

# Test persona fidelity
npm run cli test ./personas/christensen
```

## CLI Commands

### `persona-academy create <name>`

Create a new persona with interactive prompts.

```bash
# Interactive mode (default)
persona-academy create warren-buffett

# Skip prompts, use minimal template
persona-academy create warren-buffett --no-interactive

# Custom output directory
persona-academy create warren-buffett -o ./my-personas
```

### `persona-academy validate <path>`

Validate persona YAML against the schema.

```bash
# Validate a persona
persona-academy validate ./personas/christensen

# Verbose output with details
persona-academy validate ./personas/christensen --verbose
```

### `persona-academy test <path>`

Run fidelity tests using sample responses.

```bash
# Run all sample tests
persona-academy test ./personas/christensen

# Test specific text
persona-academy test ./personas/christensen --text "The theory suggests..."

# Custom threshold
persona-academy test ./personas/christensen --threshold 80
```

### `persona-academy list`

List available personas.

```bash
# List all personas
persona-academy list

# Filter by category
persona-academy list --category business-strategist

# JSON output
persona-academy list --json
```

### `persona-academy info <name>`

Show details about a persona.

```bash
# Basic info
persona-academy info christensen

# Show framework details
persona-academy info christensen --frameworks

# Show case studies
persona-academy info christensen --cases

# Show validation markers
persona-academy info christensen --validation

# Show generated system prompt
persona-academy info christensen --prompt
```

### `persona-academy report <path>`

Generate comprehensive quality reports for a persona.

```bash
# Generate report using sample response
persona-academy report ./personas/christensen

# Report on specific text
persona-academy report ./personas/christensen --text "My analysis response..."

# Report from file
persona-academy report ./personas/christensen --file response.txt

# Include test suite results
persona-academy report ./personas/christensen --run-tests

# JSON output
persona-academy report ./personas/christensen --json

# JUnit XML for CI/CD
persona-academy report ./personas/christensen --run-tests --junit
```

### `persona-academy compare <personas-dir>`

Compare text against multiple personas to find the best match.

```bash
# Compare text against all personas
persona-academy compare ./personas --text "Let me tell you about disruption..."

# Compare from file
persona-academy compare ./personas --file response.txt

# Show persona similarity matrix
persona-academy compare ./personas --matrix

# JSON output with top N matches
persona-academy compare ./personas --text "..." --json --top 5
```

### `persona-academy remote`

Browse personas available in the remote registry.

```bash
# List all remote personas
persona-academy remote

# Filter by category
persona-academy remote --category business-strategist

# Search
persona-academy remote --search "disruption"

# Use custom registry
persona-academy remote --registry your-org/persona-registry
```

### `persona-academy pull [personas...]`

Download personas from the remote registry to local cache.

```bash
# Pull specific personas
persona-academy pull christensen porter

# Pull all available personas
persona-academy pull --all

# Force re-download
persona-academy pull christensen --force

# From custom registry
persona-academy pull christensen --registry your-org/persona-registry
```

### `persona-academy cache`

Manage the local persona cache.

```bash
# Show cache status
persona-academy cache

# List cached personas
persona-academy cache list

# Clear entire cache
persona-academy cache clear

# Remove specific persona
persona-academy cache remove christensen
```

## Registry

Personas can be shared via GitHub-based registries. See [docs/REGISTRY_SETUP.md](./docs/REGISTRY_SETUP.md) for setup instructions.

### Default Registry

The default registry is `m2ai-portfolio/persona-registry`. Override with `--registry`:

```bash
persona-academy remote --registry your-org/your-registry
```

### Authentication

For private registries or higher API rate limits:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
persona-academy remote
```

## MCP Server

The unified multi-persona MCP server allows Claude Desktop and Claude Code to access multiple personas with runtime switching.

### Starting the Server

```bash
# Start with default settings
persona-academy serve

# Specify personas directory and default
persona-academy serve --personas ./my-personas --default porter
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "persona-academy": {
      "command": "node",
      "args": [
        "/path/to/st-agent-registry/dist/unified-server/index.js",
        "--personas", "/path/to/personas",
        "--default", "christensen"
      ]
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_personas` | List all available personas |
| `switch_persona` | Switch to a different persona |
| `persona_analyze` | Get analysis using active persona's frameworks |
| `get_framework` | Get details about a specific framework |
| `get_case_study` | Get details about a case study |
| `get_active_persona` | View current persona info |
| `list_departments` | List all Academy departments with personas and policies |

### Example Usage in Claude

```
User: Use the persona tools to switch to Christensen and analyze my startup decision.

Claude: [calls list_personas]
Claude: [calls switch_persona with persona_id="christensen"]
Claude: [calls persona_analyze with situation="Should we pivot to enterprise?"]
```

## Persona YAML Structure

```yaml
identity:
  name: "Persona Display Name"
  role: "Their professional title"
  background: |
    2-4 sentences about credentials and expertise.

voice:
  tone:
    - "warm"
    - "professorial"
    - "curious"
  phrases:
    - "Let me tell you a story..."
    - "The theory suggests..."
  style:
    - "Asks questions first"
    - "Uses examples"
  constraints:
    - "Never overconfident"

frameworks:
  framework_name:
    description: "What this framework is about"
    concepts:
      concept_name:
        definition: "What this concept means"
        examples:
          - "Example 1"
    questions:
      - "Diagnostic question 1"

case_studies:
  case_name:
    pattern: "The pattern this illustrates"
    story: "The narrative"
    signals:
      - "When to reference this case"

validation:
  must_include:
    - pattern: "regex_pattern"
      description: "Why this matters"
      weight: 10
  should_include:
    - pattern: "bonus_pattern"
      weight: 5
  must_avoid:
    - pattern: "antipattern"
      weight: 10

sample_responses:
  example_1:
    prompt: "User question"
    good_response: "High-fidelity response"
    bad_response: "Low-fidelity response"

metadata:
  version: "1.0.0"
  category: "business-strategist"
  tags: ["strategy", "innovation"]
```

## Included Personas

### Clayton Christensen

Strategic advisor implementing disruption theory, jobs-to-be-done, and capabilities analysis.

**Frameworks:**
- Disruption Theory
- Jobs-to-be-Done
- Capabilities-Processes-Priorities
- Resource Dependence

**Case Studies:**
- Steel mini-mills
- Disk drives
- Milkshake
- Honda motorcycles
- Intel microprocessors

### Michael Porter

Competitive strategy expert providing Five Forces analysis and strategic positioning guidance.

**Frameworks:**
- Five Forces Industry Analysis
- Generic Strategies (Cost Leadership, Differentiation, Focus)
- Value Chain Analysis
- Competitive Positioning

**Case Studies:**
- Southwest Airlines (strategic positioning)
- IKEA (value chain reconfiguration)
- Japanese automakers (operational effectiveness vs. strategy)
- Continental Lite (strategic failure)
- Pharmaceutical industry (Five Forces)

### Peter Drucker

Management philosopher focusing on effectiveness, knowledge work, and organizational purpose.

**Frameworks:**
- The Effective Executive
- Knowledge Worker Productivity
- Innovation and Entrepreneurship
- Management by Objectives

**Case Studies:**
- General Motors (professional management)
- Japanese management (principles vs. techniques)
- Nonprofit effectiveness
- Knowledge society prediction

### Code Reviewer

Senior Code Quality Engineer and Review Specialist focused on constructive, specific, evidence-based code review that teaches rather than gatekeeps.

**Frameworks:**
- Code Clarity (naming, structure, cognitive complexity)
- Error Handling (failure modes, recovery, observability)
- Design Principles (SOLID, DRY, coupling/cohesion)
- Test Quality (coverage, maintainability, confidence)

**Case Studies:**
- Rubber Stamp Anti-Pattern (superficial review habits)
- Over-Engineering Review (complexity vs. simplicity trade-offs)
- Teaching Review (knowledge transfer through review)

### John Carmack

Systems architect and performance engineer focused on ruthless simplicity, measurement-driven optimization, and constraint-driven engineering.

**Frameworks:**
- Ruthless Simplicity
- Measure-First Optimization
- Vertical Slice Delivery
- Constraint-Driven Engineering

**Case Studies:**
- Doom engine (constraint-driven innovation)
- Quake BSP and netcode (measure-first optimization)
- Armadillo Aerospace (iterative thin-slice delivery)
- Oculus VR latency (latency budget allocation)

### Grace Hopper

Pioneer in computer science and naval officer who championed practical computing, compiler development, and standards-based interoperability.

### Leslie Lamport

Distributed systems theorist known for Lamport clocks, Paxos consensus, and TLA+ formal specification.

### Barbara Liskov

Software engineering pioneer known for the Liskov Substitution Principle, CLU language, data abstraction, and design by contract.

**Frameworks:**
- Data Abstraction
- Behavioral Subtyping
- Design by Contract
- Modular Reasoning

**Case Studies:**
- Liskov Substitution Principle
- CLU language
- Venus operating system
- Thor database

### Michelangelo

Creative Director and Visual Philosopher applying Renaissance art principles to modern digital design.

**Frameworks:**
- Subtractive Sculpture
- Contrast and Tension
- Emotional Architecture
- Intentional Rule Breaking

**Case Studies:**
- Sistine Chapel (mastery through constraint)
- David / Abandoned Marble (finding form in chaos)
- Pieta Tension (emotional weight through contrast)

### Sky-Lynx

Continuous Improvement Analyst applying Kaizen principles and feedback loop analysis to optimize Claude Code workflows.

**Frameworks:**
- Kaizen Analysis
- Feedback Loop Detection
- Cognitive Load Management
- Risk-Adjusted Prioritization
- User Adoption Journey

## Department System

Departments provide isolation boundaries for persona validation. Quality criteria that work for engineering personas (precision, measurement) may be antithetical to creative personas (expressiveness, rule-breaking).

### Current Departments

| Department | ID | Personas |
|---|---|---|
| School of Engineering | `engineering` | carmack, hopper, lamport, liskov |
| School of Business Strategy | `business-strategy` | christensen, porter, drucker |
| Operations | `operations` | sky-lynx |
| Creative | `creative` | michelangelo |

### Department CLI Commands

```bash
# List all departments
persona-academy department list

# Show department details (personas, quality criteria, learning policy)
persona-academy department info engineering

# Filter personas by department
persona-academy list --department engineering
```

Each department defines validation overrides (fidelity thresholds, scoring weights), shared must_avoid patterns, and a learning policy for Sky-Lynx continuous improvement integration.

## Creating New Personas

1. **Run the create command:**
   ```bash
   persona-academy create my-persona
   ```

2. **Answer the prompts** for identity, voice, and frameworks

3. **Edit the generated YAML** in `./personas/my-persona/persona.yaml`

4. **Validate the schema:**
   ```bash
   persona-academy validate ./personas/my-persona
   ```

5. **Add sample responses** for testing

6. **Test fidelity:**
   ```bash
   persona-academy test ./personas/my-persona
   ```

## Fidelity Scoring

The test command scores responses against validation markers:

| Category | Description | Points |
|----------|-------------|--------|
| `must_include` | Essential patterns (need 80%+) | 60 |
| `should_include` | Bonus patterns | 30 |
| `must_avoid` | Penalties for antipatterns | -15 each |

**Passing score:** 70/100 with 80%+ of must_include patterns matched.

## Project Structure

```
st-agent-registry/
├── src/
│   ├── core/                    # Core engine
│   │   ├── types.ts            # Type definitions
│   │   ├── persona-loader.ts   # YAML loading
│   │   └── validation-engine.ts # Fidelity scoring
│   ├── cli/                     # CLI commands
│   │   ├── index.ts            # Entry point
│   │   └── commands/           # Individual commands
│   ├── validation/              # Validation & testing suite
│   │   ├── voice-analyzer.ts   # Voice consistency analysis
│   │   ├── framework-coverage.ts # Framework usage analysis
│   │   ├── comparison.ts       # Cross-persona comparison
│   │   ├── report-generator.ts # Quality reports
│   │   └── test-runner.ts      # Automated test suites
│   ├── unified-server/          # Multi-persona MCP server
│   ├── registry/                # Remote registry client
│   └── templates/               # Scaffolding templates
├── personas/                    # Persona definitions
│   └── christensen/            # Example persona
├── schema/                      # JSON Schema
│   └── persona-schema.json     # Canonical format
├── .github/workflows/           # CI/CD automation
│   └── persona-validation.yml  # Validation workflow
└── docs/                        # Documentation
```

## Development

```bash
# Watch mode
npm run dev

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

## Roadmap

See [BLUEPRINT.md](./BLUEPRINT.md) for the complete implementation plan:

- [x] Phase 1: Core Engine Foundation
- [x] Phase 2: Persona Schema & Templates
- [x] Phase 3: CLI Factory Tool
- [x] Phase 4: Remote Persona Registry
- [x] Phase 5: Unified Multi-Persona Server
- [x] Phase 6: Validation & Testing Suite
- [x] Phase 7: Documentation & Community
- [x] Phase 8: Department Infrastructure
- [x] Phase 9: Department-Aware Validation
- [x] Phase 10: Michelangelo Persona & Creative Department
- [x] Phase 11: Sky-Lynx Department Scoping
- [x] Phase 12: CLI & Server Integration
- [x] Phase 13: Code Review Persona
- [ ] Phase 14: Fully Developed Agent (TBD)

## License

MIT

---

*Part of the Agent Persona Academy project by Me, Myself Plus AI LLC*
