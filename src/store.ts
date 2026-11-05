import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { RunRecord } from './types.js'

export const DEFAULT_OUT_DIR = '.agentevals/runs'

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'eval'

/** Save a run with every trial's full output, so it can be compared and regraded later. */
export async function saveRun(run: RunRecord, outDir = DEFAULT_OUT_DIR): Promise<string> {
  const dir = resolve(outDir, slug(run.eval) + (run.variant ? `--${slug(run.variant)}` : ''))
  await mkdir(dir, { recursive: true })
  const stamp = run.startedAt.replace(/[:.]/g, '-')
  const file = join(dir, `${stamp}${run.label ? `--${slug(run.label)}` : ''}.json`)
  await writeFile(file, JSON.stringify(run, null, 2))
  return file
}

export async function loadRun(path: string): Promise<RunRecord> {
  const run = JSON.parse(await readFile(path, 'utf8')) as RunRecord
  if (run.version !== 1) throw new Error(`${path} is not an agentevals run`)
  return run
}

export interface SavedRun {
  path: string
  run: RunRecord
}

/** All saved runs, oldest first. */
export async function listRuns(outDir = DEFAULT_OUT_DIR): Promise<SavedRun[]> {
  const root = resolve(outDir)
  let dirs: string[]
  try {
    dirs = await readdir(root)
  } catch {
    return []
  }
  const runs: SavedRun[] = []
  for (const d of dirs) {
    let files: string[]
    try {
      files = await readdir(join(root, d))
    } catch {
      continue
    }
    for (const f of files.filter((f) => f.endsWith('.json'))) {
      const path = join(root, d, f)
      try {
        runs.push({ path, run: await loadRun(path) })
      } catch {
        // not a run file
      }
    }
  }
  return runs.sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt))
}

/**
 * Find a run by file path, label, or "eval/variant" name, newest match first.
 * Without a reference, returns the newest run.
 */
export async function findRun(ref: string | undefined, outDir = DEFAULT_OUT_DIR, evalName?: string): Promise<SavedRun> {
  if (ref && ref.endsWith('.json')) return { path: ref, run: await loadRun(ref) }
  const runs = (await listRuns(outDir)).filter((r) => !evalName || r.run.eval === evalName).reverse()
  const hit = ref
    ? runs.find((r) => r.run.label === ref || r.run.variant === ref || r.run.eval === ref)
    : runs[0]
  if (!hit) throw new Error(ref ? `No saved run matches "${ref}"` : `No saved runs in ${outDir}`)
  return hit
}
