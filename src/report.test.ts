import { describe, expect, it } from 'vitest'
import { defineEval } from './define.js'
import { grader } from './graders.js'
import { formatRun } from './report.js'
import { runEval } from './run.js'
import { summarize } from './summary.js'

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')

describe('formatRun', () => {
  it('shows the range, groups failures by case, and hides test cases', async () => {
    const cases = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, input: i, expected: 'even' }))
    const def = defineEval({
      name: 'parity',
      cases,
      task: (i: number) => (i % 2 ? 'odd' : 'even'),
      graders: [grader('isEven', (o: string, c) => o === c.expected)],
      trials: 2,
      holdout: 0.3,
    })
    const [run] = await runEval(def)
    const text = plain(formatRun(run, summarize(run)))
    expect(text).toMatch(/Score\s+50%\s+give or take \d+ points\s+over 30 cases/)
    expect(text).toMatch(/✕ c1 \(2 of 2\)\s+isEven\s+got "odd", expected "even"/)
    const testFailing = run.cases.filter((c) => c.split === 'test' && c.trials.some((t) => t.status === 'fail'))
    for (const c of testFailing) expect(text).not.toMatch(new RegExp(`✕ ${c.id} `))
    expect(text).toMatch(/test cases? failed\. Test cases are not shown/)
  })
})
