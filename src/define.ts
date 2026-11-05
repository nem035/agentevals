import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Case, Config, EvalDefinition } from './types.js'

/**
 * Define an eval: cases, the task under test, and graders.
 *
 *   export default defineEval({
 *     name: 'date extraction',
 *     cases: './cases.jsonl',
 *     task: (input) => extractDate(input.email),
 *     graders: [grader('sameDay', (out, c) => sameDay(out, c.expected))],
 *     trials: 3,
 *     holdout: 0.3,
 *   })
 *
 * Everything is a plain value, so evals compose with spread:
 *   export const withNewPrompt = defineEval({ ...dates, name: 'dates (new prompt)', task: newTask })
 */
export function defineEval<Input = any, Output = any, Expected = any>(
  def: EvalDefinition<Input, Output, Expected>,
): EvalDefinition<Input, Output, Expected> {
  if (!def.name) throw new Error('defineEval: `name` is required')
  if (!def.task && !def.variants) throw new Error(`defineEval(${def.name}): give a \`task\` or \`variants\``)
  if (def.task && def.variants) throw new Error(`defineEval(${def.name}): give \`task\` or \`variants\`, not both`)
  if (def.variants && Object.keys(def.variants).length === 0) throw new Error(`defineEval(${def.name}): \`variants\` is empty`)
  if (!def.graders?.length) throw new Error(`defineEval(${def.name}): add at least one grader`)
  if (def.holdout !== undefined && !(def.holdout > 0 && def.holdout < 1)) {
    throw new Error(`defineEval(${def.name}): \`holdout\` must be between 0 and 1, like 0.3`)
  }
  return def
}

export function defineConfig(config: Config): Config {
  return config
}

/** Thrown from a task to record a measured failure (the model's fault), not a broken trial. */
export class ModelFailure extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'ModelFailure'
  }
}

/** Shorthand: `throw fail('model returned invalid JSON')` inside a task. */
export function fail(reason: string): ModelFailure {
  return new ModelFailure(reason)
}

/** Load cases from an array or a .json / .jsonl file. Ids must be unique. */
export async function loadCases(cases: readonly Case[] | string, baseDir = process.cwd()): Promise<Case[]> {
  let list: Case[]
  if (typeof cases === 'string') {
    const path = resolve(baseDir, cases)
    const text = await readFile(path, 'utf8')
    list = path.endsWith('.jsonl')
      ? text
          .split('\n')
          .filter((l) => l.trim())
          .map((l, i) => {
            try {
              return JSON.parse(l) as Case
            } catch {
              throw new Error(`${cases}: line ${i + 1} is not valid JSON`)
            }
          })
      : (JSON.parse(text) as Case[])
  } else {
    list = [...cases]
  }
  const seen = new Set<string>()
  for (const c of list) {
    if (typeof c.id !== 'string' || !c.id) throw new Error('Every case needs a string `id` that stays the same across runs')
    if (seen.has(c.id)) throw new Error(`Duplicate case id "${c.id}"`)
    seen.add(c.id)
  }
  return list
}
