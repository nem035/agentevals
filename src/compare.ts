import type { RunRecord, Split } from './types.js'
import { luckCheck, majority, type LuckCheck } from './stats.js'
import { summarizeCase } from './summary.js'

export interface Comparison extends LuckCheck {
  /** Case ids only run A passed (by each case's majority across trials). */
  onlyAIds: string[]
  onlyBIds: string[]
  bothPassed: number
  bothFailed: number
  /** Cases left out: broken in either run, a tied majority, or missing from one run. */
  skipped: number
}

export interface RunComparison {
  a: { eval: string; variant?: string; label?: string; startedAt: string }
  b: { eval: string; variant?: string; label?: string; startedAt: string }
  all: Comparison
  train?: Comparison
  test?: Comparison
}

/**
 * Compare two runs case by case. Cases both runs agree on can't explain the
 * difference between their totals; only the disagreements can, and the luck
 * check says whether their split is more lopsided than chance.
 */
export function compareRuns(a: RunRecord, b: RunRecord, cutoff = 0.05): RunComparison {
  const both = (split: Split) => a.cases.some((c) => c.split === split) && b.cases.some((c) => c.split === split)
  const hasHoldout = both('train') && both('test')
  const meta = (r: RunRecord) => ({ eval: r.eval, variant: r.variant, label: r.label, startedAt: r.startedAt })
  return {
    a: meta(a),
    b: meta(b),
    all: compareSplit(a, b, undefined, cutoff),
    train: hasHoldout ? compareSplit(a, b, 'train', cutoff) : undefined,
    test: hasHoldout ? compareSplit(a, b, 'test', cutoff) : undefined,
  }
}

function compareSplit(a: RunRecord, b: RunRecord, split: Split | undefined, cutoff: number): Comparison {
  const inSplit = (r: RunRecord) => r.cases.filter((c) => !split || c.split === split)
  const resultA = new Map(inSplit(a).map((c) => [c.id, majority(summarizeCase(c).passRate)]))
  const casesB = inSplit(b)
  const onlyAIds: string[] = []
  const onlyBIds: string[] = []
  let bothPassed = 0
  let bothFailed = 0
  let skipped = 0
  const seen = new Set<string>()
  for (const c of casesB) {
    seen.add(c.id)
    const pa = resultA.get(c.id)
    const pb = majority(summarizeCase(c).passRate)
    if (pa === undefined || pb === undefined) skipped++
    else if (pa && pb) bothPassed++
    else if (!pa && !pb) bothFailed++
    else if (pa) onlyAIds.push(c.id)
    else onlyBIds.push(c.id)
  }
  for (const id of resultA.keys()) if (!seen.has(id)) skipped++
  return { ...luckCheck(onlyAIds.length, onlyBIds.length, cutoff), onlyAIds, onlyBIds, bothPassed, bothFailed, skipped }
}
