import pc from 'picocolors'
import type { BrokenReason, RunRecord, RunSummary, ScoreSummary, TrialRecord } from './types.js'
import type { Comparison, RunComparison } from './compare.js'
import type { JudgeFlip } from './regrade.js'

const pct = (x: number | undefined) => (x === undefined ? '-' : `${Math.round(x * 100)}%`)
const pts = (s: ScoreSummary) =>
  s.score === undefined || s.low === undefined || s.high === undefined
    ? ''
    : s.cases < 2
      ? pc.dim('(one case is too few for a range)')
      : `give or take ${Math.round(((s.high - s.low) / 2) * 100)} points`
const short = (v: unknown, max = 60) => {
  const text = JSON.stringify(v) ?? String(v)
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const runName = (r: { eval: string; variant?: string; label?: string }) =>
  [r.eval, r.variant && `[${r.variant}]`, r.label && `(${r.label})`].filter(Boolean).join(' ')

function scoreLine(s: ScoreSummary): string {
  if (s.score === undefined) return 'no case measured the model'
  return `${pc.bold(pct(s.score))}  ${pts(s)}  ${pc.dim(`over ${plural(s.cases, 'case')}`)}`
}

/** A run's report: score with its range, broken trials, flaky cases, train/test, failures. */
export function formatRun(run: RunRecord, summary: RunSummary, opts: { maxFailures?: number } = {}): string {
  const out: string[] = ['', ` ${pc.bold(runName(run))}`]
  const row = (label: string, text: string) => out.push(`   ${pc.dim(label.padEnd(9))}${text}`)

  if (run.options.gate) {
    const failing = run.cases.filter((c) => c.trials.some((t) => t.status === 'fail'))
    row('Gate', failing.length ? pc.red(`${plural(failing.length, 'case')} failed`) : pc.green('every case passed every trial'))
  } else {
    row('Score', scoreLine(summary.all))
  }

  const t = summary.trials
  if (t.broken) {
    const reasons = (Object.entries(t.byReason) as [BrokenReason, number][]).map(([r, n]) => `${n} ${r}`).join(', ')
    row('Broken', `${pc.yellow(`${plural(t.broken, 'trial')} not scored`)}: ${reasons}`)
  } else {
    row('Broken', pc.dim('none'))
  }

  if (summary.all.flaky.length) {
    const ids = summary.all.flaky.slice(0, 5).join(', ') + (summary.all.flaky.length > 5 ? ', ...' : '')
    row('Flaky', `${plural(summary.all.flaky.length, 'case')} passed some trials and failed others: ${ids}`)
  }

  if (summary.train && summary.test) {
    row('Train', scoreLine(summary.train))
    row('Test', scoreLine(summary.test))
  }

  // One line per failing case: how many trials failed, and why (distinct reasons).
  const failing = run.cases
    .filter((c) => c.split === 'train')
    .map((c) => ({ c, failed: c.trials.filter((tr) => tr.status === 'fail') }))
    .filter((f) => f.failed.length)
  const hiddenTest = run.cases.filter((c) => c.split === 'test' && c.trials.some((tr) => tr.status === 'fail')).length
  if (failing.length || hiddenTest) {
    out.push(`   ${pc.dim('Failures')}`)
    const max = opts.maxFailures ?? 10
    for (const { c, failed } of failing.slice(0, max)) {
      const reasons = [...new Set(failed.map((tr) => whyFailed(tr, c.expected)))]
      const ran = c.trials.filter((tr) => tr.status !== 'broken').length
      const count = ran > 1 ? pc.dim(` (${failed.length} of ${ran})`) : ''
      out.push(`     ${pc.red('✕')} ${c.id}${count}  ${pc.dim(reasons.slice(0, 2).join(' | ') + (reasons.length > 2 ? ' | ...' : ''))}`)
    }
    if (failing.length > max) out.push(pc.dim(`     ...and ${failing.length - max} more cases`))
    if (hiddenTest) out.push(pc.dim(`     ${plural(hiddenTest, 'test case')} failed. Test cases are not shown, so they stay unread.`))
  }

  for (const p of summary.problems) out.push(`   ${pc.red('✕')} ${p}`)
  return out.join('\n')
}

function comparisonLines(c: Comparison, aName: string, bName: string): string[] {
  const lines = [
    `   Only ${aName} passed ${pc.bold(String(c.onlyA))}   only ${bName} passed ${pc.bold(String(c.onlyB))}   ${pc.dim(
      `(both passed ${c.bothPassed}, both failed ${c.bothFailed}${c.skipped ? `, ${c.skipped} skipped` : ''})`,
    )}`,
  ]
  if (c.disagreements === 0) {
    lines.push('   The runs agree on every case.')
    return lines
  }
  const gap = c.gap > 0 ? `+${c.gap}` : String(c.gap)
  lines.push(
    `   Gap ${gap} from ${plural(c.disagreements, 'disagreement')}. Chance alone gives a gap this big ${pct(c.chance)} of the time.`,
    c.probablyReal
      ? `   ${pc.green('Probably a real difference.')}`
      : `   ${pc.yellow('Could easily be luck.')} Run more trials or add cases before believing it.`,
  )
  return lines
}

function whyFailed(tr: TrialRecord, expected: unknown): string {
  const failed = tr.verdicts.filter((v) => !v.pass)
  let why = failed.map((v) => `${v.grader}${v.reason ? `: ${v.reason}` : ''}`).join('; ')
  // A bare boolean grader says nothing about why, so show what came back.
  if (failed.every((v) => !v.reason) && tr.output !== undefined) {
    why += `  got ${short(tr.output)}${expected !== undefined ? `, expected ${short(expected)}` : ''}`
  }
  return why
}

/** Case-by-case comparison of two runs with the luck check. */
export function formatComparison(cmp: RunComparison): string {
  const out = ['', ` ${pc.bold('Compare')}`, `   A  ${runName(cmp.a)}  ${pc.dim(cmp.a.startedAt)}`, `   B  ${runName(cmp.b)}  ${pc.dim(cmp.b.startedAt)}`, '']
  out.push(...comparisonLines(cmp.all, 'A', 'B'))
  if (cmp.train && cmp.test) {
    const oneLine = (label: string, c: Comparison) =>
      `   ${pc.dim(label.padEnd(6))}only A ${c.onlyA}, only B ${c.onlyB}` +
      (c.disagreements ? pc.dim(`  chance ${pct(c.chance)}`) : '')
    out.push('', oneLine('Train', cmp.train), oneLine('Test', cmp.test))
  }
  // Name the cases that changed, so you can read them. Test cases stay unnamed.
  const visible = cmp.train ?? cmp.all
  const named = (ids: string[], who: string) =>
    ids.length ? [`   ${pc.dim(`Only ${who} passed`)} ${ids.slice(0, 8).join(', ')}${ids.length > 8 ? `, ...${ids.length - 8} more` : ''}`] : []
  const changed = [...named(visible.onlyAIds, 'A'), ...named(visible.onlyBIds, 'B')]
  if (changed.length) out.push('', ...changed)
  return out.join('\n')
}

export function formatJudgeCheck(result: { checked: number; flips: JudgeFlip[] }): string {
  const out = ['', ` ${pc.bold('Judge consistency')}`, `   ${result.checked} verdicts regraded`]
  if (!result.flips.length) {
    out.push(`   ${pc.green('No verdict changed.')} ${pc.dim('Stable is not the same as right: read a sample of verdicts too.')}`)
    return out.join('\n')
  }
  out.push(`   ${pc.yellow(`${plural(result.flips.length, 'verdict')} changed on identical input:`)}`)
  for (const f of result.flips.slice(0, 20)) {
    out.push(`     ${f.caseId} trial ${f.trial + 1}  ${pc.dim(f.grader)}  ${f.verdicts.map((v) => (v === 'error' ? 'error' : v ? 'pass' : 'fail')).join(' / ')}`)
  }
  out.push(pc.dim('   Each flip points at a line in the judge instructions that two readers could read differently.'))
  return out.join('\n')
}
