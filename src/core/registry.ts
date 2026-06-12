import type {
  EvalTask,
  EvalFn,
  EvaliteOptions,
  EvalGroup,
  EvalCaseFn,
  EvalCaseName,
  EvaliteApi,
} from '../types.js'
import { mergeEvalOptions } from './options.js'

/**
 * Global registry for collecting eval tasks during file loading.
 * Tasks can be standalone or grouped.
 */

let collectedTasks: EvalTask[] = []
let collectedGroups: EvalGroup[] = []
let groupStack: EvalGroup[] = []
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
  groupStack = []
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
function defineEval(
  name: string,
  optionsOrFn: EvaliteOptions | EvalFn,
  maybeFn?: EvalFn
): void {
  const { options, fn } = resolveEvalArgs(optionsOrFn, maybeFn)
  const currentGroup = groupStack.at(-1)

  const task: EvalTask = {
    name,
    fn,
    options,
    group: currentGroup?.name,
    file: currentFile || undefined,
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
function group(
  name: string,
  optionsOrFn: EvaliteOptions | (() => void),
  maybeFn?: () => void
): void {
  const options: EvaliteOptions = typeof optionsOrFn === 'function' ? {} : optionsOrFn
  const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn

  if (!fn) {
    throw new TypeError('evalite.group() requires a callback function')
  }

  const parentGroup = groupStack.at(-1)
  const evalGroup: EvalGroup = {
    name: parentGroup ? `${parentGroup.name} > ${name}` : name,
    tasks: [],
    options: mergeEvalOptions(parentGroup?.options, options),
  }

  collectedGroups.push(evalGroup)
  groupStack.push(evalGroup)

  try {
    // Execute the group body to collect tasks
    fn()
  } finally {
    groupStack.pop()
  }
}

function each<TCase>(cases: readonly TCase[]) {
  return function registerEach(
    name: EvalCaseName<TCase>,
    optionsOrFn: EvaliteOptions | EvalCaseFn<TCase>,
    maybeFn?: EvalCaseFn<TCase>
  ): void {
    const options: EvaliteOptions = typeof optionsOrFn === 'function' ? {} : optionsOrFn
    const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn

    if (!fn) {
      throw new TypeError('evalite.each() requires a callback function')
    }

    cases.forEach((testCase, index) => {
      const resolvedName =
        typeof name === 'function' ? name(testCase, index) : interpolateCaseName(name, testCase, index)

      defineEval(resolvedName, options, (context) => fn(testCase, context))
    })
  }
}

function resolveEvalArgs(
  optionsOrFn: EvaliteOptions | EvalFn,
  maybeFn?: EvalFn
): { options: EvaliteOptions; fn: EvalFn } {
  if (typeof optionsOrFn === 'function') {
    return { options: {}, fn: optionsOrFn }
  }

  if (!maybeFn) {
    throw new TypeError('evalite() requires a callback function')
  }

  return { options: optionsOrFn, fn: maybeFn }
}

function interpolateCaseName<TCase>(
  name: string,
  testCase: TCase,
  index: number
): string {
  const values =
    typeof testCase === 'object' && testCase !== null
      ? (testCase as Record<string, unknown>)
      : {}

  return name
    .replace(/\$#/g, String(index))
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, key: string) =>
      key in values ? String(values[key]) : match
    )
}

export const evalite = defineEval as EvaliteApi
evalite.group = group
evalite.each = each

// Aliases for familiarity
export const test = evalite
export const it = evalite
export const describe = evalite.group
