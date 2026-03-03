#!/usr/bin/env node
/**
 * Agent Persona Academy CLI
 *
 * Factory tool for creating, validating, and managing Claude persona agents.
 *
 * Commands:
 *   create <name>     - Create a new persona from template
 *   validate <path>   - Validate persona YAML against schema
 *   test <path>       - Run fidelity tests on a persona
 *   list              - List local personas
 *   info <name>       - Show details about a persona
 *   report <path>     - Generate quality report
 *   compare <dir>     - Compare text across personas
 *   remote            - List personas in remote registry
 *   pull <ids...>     - Pull personas from registry
 *   cache             - Manage local cache
 *   serve             - Start the MCP server
 *   graduate <path>   - Evaluate graduation gates for Agent mode
 *   promote <path>    - Promote persona to Agent mode (Metroplex build)
 */

import { Command } from 'commander';
import { createCommand } from './commands/create.js';
import { validateCommand } from './commands/validate.js';
import { testCommand } from './commands/test.js';
import { listCommand } from './commands/list.js';
import { infoCommand } from './commands/info.js';
import { reportCommand } from './commands/report.js';
import { compareCommand } from './commands/compare.js';
import { remoteCommand } from './commands/remote.js';
import { pullCommand } from './commands/pull.js';
import { cacheCommand } from './commands/cache.js';
import { serveCommand } from './commands/serve.js';
import { departmentCommand } from './commands/department.js';
import { graduateCommand } from './commands/graduate.js';
import { promoteCommand } from './commands/promote.js';

const program = new Command();

program
  .name('persona-academy')
  .description('Factory tool for creating Claude persona agents')
  .version('0.1.0');

// Local persona commands
program.addCommand(createCommand);
program.addCommand(validateCommand);
program.addCommand(testCommand);
program.addCommand(listCommand);
program.addCommand(infoCommand);

// Validation & quality commands
program.addCommand(reportCommand);
program.addCommand(compareCommand);

// Remote registry commands
program.addCommand(remoteCommand);
program.addCommand(pullCommand);
program.addCommand(cacheCommand);

// Department commands
program.addCommand(departmentCommand);

// Graduation & tiering commands
program.addCommand(graduateCommand);
program.addCommand(promoteCommand);

// MCP server command
program.addCommand(serveCommand);

// Parse and execute
program.parse();
