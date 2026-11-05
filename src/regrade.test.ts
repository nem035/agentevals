import { describe, expect, it } from 'vitest'
import { defineEval } from './define.js'
import { grader } from './graders.js'
import { judge } from './judge.js'
import { checkJudge, regradeRun } from './regrade.js'
import { runEval } from './run.js'
import { summarize } from './summary.js'

describe('regradeRun', () => {
  it('reruns only the graders on saved outputs', async () => {
    let calls = 0
    const strict = defineEval({
      name: 'dates',
      cases: [{ id: 'a', input: null, expected: 'Nov 3' }],
      task: () => {
        calls++
        return 'November 3'
      },
      graders: [grader('sameText', (out: string, c) => out === c.expected)],
    })
    const [run] = await runEval(strict)
    expect(summarize(run).all.score).toBe(0)
    const fixed = { ...strict, graders: [grader('sameDay', (out: string) => out.startsWith('Nov'))] }
    const regraded = await regradeRun(run, fixed)
    expect(summarize(regraded).all.score).toBe(1)
    expect(calls).toBe(1)
    expect(regraded.label).toBe('run+regraded')
  })
})

describe('checkJudge', () => {
  it('lists verdicts that change on identical input', async () => {
    let n = 0
    const coinFlipJudge = async () => `{"evidence": [], "pass": ${n++ % 2 === 0}}`
    const def = defineEval({
      name: 'judged',
      cases: [{ id: 'a', input: null }],
      task: () => 'output',
      graders: [judge('Is it good?', { requireQuote: false })],
      judgeModel: coinFlipJudge,
    })
    const [run] = await runEval(def)
    const result = await checkJudge(run, def)
    expect(result.checked).toBe(1)
    expect(result.flips).toHaveLength(1)
  })
})
