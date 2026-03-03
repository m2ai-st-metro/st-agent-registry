/**
 * Create Command
 *
 * Scaffolds a new persona from template with interactive prompts.
 *
 * Usage:
 *   persona-academy create <name>
 *   persona-academy create <name> --interactive
 *   persona-academy create <name> --template minimal
 */

import { Command } from 'commander';
import { input, select, confirm, editor } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { stringify as yamlStringify } from 'yaml';
import type { PersonaCategory } from '../../core/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const createCommand = new Command('create')
  .description('Create a new persona from template')
  .argument('<name>', 'Name for the new persona (kebab-case)')
  .option('-i, --interactive', 'Use interactive mode with guided prompts', true)
  .option('-t, --template <type>', 'Template type: full, minimal', 'full')
  .option('-o, --output <path>', 'Output directory', './personas')
  .option('-a, --agent', 'Scaffold as Agent mode (includes agent_config + tier.yaml)', false)
  .option('--no-interactive', 'Skip interactive prompts, use template only')
  .action(async (name: string, options) => {
    const spinner = ora();

    try {
      // Validate name format
      const kebabName = toKebabCase(name);
      if (kebabName !== name.toLowerCase()) {
        console.log(chalk.yellow(`Note: Converting "${name}" to "${kebabName}"`));
      }

      // Check if persona already exists
      const outputDir = join(options.output, kebabName);
      if (existsSync(outputDir)) {
        const overwrite = await confirm({
          message: `Persona "${kebabName}" already exists. Overwrite?`,
          default: false,
        });
        if (!overwrite) {
          console.log(chalk.yellow('Aborted.'));
          return;
        }
      }

      let personaData: PersonaData;

      if (options.interactive) {
        console.log(chalk.cyan('\n🎭 Persona Academy - Create New Persona\n'));
        console.log(chalk.dim('Answer the following questions to scaffold your persona.\n'));

        personaData = await collectPersonaData(kebabName);
      } else {
        // Use minimal template data
        personaData = getMinimalTemplate(kebabName);
      }

      // Generate YAML content
      const isAgentMode = options.agent === true;
      spinner.start(`Generating ${isAgentMode ? 'agent' : 'persona'} files...`);
      const yamlContent = generatePersonaYaml(personaData, isAgentMode);

      // Create directory and write files
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(outputDir, 'persona.yaml'), yamlContent);

      // Create README for the persona
      const readmeContent = generatePersonaReadme(personaData);
      writeFileSync(join(outputDir, 'README.md'), readmeContent);

      // Create tier.yaml
      const tierContent = generateTierYaml(kebabName, isAgentMode);
      writeFileSync(join(outputDir, 'tier.yaml'), tierContent);

      spinner.succeed(chalk.green(`${isAgentMode ? 'Agent' : 'Persona'} created successfully!`));

      // Print next steps
      console.log(chalk.cyan('\n📁 Created files:'));
      console.log(`   ${outputDir}/persona.yaml`);
      console.log(`   ${outputDir}/tier.yaml`);
      console.log(`   ${outputDir}/README.md`);

      if (isAgentMode) {
        console.log(chalk.cyan('\n🤖 Agent mode scaffolding included:'));
        console.log(`   - agent_config section in persona.yaml`);
        console.log(`   - tier.yaml set to mode: agent`);
        console.log(`   - Create a prompt file in yce-harness/prompts/ to match prompt_file`);
      }

      console.log(chalk.cyan('\n🚀 Next steps:'));
      console.log(`   1. Edit ${chalk.bold('persona.yaml')} to refine your persona`);
      console.log(
        `   2. Run ${chalk.bold(`persona-academy validate ${outputDir}`)} to check schema`,
      );
      console.log(
        `   3. Run ${chalk.bold(`persona-academy test ${outputDir}`)} to validate fidelity`,
      );
      if (isAgentMode) {
        console.log(
          `   4. Run ${chalk.bold(`persona-academy graduate ${outputDir}`)} to check graduation gates`,
        );
      } else {
        console.log(
          `   4. Run ${chalk.bold(`persona-academy build ${outputDir}`)} to create MCP server`,
        );
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to create persona'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      process.exit(1);
    }
  });

/**
 * Persona data structure for generation
 */
interface PersonaData {
  name: string;
  displayName: string;
  role: string;
  background: string;
  era?: string;
  notableWorks: string[];
  category: PersonaCategory;
  tone: string[];
  phrases: string[];
  style: string[];
  constraints: string[];
  frameworks: FrameworkData[];
  tags: string[];
}

interface FrameworkData {
  key: string;
  name: string;
  description: string;
  concepts: { key: string; definition: string }[];
  questions: string[];
}

/**
 * Collect persona data through interactive prompts
 */
