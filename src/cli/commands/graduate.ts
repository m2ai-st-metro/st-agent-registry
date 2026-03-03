/**
 * Graduate Command
 *
 * Evaluates graduation gates for a persona transitioning to Agent mode.
 * Checks G1.1-G1.4 and G1.8 (the required gates for first agents).
 *
 * Usage:
 *   persona-academy graduate <path>
 *   persona-academy graduate ./personas/code-reviewer --verbose
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { parse as yamlParse } from 'yaml';
import type { PersonaDefinition, AgentConfig, TierMetadata } from '../../core/types.js';

interface GateResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
  required: boolean;
}

export const graduateCommand = new Command('graduate')
  .description('Evaluate graduation gates for Agent mode readiness')
  .argument('<path>', 'Path to persona directory')
  .option('-v, --verbose', 'Show detailed output for each gate', false)
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
    const personaName = persona.identity?.name || absPath.split('/').pop() || 'unknown';

    // Load tier.yaml if it exists
    const tierPath = join(absPath, 'tier.yaml');
    let tier: TierMetadata | null = null;
    if (existsSync(tierPath)) {
      tier = yamlParse(readFileSync(tierPath, 'utf-8')) as TierMetadata;
    }

    console.log(chalk.cyan(`\nGraduation Gate Evaluation: ${personaName}`));
    console.log(chalk.dim(`Mode: ${tier?.mode || 'unknown'}`));
    console.log(chalk.dim('─'.repeat(60)));

    const results: GateResult[] = [];

    // G1.0: Persona baseline (fidelity check)
    results.push(checkG10_PersonaBaseline(persona));

    // G1.1: Guardrails verification
    results.push(checkG11_Guardrails(persona));

    // G1.2: Human-in-the-loop gates
    results.push(checkG12_HilGates(persona));

    // G1.3: Delegation pattern validation
    results.push(checkG13_Delegation(persona));

    // G1.4: Safety audit (structural check)
    results.push(checkG14_SafetyAudit(persona, absPath));

    // G1.8: Observability
    results.push(checkG18_Observability(persona));

    // Print results
    console.log('');
    let passCount = 0;
    let requiredFailCount = 0;

    for (const result of results) {
      const icon = result.passed ? chalk.green('PASS') : chalk.red('FAIL');
      const req = result.required ? '' : chalk.dim(' (optional)');
      console.log(`  ${icon}  ${result.id} ${result.name}${req}`);

      if (options.verbose || !result.passed) {
        console.log(chalk.dim(`         ${result.details}`));
      }

      if (result.passed) passCount++;
      if (!result.passed && result.required) requiredFailCount++;
    }

    console.log(chalk.dim('\n' + '─'.repeat(60)));
    console.log(
      `  ${passCount}/${results.length} gates passed` +
      (requiredFailCount > 0
        ? chalk.red(` (${requiredFailCount} required gate(s) failed)`)
        : chalk.green(' -- ready for Agent mode'))
    );

    if (requiredFailCount === 0) {
      console.log(chalk.green(`\n  ${personaName} is eligible for Agent mode graduation.`));
    } else {
      console.log(chalk.yellow(`\n  ${personaName} is not ready for Agent mode. Fix the failed gates above.`));
    }

    console.log('');
    process.exit(requiredFailCount > 0 ? 1 : 0);
  });

// ============================================================================
// Gate Checks
// ============================================================================

function checkG10_PersonaBaseline(persona: PersonaDefinition): GateResult {
  const issues: string[] = [];

  if (!persona.identity?.name) issues.push('missing identity.name');
  if (!persona.identity?.role) issues.push('missing identity.role');
  if (!persona.voice?.tone || persona.voice.tone.length < 2) issues.push('voice.tone needs >= 2 entries');
  if (!persona.voice?.phrases || persona.voice.phrases.length < 3) issues.push('voice.phrases needs >= 3 entries');
  if (!persona.frameworks || Object.keys(persona.frameworks).length === 0) issues.push('no frameworks defined');
  if (!persona.validation?.must_include || persona.validation.must_include.length < 3) {
    issues.push('validation.must_include needs >= 3 markers');
  }
  if (!persona.agent_config) issues.push('no agent_config section');

  return {
    id: 'G1.0',
    name: 'Persona baseline + agent_config present',
    passed: issues.length === 0,
    details: issues.length === 0 ? 'All persona fields present with agent_config' : issues.join('; '),
    required: true,
  };
}

function checkG11_Guardrails(persona: PersonaDefinition): GateResult {
  const ac = persona.agent_config;
  if (!ac) {
    return { id: 'G1.1', name: 'Guardrails verification', passed: false, details: 'No agent_config', required: true };
  }

  const issues: string[] = [];

  // Check that guardrails exist OR read_only is true OR tools are restricted
  const hasGuardrails = ac.guardrails !== undefined;
  const isReadOnly = ac.guardrails?.read_only === true;
  const hasToolRestrictions = ac.tools?.exclude && ac.tools.exclude.length > 0;

  if (!hasGuardrails && !hasToolRestrictions) {
    issues.push('no guardrails section and no tool exclusions defined');
  }

  // Check that description exists (routing safety)
  if (!ac.description || ac.description.length < 10) {
    issues.push('description too short for safe orchestrator routing');
  }

  return {
    id: 'G1.1',
    name: 'Guardrails verification',
    passed: issues.length === 0,
    details: issues.length === 0
      ? `Guardrails configured${isReadOnly ? ' (read-only mode)' : ''}`
      : issues.join('; '),
    required: true,
  };
}

function checkG12_HilGates(persona: PersonaDefinition): GateResult {
  const ac = persona.agent_config;
  if (!ac) {
    return { id: 'G1.2', name: 'Human-in-the-loop gates', passed: false, details: 'No agent_config', required: false };
  }

  // HIL gates are optional for read-only agents
  const isReadOnly = ac.guardrails?.read_only === true;
  const hasHilGates = ac.hil_gates && ac.hil_gates.length > 0;
  const hasWriteTools = !isReadOnly && (!ac.tools?.exclude || !ac.tools.exclude.includes('Write'));

  if (hasWriteTools && !hasHilGates) {
    return {
      id: 'G1.2',
      name: 'Human-in-the-loop gates',
      passed: false,
      details: 'Agent has write capabilities but no HIL gates defined',
      required: false,
    };
  }

  return {
    id: 'G1.2',
    name: 'Human-in-the-loop gates',
    passed: true,
    details: isReadOnly
      ? 'Read-only agent (HIL gates not required)'
      : `${ac.hil_gates?.length || 0} HIL gate(s) defined`,
    required: false,
  };
}

function checkG13_Delegation(persona: PersonaDefinition): GateResult {
  const ac = persona.agent_config;
  if (!ac) {
    return { id: 'G1.3', name: 'Delegation pattern', passed: false, details: 'No agent_config', required: false };
  }

  // Delegation is optional -- only required if subagents are declared
  const hasSubagents = ac.subagents && ac.subagents.length > 0;

  if (hasSubagents) {
    const issues: string[] = [];
    for (const sub of ac.subagents!) {
      if (!sub.name) issues.push('subagent missing name');
      if (!sub.description || sub.description.length < 5) issues.push(`subagent ${sub.name}: description too short`);
    }
    return {
      id: 'G1.3',
      name: 'Delegation pattern',
      passed: issues.length === 0,
      details: issues.length === 0
        ? `${ac.subagents!.length} subagent(s) properly configured`
        : issues.join('; '),
      required: false,
    };
  }

  return {
    id: 'G1.3',
    name: 'Delegation pattern',
    passed: true,
    details: 'No subagents declared (standalone agent)',
    required: false,
  };
}

function checkG14_SafetyAudit(persona: PersonaDefinition, personaDir: string): GateResult {
  const ac = persona.agent_config;
  if (!ac) {
    return { id: 'G1.4', name: 'Safety audit', passed: false, details: 'No agent_config', required: true };
  }

  const issues: string[] = [];

  // Check prompt_file exists
  if (ac.prompt_file) {
    // We can't check yce-harness/prompts from here, but we can validate the field
    if (!ac.prompt_file.endsWith('.md')) {
      issues.push('prompt_file should end with .md');
    }
  } else {
    issues.push('no prompt_file specified (will use auto-generated prompt)');
  }

  // Check model is specified
  if (!ac.model) {
    issues.push('no model specified (will default to haiku)');
  }

  // Check tools are specified
  if (!ac.tools?.groups || ac.tools.groups.length === 0) {
    issues.push('no tool groups specified');
  }

  // Check must_avoid validation markers exist (persona safety)
  if (!persona.validation?.must_avoid || persona.validation.must_avoid.length === 0) {
    issues.push('no must_avoid validation markers (persona boundary safety)');
  }

  // Check voice constraints exist
  if (!persona.voice?.constraints || persona.voice.constraints.length === 0) {
    issues.push('no voice constraints defined');
  }

  return {
    id: 'G1.4',
    name: 'Safety audit (structural)',
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'Prompt file, model, tools, must_avoid markers, and voice constraints all present'
      : issues.join('; '),
    required: true,
  };
}

function checkG18_Observability(persona: PersonaDefinition): GateResult {
  const ac = persona.agent_config;
  if (!ac) {
    return { id: 'G1.8', name: 'Observability', passed: false, details: 'No agent_config', required: true };
  }

  // Observability = has description (for logging/routing) + model (for cost tracking)
  const issues: string[] = [];

  if (!ac.description || ac.description.length < 10) {
    issues.push('description needed for routing logs and observability');
  }

  if (!ac.model) {
    issues.push('model needed for cost tracking');
  }

  // Check that persona has sample_responses (for testing/regression)
  if (!persona.sample_responses || Object.keys(persona.sample_responses).length === 0) {
    issues.push('no sample_responses for regression testing');
  }

  return {
    id: 'G1.8',
    name: 'Observability',
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'Description, model, and sample_responses present for observability'
      : issues.join('; '),
    required: true,
  };
}
