import { existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { glob } from 'glob'
import { createJiti } from 'jiti'
import type { Config, EvalDefinition } from '../types.js'

const jiti = createJiti(import.meta.url, { interopDefault: true, moduleCache: false })

export const DEFAULT_INCLUDE = ['**/*.eval.ts', '**/*.eval.js', '**/*.eval.mjs']
const ALWAYS_EXCLUDE = ['**/node_modules/**', '**/dist/**', '**/.agentevals/**']

export async function loadConfig(cwd = process.cwd()): Promise<Config> {
  for (const name of ['agentevals.config.ts', 'agentevals.config.js', 'agentevals.config.mjs']) {
    const path = resolve(cwd, name)
    if (existsSync(path)) {
      const mod = (await jiti.import(path)) as { default?: Config } | Config
      return ((mod as { default?: Config }).default ?? mod) as Config
    }
  }
  return {}
}

export async function findEvalFiles(patterns: string[] | undefined, config: Config, cwd = process.cwd()): Promise<string[]> {
  const isDir = (p: string) => existsSync(resolve(cwd, p)) && statSync(resolve(cwd, p)).isDirectory()
  // A folder means every eval file inside it.
  const include = patterns?.length
    ? patterns.flatMap((p) => (isDir(p) ? DEFAULT_INCLUDE.map((g) => `${p.replace(/\/$/, '')}/${g}`) : [p]))
    : config.include ?? DEFAULT_INCLUDE
  const files = await glob(include, { cwd, absolute: true, ignore: [...ALWAYS_EXCLUDE, ...(config.exclude ?? [])] })
  return files.sort()
}

export interface LoadedEval {
  def: EvalDefinition
  file: string
}

const isEval = (v: unknown): v is EvalDefinition =>
  typeof v === 'object' && v !== null && 'name' in v && 'cases' in v && 'graders' in v && ('task' in v || 'variants' in v)

/** Every eval exported from the files: the default export and any named ones. */
export async function loadEvals(files: string[]): Promise<LoadedEval[]> {
  const out: LoadedEval[] = []
  for (const file of files) {
    const mod = (await jiti.import(file)) as Record<string, unknown>
    const values = new Set<unknown>([mod.default, ...Object.values(mod)])
    for (const v of values) if (isEval(v)) out.push({ def: v, file })
  }
  const names = new Map<string, string>()
  for (const { def, file } of out) {
    const prev = names.get(def.name)
    if (prev) throw new Error(`Two evals are named "${def.name}" (${prev} and ${file}). Eval names identify saved runs, so they must be unique.`)
    names.set(def.name, file)
  }
  return out
}

export const baseDirOf = (file: string) => dirname(file)