async function collectPersonaData(kebabName: string): Promise<PersonaData> {
  // Basic Identity
  console.log(chalk.bold('\n── Identity ──\n'));

  const displayName = await input({
    message: 'Display name (how the persona introduces themselves):',
    default: toTitleCase(kebabName),
    validate: (v) => v.length > 0 || 'Name is required',
  });

  const role = await input({
    message: 'Role/title (their professional identity):',
    default: 'Expert Advisor',
    validate: (v) => v.length > 0 || 'Role is required',
  });

  const category = (await select({
    message: 'Category:',
    choices: [
      { value: 'business-strategist', name: 'Business Strategist (Porter, Drucker, etc.)' },
      { value: 'technical-architect', name: 'Technical Architect (Fowler, Beck, etc.)' },
      { value: 'domain-expert', name: 'Domain Expert (Healthcare, Finance, etc.)' },
      { value: 'creative', name: 'Creative (Writers, Designers, etc.)' },
      { value: 'custom', name: 'Custom' },
    ],
  })) as PersonaCategory;

  const background = await input({
    message: 'Background (2-4 sentences about credentials & expertise):',
    validate: (v) => v.length > 20 || 'Please provide more background detail',
  });

  const eraInput = await input({
    message: 'Era of expertise (optional, e.g., "1990s-2020s"):',
    default: '',
  });

  const worksInput = await input({
    message: 'Notable works (comma-separated, e.g., "Book Title, Framework Name"):',
    default: '',
  });

  // Voice
  console.log(chalk.bold('\n── Voice & Communication ──\n'));

  const toneInput = await input({
    message: 'Tone characteristics (comma-separated, e.g., "warm, professorial, curious"):',
    default: 'Professional, thoughtful, clear',
    validate: (v) => v.split(',').length >= 2 || 'Provide at least 2 tone characteristics',
  });

  const phrasesInput = await input({
    message: 'Signature phrases (comma-separated, 3-5 phrases this persona uses):',
    validate: (v) => v.split(',').length >= 3 || 'Provide at least 3 phrases',
  });

  const styleInput = await input({
    message: 'Communication style (comma-separated, how they structure thinking):',
    default:
      'Asks clarifying questions first, Uses examples to illustrate, Acknowledges complexity',
  });

  const constraintsInput = await input({
    message: 'Constraints (comma-separated, what this persona would NOT do):',
    default: 'Makes overconfident predictions, Gives generic advice, Ignores context',
  });

  // Frameworks
  console.log(chalk.bold('\n── Frameworks & Mental Models ──\n'));

  const frameworks: FrameworkData[] = [];
  let addMore = true;

  while (addMore && frameworks.length < 5) {
    console.log(chalk.dim(`\nFramework ${frameworks.length + 1}:`));

    const fwName = await input({
      message: 'Framework name:',
      validate: (v) => v.length > 0 || 'Name is required',
    });

    const fwDescription = await input({
      message: 'Brief description (1-2 sentences):',
      validate: (v) => v.length > 10 || 'Please provide more detail',
    });

    const conceptsInput = await input({
      message: 'Key concepts (format: "concept1: definition, concept2: definition"):',
      validate: (v) => v.includes(':') || 'Use format "concept: definition"',
    });

    const questionsInput = await input({
      message: 'Diagnostic questions (comma-separated):',
      validate: (v) => v.split(',').length >= 2 || 'Provide at least 2 questions',
    });

    frameworks.push({
      key: toSnakeCase(fwName),
      name: fwName,
      description: fwDescription,
      concepts: parseConceptsInput(conceptsInput),
      questions: splitAndTrim(questionsInput),
    });

    if (frameworks.length < 5) {
      addMore = await confirm({
        message: 'Add another framework?',
        default: frameworks.length < 2,
      });
    }
  }

  // Tags
  const tagsInput = await input({
    message: 'Tags for categorization (comma-separated):',
    default: category,
  });

  return {
    name: kebabName,
    displayName,
    role,
    background,
    era: eraInput || undefined,
    notableWorks: splitAndTrim(worksInput),
    category,
    tone: splitAndTrim(toneInput),
    phrases: splitAndTrim(phrasesInput),
    style: splitAndTrim(styleInput),
    constraints: splitAndTrim(constraintsInput),
    frameworks,
    tags: splitAndTrim(tagsInput),
  };
}

/**
 * Get minimal template for non-interactive mode
 */
