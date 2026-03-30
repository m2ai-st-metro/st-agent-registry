# Setting Up a Persona Registry

This guide explains how to create and configure a persona registry for sharing personas.

## Registry Structure

A persona registry is a GitHub repository with the following structure:

```
persona-registry/
├── personas/
│   ├── index.json           # Registry index (auto-generated)
│   ├── christensen/
│   │   └── persona.yaml
│   ├── porter/
│   │   └── persona.yaml
│   └── drucker/
│       └── persona.yaml
└── README.md
```

## Index File Format

The `personas/index.json` file contains metadata about all personas:

```json
{
  "schemaVersion": "1.0.0",
  "generated": "2025-01-14T12:00:00Z",
  "repository": {
    "owner": "your-org",
    "name": "persona-registry",
    "branch": "main"
  },
  "totalPersonas": 3,
  "categories": {
    "business-strategist": 2,
    "technical-architect": 1,
    "domain-expert": 0,
    "creative": 0,
    "custom": 0
  },
  "personas": [
    {
      "id": "christensen",
      "name": "Clayton Christensen",
      "summary": "Strategic Advisor & Innovation Theorist",
      "author": "Me, Myself Plus AI LLC",
      "version": "1.0.0",
      "category": "business-strategist",
      "tags": ["innovation", "disruption", "strategy"],
      "frameworkCount": 4,
      "caseStudyCount": 5,
      "updated": "2025-01-14"
    }
  ]
}
```

## Creating a Registry

### 1. Create GitHub Repository

```bash
# Create new repo
gh repo create persona-registry --public --description "Persona registry for Agent Persona Academy"

# Clone it
git clone https://github.com/your-org/persona-registry
cd persona-registry
```

### 2. Add Personas

```bash
# Create structure
mkdir -p personas

# Copy a persona
cp -r /path/to/st-agent-registry/personas/christensen personas/
```

### 3. Generate Index

Create `personas/index.json` manually or use a script:

```bash
# From st-agent-registry (future feature)
persona-academy registry generate-index ./personas
```

### 4. Push to GitHub

```bash
git add .
git commit -m "Initial persona registry"
git push origin main
```

## Using a Custom Registry

Specify a custom registry with the `--registry` flag:

```bash
# List personas from custom registry
persona-academy remote --registry your-org/persona-registry

# Pull from custom registry
persona-academy pull christensen --registry your-org/persona-registry
```

## Authentication

For private registries or higher rate limits, set `GITHUB_TOKEN`:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Or use gh CLI to authenticate
gh auth login
```

## Local Cache

Downloaded personas are cached locally:

```
~/.persona-academy/personas/
├── cache-index.json
├── christensen/
│   └── persona.yaml
└── porter/
    └── persona.yaml
```

### Cache Commands

```bash
# View cache status
persona-academy cache

# List cached personas
persona-academy cache list

# Clear cache
persona-academy cache clear

# Remove specific persona
persona-academy cache remove christensen
```

## Best Practices

1. **Versioning**: Update `version` in persona metadata when making changes
2. **Index Updates**: Regenerate `index.json` after adding/updating personas
3. **Testing**: Run `persona-academy validate` before publishing
4. **Documentation**: Include README.md in each persona directory

## Registry Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Create    │     │   Validate  │     │   Publish   │
│   Persona   │ ──▶ │   & Test    │ ──▶ │   to Repo   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Update    │ ◀── │  Regenerate │
                    │   Index     │     │   Index     │
                    └─────────────┘     └─────────────┘
```

## Future Features

- [ ] `persona-academy push` - Publish personas to registry
- [ ] `persona-academy registry generate-index` - Auto-generate index
- [ ] GitHub Actions for auto-indexing on push
- [ ] Persona rating/feedback system
