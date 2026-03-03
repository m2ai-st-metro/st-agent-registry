/**
 * Promote Command
 *
 * Promotes a persona to Agent mode by:
 * 1. Running graduation gates to verify readiness
 * 2. Writing a promotion record to data/promotions.jsonl
 * 3. Metroplex picks up the promotion on its next cycle
 *
 * Usage:
 *   persona-academy promote <path>
 *   persona-academy promote ./personas/code-reviewer --priority high
 *   persona-academy promote ./personas/sky-lynx --dry-run
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { parse as yamlParse } from 'yaml';
import type { PersonaDefinition, TierMetadata } from '../../core/types.js';

interface PromotionRecord {
  promotion_id: string;
  persona_id: string;
  persona_name: string;
  persona_role: string;
  model: string;
  tool_groups: string[];
  prompt_file: string;
  priority: string;
  status: string;
  promoted_at: string;
  promotion_reason: string;
  graduation_gates: Record<string, boolean>;
}

export const promoteCommand = new Command('promote')
  .description('Promote a persona to Agent mode (writes to Metroplex priority queue)')
  .argument('<path>', 'Path to persona directory')
  .option('-p, --priority <level>', 'Priority level: critical, high, medium, low', 'high')
  .option('--dry-run', 'Show what would be promoted without writing', false)
  .option('--force', 'Skip graduation gate checks', false)
  .option('--reason <reason>', 'Custom promotion reason')
  .action(async (personaPath: string, options) => {
    const absPath = resolve(personaPath);

    // Load persona.yaml
    const yamlPath = join(absPath, 'persona.yaml');
    if (!existsSync(yamlPath)) {
      console.error(chalk.red(`No persona.yaml found at ${absPath}`));
      process.exit(1);
    }

    const yamlContent = readFileSync(yamlPath, 'utf-8');
    const persona = yamlParse(yamlContent) as PersonaDefinition;
    const personaId = absPath.split('/').pop() || 'unknown';
    const personaName = persona.identity?.name || personaId;

    // Check agent_config exists
    if (!persona.agent_config) {
      console.error(chalk.red(`${personaName} has no agent_config section in persona.yaml`));
      console.error(chalk.yellow('Add agent_config first, then run graduation gates.'));
      process.exit(1);
    }

    // Check tier.yaml
    const tierPath = join(absPath, 'tier.yaml');
    let tier: TierMetadata | null = null;
    if (existsSync(tierPath)) {
      tier = yamlParse(readFileSync(tierPath, 'utf-8')) as TierMetadata;
    }

    if (tier?.mode === 'agent') {
      console.log(chalk.yellow(`${personaName} is already in Agent mode.`));
      const cont = !options.force;
      if (cont) {
        console.log(chalk.dim('Use --force to re-promote anyway.'));
        process.exit(0);
      }
    }

    console.log(chalk.cyan(`\nPromotion Evaluation: ${personaName}`));
    console.log(chalk.dim('─'.repeat(60)));

    // Run quick graduation gate checks (unless --force)
    const gateResults: Record<string, boolean> = {};
    let requiredFailCount = 0;

    if (!options.force) {
      console.log(chalk.dim('\nRunning graduation gates...\n'));

      // G1.0: Persona baseline
      const hasIdentity = !!(persona.identity?.name && persona.identity?.role);
      const hasVoice = !!(persona.voice?.tone && persona.voice.tone.length >= 2);
      const hasPhrases = !!(persona.voice?.phrases && persona.voice.phrases.length >= 3);
      const hasFrameworks = !!(persona.frameworks && Object.keys(persona.frameworks).length > 0);
      const hasValidation = !!(persona.validation?.must_include && persona.validation.must_include.length >= 3);
      const g10 = hasIdentity && hasVoice && hasPhrases && hasFrameworks && hasValidation;
      gateResults['G1.0'] = g10;
      if (!g10) requiredFailCount++;
      console.log(`  ${g10 ? chalk.green('PASS') : chalk.red('FAIL')}  G1.0 Persona baseline`);

      // G1.1: Guardrails
      const ac = persona.agent_config;
      const hasGuardrails = ac.guardrails !== undefined;
      const hasToolExclude = !!(ac.tools?.exclude && ac.tools.exclude.length > 0);
      const hasDescription = !!(ac.description && ac.description.length >= 10);
      const g11 = (hasGuardrails || hasToolExclude) && hasDescription;
      gateResults['G1.1'] = g11;
      if (!g11) requiredFailCount++;
      console.log(`  ${g11 ? chalk.green('PASS') : chalk.red('FAIL')}  G1.1 Guardrails verification`);

      // G1.4: Safety audit (structural)
      const hasPromptFile = !!(ac.prompt_file && ac.prompt_file.endsWith('.md'));
      const hasModel = !!ac.model;
      const hasToolGroups = !!(ac.tools?.groups && ac.tools.groups.length > 0);
      const hasMustAvoid = !!(persona.validation?.must_avoid && persona.validation.must_avoid.length > 0);
      const hasConstraints = !!(persona.voice?.constraints && persona.voice.constraints.length > 0);
      const g14 = hasPromptFile && hasModel && hasToolGroups && hasMustAvoid && hasConstraints;
      gateResults['G1.4'] = g14;
      if (!g14) requiredFailCount++;
      console.log(`  ${g14 ? chalk.green('PASS') : chalk.red('FAIL')}  G1.4 Safety audit`);

      // G1.8: Observability
      const hasSampleResponses = !!(persona.sample_responses && Object.keys(persona.sample_responses).length > 0);
      const g18 = hasDescription && hasModel && hasSampleResponses;
      gateResults['G1.8'] = g18;
      if (!g18) requiredFailCount++;
      console.log(`  ${g18 ? chalk.green('PASS') : chalk.red('FAIL')}  G1.8 Observability`);

      if (requiredFailCount > 0) {
        console.log(chalk.red(`\n  ${requiredFailCount} required gate(s) failed.`));
        console.log(chalk.yellow('  Fix the failing gates or use --force to override.\n'));
        process.exit(1);
      }

      console.log(chalk.green('\n  All required gates passed.'));
    } else {
      console.log(chalk.yellow('\n  Graduation gates skipped (--force).'));
    }

    // Build promotion record
    const ac = persona.agent_config!;
    const promotionId = `promo-${personaId}-${Date.now()}`;
    const record: PromotionRecord = {
      promotion_id: promotionId,
      persona_id: personaId,
      persona_name: personaName,
      persona_role: persona.identity?.role || 'Agent',
      model: ac.model || 'sonnet',
      tool_groups: ac.tools?.groups || ['file_readonly'],
      prompt_file: ac.prompt_file || `${personaId}_agent_prompt.md`,
      priority: options.priority,
      status: 'pending',
      promoted_at: new Date().toISOString(),
      promotion_reason: options.reason || `Graduation gates passed (${Object.keys(gateResults).length} gates)`,
      graduation_gates: gateResults,
    };

    console.log(chalk.dim('\n─'.repeat(60)));
    console.log(chalk.cyan('\nPromotion record:'));
    console.log(chalk.dim(`  ID: ${promotionId}`));
    console.log(chalk.dim(`  Persona: ${personaName} (${personaId})`));
    console.log(chalk.dim(`  Model: ${record.model}`));
    console.log(chalk.dim(`  Tools: ${record.tool_groups.join(', ')}`));
    console.log(chalk.dim(`  Priority: ${record.priority}`));
    console.log(chalk.dim(`  Reason: ${record.promotion_reason}`));

    if (options.dryRun) {
      console.log(chalk.yellow('\n  [DRY RUN] Would write to data/promotions.jsonl'));
      console.log(chalk.dim(`  ${JSON.stringify(record)}`));
      process.exit(0);
    }

    // Write to promotions.jsonl
    const dataDir = join(resolve('.'), 'data');
    const promotionsPath = join(dataDir, 'promotions.jsonl');

    mkdirSync(dataDir, { recursive: true });
    appendFileSync(promotionsPath, JSON.stringify(record) + '\n');

    console.log(chalk.green(`\n  Promotion record written to ${promotionsPath}`));
    console.log(chalk.cyan('\n  Next steps:'));
    console.log(`    1. Metroplex picks this up on its next cycle`);
    console.log(`    2. SpecGenerator creates agent build spec from tier1_agent_template`);
    console.log(`    3. YCE Harness builds the agent`);
    console.log(`    4. Gate 4 publishes to GitHub\n`);

    process.exit(0);
  });
