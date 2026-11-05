import type {
  BrokenReason,
  Case,
  CaseRecord,
  EvalDefinition,
  GradeContext,
  Grader,
  GraderOutcome,
  JudgeModel,
  RunRecord,
  Split,
  Task,
  TrialRecord,
} from './types.js'
import { loadCases, ModelFailure } from './define.js'
import { normalizeOutput, wasCutOff } from './output.js'
import { splitOf } from './split.js'

export interface RunOptions {
  /** Name this run, e.g. "new-prompt", to find it later in `compare`. */
  label?: string
  /** Overrides the eval's trials. */
  trials?: number
  /** Trials running at once across all cases. Default 5. */
  concurrency?: number
  /** Run only one split. Default "all". */
  split?: Split | 'all'
  /** Keep only matching cases. */
  filter?: (testCase: Case) => boolean
  /** Judge model when the eval doesn't set one. */
  judgeModel?: JudgeModel
  /** Defaults applied when the eval doesn't set them. */
  defaults?: { timeoutMs?: number; maxBroken?: number; trials?: number }
  /** Resolves a `cases` file path. Default: current directory. */
  baseDir?: string
  /** Called after each trial, for progress output. */
  onTrial?: (event: { variant?: string; caseId: string; trial: TrialRecord }) => void
}

class TrialTimeout extends Error {}

/** Run an eval and return one run record per variant (one when the eval has a single task). */
export async function runEval(def: EvalDefinition, opts: RunOptions = {}): Promise<RunRecord[]> {
  const allCases = await loadCases(def.cases, opts.baseDir)
  const trials = opts.trials ?? def.trials ?? opts.defaults?.trials ?? 1
  const timeoutMs = def.timeoutMs ?? opts.defaults?.timeoutMs ?? 60_000
  const maxBroken = def.maxBroken ?? opts.defaults?.maxBroken ?? 0.05
  const judgeModel = def.judgeModel ?? opts.judgeModel
  const which = opts.split ?? 'all'

  const cases = allCases
    .map((c) => ({ c, split: splitOf(c.id, def.holdout) }))
    .filter(({ c, split }) => (which === 'all' || split === which) && (!opts.filter || opts.filter(c)))

  const variants: [string | undefined, Task][] = def.variants
    ? Object.entries(def.variants)
    : [[undefined, def.task as Task]]

  const startedAt = new Date().toISOString()
  const t0 = Date.now()

  const records = variants.map(([variant]) => ({
    variant,
    cases: cases.map(
      ({ c, split }): CaseRecord => ({ id: c.id, split, tags: c.tags, input: c.input, expected: c.expected, trials: [] }),
    ),
  }))

  const jobs: (() => Promise<void>)[] = []
  variants.forEach(([variant, task], vi) => {
    cases.forEach(({ c }, ci) => {
      for (let t = 0; t < trials; t++) {
        jobs.push(async () => {
          const trial = await runTrial(task, def.graders, c, t, timeoutMs, { judgeModel })
          records[vi].cases[ci].trials.push(trial)
          opts.onTrial?.({ variant, caseId: c.id, trial })
        })
      }
    })
  })
  await pool(jobs, opts.concurrency ?? 5)

  const durationMs = Date.now() - t0
  return records.map(({ variant, cases }) => ({
    version: 1,
    eval: def.name,
    variant,
    label: opts.label,
    startedAt,
    durationMs,
    options: { trials, gate: def.gate ?? false, timeoutMs, maxBroken, holdout: def.holdout, minScore: def.minScore },
    cases: cases.map((c) => ({ ...c, trials: c.trials.sort((a, b) => a.trial - b.trial) })),
  }))
}

async function runTrial(
  task: Task,
  graders: readonly Grader[],
  c: Case,
  trial: number,
  timeoutMs: number,
  ctx: GradeContext,
): Promise<TrialRecord> {
  const t0 = Date.now()
  const done = (r: Omit<TrialRecord, 'trial' | 'durationMs'>): TrialRecord => ({ trial, durationMs: Date.now() - t0, ...r })

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let raw: unknown
  try {
    raw = await Promise.race([
      Promise.resolve().then(() => task(c.input, { signal: controller.signal, trial, caseId: c.id })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new TrialTimeout(`timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  } catch (err) {
    if (err instanceof ModelFailure) {
      return done({ status: 'fail', verdicts: [{ grader: 'task', kind: 'code', pass: false, reason: err.message }] })
    }
    const reason: BrokenReason = err instanceof TrialTimeout ? 'timed out' : 'error'
    return done({ status: 'broken', broken: reason, error: message(err), verdicts: [] })
  } finally {
    clearTimeout(timer)
  }

  const output = normalizeOutput(raw)
  if (wasCutOff(output)) {
    return done({ status: 'broken', broken: 'cut off', error: 'the reply hit the output limit', output, verdicts: [] })
  }
  return gradeOutput(output, graders, c, ctx, done)
}

/** Grade an already-produced output. Shared by live runs and regrading. */
export async function gradeOutput(
  output: unknown,
  graders: readonly Grader[],
  c: Case,
  ctx: GradeContext,
  done: (r: Omit<TrialRecord, 'trial' | 'durationMs'>) => TrialRecord,
): Promise<TrialRecord> {
  const verdicts: GraderOutcome[] = []
  for (const g of graders) {
    try {
      const v = await g.grade(output as never, c as never, ctx)
      verdicts.push(typeof v === 'boolean' ? { grader: g.name, kind: g.kind, pass: v } : { grader: g.name, kind: g.kind, ...v })
    } catch (err) {
      return done({ status: 'broken', broken: 'grader error', error: `${g.name}: ${message(err)}`, output, verdicts })
    }
  }
  return done({ status: verdicts.every((v) => v.pass) ? 'pass' : 'fail', output, verdicts })
}

async function pool(jobs: (() => Promise<void>)[], concurrency: number): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, jobs.length)) }, async () => {
    while (next < jobs.length) await jobs[next++]()
  })
  await Promise.all(workers)
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
