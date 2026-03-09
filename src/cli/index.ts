#!/usr/bin/env node
import { Command } from 'commander'
import { runCommand } from './commands/run.js'
import { initCommand } from './commands/init.js'

const program = new Command()

program
  .name('agentevals')
  .description('A CLI for AI agent evaluations. Test your LLM apps with simple, declarative evals.')
  .version('0.2.0')

program
  .command('run', { isDefault: true })
  .description('Run eval files')
  .argument('[patterns...]', 'Glob patterns or file names to run')
  .option('-c, --config <path>', 'Path to config file')
  .option('-g, --grep <pattern>', 'Filter tasks by name pattern')
  .option('-t, --trials <n>', 'Number of trials per task', parseInt)
  .option('--max-cost <usd>', 'Maximum cost limit in USD', parseFloat)
  .option('-r, --reporter <type>', 'Reporter type: console, json', 'console')
  .option('-v, --verbose', 'Show detailed output')
  .option('--dry-run', 'Show what would be run without executing')
  .action(async (patterns: string[], options) => {
    const exitCode = await runCommand(patterns, options)
    process.exit(exitCode)
  })

program
  .command('init')
  .description('Initialize agentevals in the current directory')
  .action(async () => {
    const exitCode = await initCommand()
    process.exit(exitCode)
  })

program.parse()
