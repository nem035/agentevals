import type { BrokenReason, CaseRecord, CaseSummary, RunRecord, RunSummary, ScoreSummary } from './types.js'
import { scoreRange } from './stats.js'

export function summarizeCase(c: CaseRecord): CaseSummary {
  const ran = c.trials.filter((t) => t.status !== 'broken').length
  const passed = c.trials.filter((t) => t.status === 'pass').length
  return { id: c.id, split: c.split, ran, passed, broken: c.trials.length - ran, passRate: ran ? passed / ran : undefined }
}

export function scoreOf(cases: readonly CaseSummary[]): ScoreSummary {
  const measured = cases.filter((c) => c.passRate !== undefined)
  const range = scoreRange(measured.map((c) => c.passRate as number))
  return {
    cases: measured.length,
    score: range?.score,
    low: range?.low,
    high: range?.high,
    flaky: measured.filter((c) => (c.passRate as number) > 0 && (c.passRate as number) < 1).map((c) => c.id),
  }
}

/** Scores, broken counts and anything that should fail the run. */
export function summarize(run: RunRecord): RunSummary {
  const cases = run.cases.map(summarizeCase)
  const trials = run.cases.flatMap((c) => c.trials)
  const byReason: Partial<Record<BrokenReason, number>> = {}
  for (const t of trials) if (t.broken) byReason[t.broken] = (byReason[t.broken] ?? 0) + 1
  const broken = trials.filter((t) => t.status === 'broken').length

  const all = scoreOf(cases)
  const hasHoldout = run.cases.some((c) => c.split === 'test') && run.cases.some((c) => c.split === 'train')
  const train = hasHoldout ? scoreOf(cases.filter((c) => c.split === 'train')) : undefined
  const test = hasHoldout ? scoreOf(cases.filter((c) => c.split === 'test')) : undefined

  const problems: string[] = []
  if (trials.length && broken / trials.length > run.options.maxBroken) {
    problems.push(
      `${broken} of ${trials.length} trials broke (limit ${Math.round(run.options.maxBroken * 100)}%). Fix the cause and rerun before comparing scores.`,
    )
  }
  if (run.options.gate) {
    const failing = cases.filter((c) => c.passRate !== undefined && c.passRate < 1)
    if (failing.length) problems.push(`Gate: ${failing.length} case${failing.length === 1 ? '' : 's'} did not pass every trial`)
  }
  if (run.options.minScore !== undefined && all.score !== undefined && all.score < run.options.minScore) {
    problems.push(`Score ${pct(all.score)} is below the minimum ${pct(run.options.minScore)}`)
  }

  return {
    eval: run.eval,
    variant: run.variant,
    trials: {
      total: trials.length,
      passed: trials.filter((t) => t.status === 'pass').length,
      failed: trials.filter((t) => t.status === 'fail').length,
      broken,
      byReason,
    },
    all,
    train,
    test,
    problems,
    ok: problems.length === 0,
  }
}

const pct = (x: number) => `${Math.round(x * 100)}%`
