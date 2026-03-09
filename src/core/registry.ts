import type { EvalTask, EvalFn, EvaliteOptions, EvalGroup } from '../types.js'

/**
 * Global registry for collecting eval tasks during file loading.
 * Tasks can be standalone or grouped.
 */

let collectedTasks: EvalTask[] = []
let collectedGroups: EvalGroup[] = []
let currentGroup: EvalGroup | null = null
let currentFile: string = ''

export function setCurrentFile(file: string): void {
  currentFile = file
}

export function getCurrentFile(): string {
  return currentFile
}

export function resetRegistry(): void {
  collectedTasks = []
  collectedGroups = []
  currentGroup = null
  currentFile = ''
}

export function getCollectedTasks(): EvalTask[] {
  return collectedTasks
}

export function getCollectedGroups(): EvalGroup[] {
  return collectedGroups
}

/**
 * Define a single eval task.
 *
 * @example
 * evalite('answers math questions', async ({ expect }) => {
 *   const result = await generateText({
 *     model: anthropic('claude-sonnet-4-20250514'),
 *     prompt: 'What is 2 + 2?',
 *   })
 *   expect(result).toContain('4')
 * })
 *
 * @example
 * evalite('with judge', {
 *   judge: anthropic('claude-haiku-4-20250514'),
 * }, async ({ expect }) => {
 *   const result = await generateText({ ... })
 *   await expect(result).toPassJudge('Answers correctly')
 * })
 */
export function evalite(
  name: string,
  optionsOrFn: EvaliteOptions | EvalFn,
  maybeFn?: EvalFn
): void {
  const options: EvaliteOptions = typeof optionsOrFn === 'function' ? {} : optionsOrFn
  const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn!

  const task: EvalTask = {
    name,
    fn,
    options,
    group: currentGroup?.name,
  }

  if (currentGroup) {
    currentGroup.tasks.push(task)
  }

  collectedTasks.push(task)
}

/**
 * Group related evals together.
 *
 * @example
 * evalite.group('math-agent', {
 *   judge: anthropic('claude-haiku-4-20250514'),
 * }, () => {
 *   evalite('addition', async ({ expect }) => { ... })
 *   evalite('subtraction', async ({ expect }) => { ... })
 * })
 */
evalite.group = function group(
  name: string,
  optionsOrFn: EvaliteOptions | (() => void),
  maybeFn?: () => void
): void {
  const options: EvaliteOptions = typeof optionsOrFn === 'function' ? {} : optionsOrFn
  const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn!

  const evalGroup: EvalGroup = {
    name,
    tasks: [],
    options,
  }

  collectedGroups.push(evalGroup)
  currentGroup = evalGroup

  // Execute the group body to collect tasks
  fn()

  currentGroup = null
}

// Aliases for familiarity
export { evalite as test }
export { evalite as it }