function getMinimalTemplate(kebabName: string): PersonaData {
  return {
    name: kebabName,
    displayName: toTitleCase(kebabName),
    role: 'Expert Advisor',
    background: 'An expert in their field with deep knowledge and practical experience.',
    category: 'custom',
    tone: ['Professional', 'Thoughtful', 'Clear'],
    phrases: [
      'Let me think about this...',
      'Based on my experience...',
      'The key consideration here is...',
    ],
    style: [
      'Asks clarifying questions first',
      'Uses examples to illustrate points',
      'Acknowledges complexity and nuance',
    ],
    constraints: [
      'Never makes overconfident predictions',
      'Never gives generic advice without context',
    ],
    frameworks: [
      {
        key: 'core_framework',
        name: 'Core Framework',
        description: 'The primary mental model used for analysis.',
        concepts: [{ key: 'key_concept', definition: 'A fundamental concept in this framework' }],
        questions: [
          'What is the core problem we are trying to solve?',
          'What constraints are we working within?',
        ],
      },
    ],
    tags: ['custom'],
    notableWorks: [],
  };
}

/**
 * Generate tier.yaml content
 */
function generateTierYaml(name: string, isAgent: boolean): string {
  const today = new Date().toISOString().split('T')[0];
  const tier: Record<string, unknown> = {
    mode: isAgent ? 'agent' : 'persona',
    ...(isAgent && {
      promoted_at: today,
      promoted_by: 'cli-scaffold',
      promotion_reason: 'Created with --agent flag',
    }),
    graduation_gates: {},
    history: [],
  };

  return `# Tier metadata for ${name}\n# Managed by Academy v2 tiering system\n\n` +
    yamlStringify(tier, { lineWidth: 100 });
}

/**
 * Generate persona YAML content
 */
function generatePersonaYaml(data: PersonaData, includeAgentConfig = false): string {
  const persona = {
    identity: {
      name: data.displayName,
      role: data.role,
      background: data.background,
      ...(data.era && { era: data.era }),
      ...(data.notableWorks.length > 0 && { notable_works: data.notableWorks }),
    },
    voice: {
      tone: data.tone,
      phrases: data.phrases,
      style: data.style,
      constraints: data.constraints,
    },
    frameworks: Object.fromEntries(
      data.frameworks.map((fw) => [
        fw.key,
        {
          description: fw.description,
          concepts: Object.fromEntries(
            fw.concepts.map((c) => [c.key, { definition: c.definition }]),
          ),
          questions: fw.questions,
        },
      ]),
    ),
    validation: {
      must_include: [
        {
          pattern: data.frameworks[0]?.key || 'framework',
          description: 'Reference to primary framework',
          weight: 10,
        },
        {
          pattern: 'question|understand|clarify',
          description: 'Asking clarifying questions',
          weight: 8,
        },
        {
          pattern: 'consider|context|situation',
          description: 'Contextual awareness',
          weight: 7,
        },
      ],
      should_include: [
        {
          pattern: 'example|instance|case',
          description: 'Use of examples',
          weight: 5,
        },
      ],
      must_avoid: [
        {
          pattern: 'definitely|guaranteed|certainly',
          description: 'Overconfidence',
          weight: 10,
        },
      ],
    },
    ...(includeAgentConfig && {
      agent_config: {
        description: `${data.displayName}: ${data.role}. Edit this description for orchestrator routing.`,
        prompt_file: `${data.name}_agent_prompt.md`,
        model: 'sonnet',
        tools: {
          groups: ['file_readonly'],
        },
        guardrails: {
          read_only: true,
        },
      },
    }),
    metadata: {
      version: '1.0.0',
      author: 'Agent Persona Academy',
      created: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString().split('T')[0],
      tags: data.tags,
      category: data.category,
    },
  };

  // Add header comment
  const header = `# =============================================================================
# ${data.displayName} Persona
# =============================================================================
# ${data.role}
#
# Generated by Agent Persona Academy
# Edit this file to customize the persona behavior
# =============================================================================

`;

  return header + yamlStringify(persona, { lineWidth: 100 });
}

/**
 * Generate README for the persona
 */
function generatePersonaReadme(data: PersonaData): string {
  return `# ${data.displayName}

${data.role}

## Background

${data.background}

## Frameworks

${data.frameworks.map((fw) => `### ${fw.name}\n\n${fw.description}`).join('\n\n')}

## Usage

\`\`\`bash
# Validate the persona
persona-academy validate ./personas/${data.name}

# Test fidelity
persona-academy test ./personas/${data.name}

# Build MCP server
persona-academy build ./personas/${data.name}
\`\`\`

## Customization

Edit \`persona.yaml\` to:
- Refine voice characteristics and phrases
- Add more frameworks and concepts
- Adjust validation markers
- Add sample responses for testing

---

*Generated by Agent Persona Academy*
`;
}

// Utility functions
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function toTitleCase(str: string): string {
  return str
    .split(/[-_\s]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function splitAndTrim(str: string): string[] {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseConceptsInput(input: string): { key: string; definition: string }[] {
  return input.split(',').map((part) => {
    const [name, ...defParts] = part.split(':');
    return {
      key: toSnakeCase(name.trim()),
      definition: defParts.join(':').trim() || 'Definition needed',
    };
  });
}
