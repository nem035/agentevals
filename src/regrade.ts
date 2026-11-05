import type { EvalDefinition, JudgeModel, RunRecord, TrialRecord } from './types.js'
import { gradeOutput } from './run.js'

/**
 * Rerun only the graders on a saved run's outputs. On identical outputs only
 * the grader can change, so this is how you test a grader change, and how you
 * keep old and new numbers comparable after editing a rubric.
 */
export async function regradeRun(run: RunRecord, def: EvalDefinition, judgeModel?: JudgeModel): Promise<RunRecord> {
  const ctx = { judgeModel: def.judgeModel ?? judgeModel }
  const cases = []
  for (const c of run.cases) {
    const trials: TrialRecord[] = []
    for (const t of c.trials) {
      // Trials that broke before producing an output stay broken.
      if (t.output === undefined || (t.status === 'broken' && t.broken !== 'grader error')) {
        trials.push(t)
        continue
      }
      const done = (r: Omit<TrialRecord, 'trial' | 'durationMs'>): TrialRecord => ({ trial: t.trial, durationMs: t.durationMs, ...r })
      trials.push(await gradeOutput(t.output, def.graders, { id: c.id, input: c.input, expected: c.expected, tags: c.tags }, ctx, done))
    }
    cases.push({ ...c, trials })
  }
  return { ...run, label: `${run.label ?? 'run'}+regraded`, startedAt: new Date().toISOString(), cases }
}

export interface JudgeFlip {
  caseId: string
  trial: number
  grader: string
  /** Each attempt's verdict, or "error" when the judge call failed. */
  verdicts: (boolean | 'error')[]
}

/**
 * Grade every saved output again with each judge grader, `times` times, and
 * list the verdicts that changed on identical input. A flip points at a line
 * in the judge's instructions that two readers could interpret differently.
 * Passing this only shows the judge is stable, not that it is right.
 */
export async function checkJudge(
  run: RunRecord,
  def: EvalDefinition,
  opts: { judgeModel?: JudgeModel; times?: number } = {},
): Promise<{ checked: number; flips: JudgeFlip[] }> {
  const judges = def.graders.filter((g) => g.kind === 'judge')
  const ctx = { judgeModel: def.judgeModel ?? opts.judgeModel }
  const times = opts.times ?? 2
  const flips: JudgeFlip[] = []
  let checked = 0
  for (const c of run.cases) {
    const testCase = { id: c.id, input: c.input, expected: c.expected, tags: c.tags }
    for (const t of c.trials) {
      if (t.status === 'broken' || t.output === undefined) continue
      for (const g of judges) {
        const verdicts: (boolean | 'error')[] = []
        for (let i = 0; i < times; i++) {
          try {
            const v = await g.grade(t.output, testCase, ctx)
            verdicts.push(typeof v === 'boolean' ? v : v.pass)
          } catch {
            verdicts.push('error')
          }
        }
        checked++
        if (new Set(verdicts).size > 1) flips.push({ caseId: c.id, trial: t.trial, grader: g.name, verdicts })
      }
    }
  }
  return { checked, flips }
}
