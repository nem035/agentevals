import { writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import pc from 'picocolors'

const CONFIG_TEMPLATE = `import { defineConfig } from '@nem035/agentevals'

export default defineConfig({
  // Test discovery patterns
  include: ['**/*.eval.ts', '**/*.eval.js'],
  exclude: ['node_modules/**', 'dist/**'],

  // Execution settings
  trials: 1,           // Runs per task (for pass@k)
  timeout: 60000,      // Per-task timeout (ms)
  parallel: true,      // Run tasks in parallel
  maxConcurrency: 5,   // Max concurrent tasks

  // Output reporters
  reporters: ['console'],
})
`

const EXAMPLE_EVAL_TEMPLATE = `import { evalite } from '@nem035/agentevals'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

// Simple eval - use AI SDK directly, no wrappers!
evalite('responds to greeting', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a friendly assistant. Keep responses brief.',
    prompt: 'Hello!',
  })

  expect(result).toContain('hello')
  expect(result).not.toContain('error')
})

evalite('answers math questions', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'What is 2 + 2? Just give me the number.',
  })

  expect(result).toMatch(/4/)
})

// Group related evals together
evalite.group('helpfulness', () => {
  evalite('offers assistance', async ({ expect }) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: 'Can you help me?',
    })

    expect(result).toContain('help')
  })
})
`

export async function initCommand(): Promise<number> {
  const cwd = process.cwd()

  console.log()
  console.log(pc.bold(pc.cyan(' AGENTEVALS')) + ' - Initializing project')
  console.log()

  // Create config file
  const configPath = resolve(cwd, 'agentevals.config.ts')
  if (existsSync(configPath)) {
    console.log(pc.yellow('  ! agentevals.config.ts already exists, skipping'))
  } else {
    writeFileSync(configPath, CONFIG_TEMPLATE)
    console.log(pc.green('  + Created agentevals.config.ts'))
  }

  // Create example eval file
  const examplePath = resolve(cwd, 'example.eval.ts')
  if (existsSync(examplePath)) {
    console.log(pc.yellow('  ! example.eval.ts already exists, skipping'))
  } else {
    writeFileSync(examplePath, EXAMPLE_EVAL_TEMPLATE)
    console.log(pc.green('  + Created example.eval.ts'))
  }

  console.log()
  console.log(' Next steps:')
  console.log(pc.dim('  1. Set your API key:'))
  console.log('     export ANTHROPIC_API_KEY=your-key')
  console.log()
  console.log(pc.dim('  2. Run the example eval:'))
  console.log('     npx agentevals run')
  console.log()

  return 0
}
