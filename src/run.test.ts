import { describe, expect, it } from 'vitest'
import { defineEval, fail } from './define.js'
import { grader } from './graders.js'
import { runEval } from './run.js'
import { splitOf } from './split.js'
import { summarize } from './summary.js'

const isYes = grader('isYes', (out: unknown) => out === 'yes')

describe('runEval', () => {
  it('reports a per-case pass rate instead of "any trial passed"', async () => {
    const def = defineEval({
      name: 'flaky',
      cases: [{ id: 'a', input: null }],
      task: (_i, { trial }) => (trial % 2 === 0 ? 'yes' : 'no'),
      graders: [isYes],
      trials: 4,
    })
    const [run] = await runEval(def)
    const s = summarize(run)
    expect(s.all.score).toBe(0.5)
    expect(s.all.flaky).toEqual(['a'])
    expect(s.trials).toMatchObject({ passed: 2, failed: 2, broken: 0 })
  })

  it('keeps broken trials out of the score and says why they broke', async () => {
    const def = defineEval({
      name: 'broken',
      cases: [
        { id: 'ok', input: 'ok' },
        { id: 'throws', input: 'throws' },
        { id: 'slow', input: 'slow' },
        { id: 'cut', input: 'cut' },
        { id: 'grader-throws', input: 'grader' },
        { id: 'model-fault', input: 'model' },
      ],
      task: async (input: string, { signal }) => {
        if (input === 'throws') throw new Error('missing API key')
        if (input === 'slow') await new Promise((r) => setTimeout(r, 200))
        if (input === 'cut') return { text: 'half an ans', finishReason: 'length', toolCalls: [] }
        if (input === 'model') throw fail('model returned invalid JSON')
        if (signal.aborted) return 'late'
        return input === 'grader' ? 'boom' : 'yes'
      },
      graders: [
        grader('isYes', (out: unknown) => {
          if (out === 'boom') throw new Error('judge API down')
          return out === 'yes'
        }),
      ],
      timeoutMs: 50,
      maxBroken: 1,
    })
    const [run] = await runEval(def)
    const by = Object.fromEntries(run.cases.map((c) => [c.id, c.trials[0]]))
    expect(by.ok.status).toBe('pass')
    expect(by.throws).toMatchObject({ status: 'broken', broken: 'error', error: 'missing API key' })
    expect(by.slow).toMatchObject({ status: 'broken', broken: 'timed out' })
    expect(by.cut).toMatchObject({ status: 'broken', broken: 'cut off' })
    expect(by['grader-throws']).toMatchObject({ status: 'broken', broken: 'grader error' })
    expect(by['model-fault']).toMatchObject({ status: 'fail' })
    const s = summarize(run)
    expect(s.all.cases).toBe(2) // only "ok" and "model-fault" measured the model
    expect(s.all.score).toBe(0.5)
    expect(s.trials.byReason).toEqual({ error: 1, 'timed out': 1, 'cut off': 1, 'grader error': 1 })
  })

  it('fails the run when too many trials break', async () => {
    const def = defineEval({
      name: 'mostly broken',
      cases: [
        { id: 'a', input: 1 },
        { id: 'b', input: 2 },
      ],
      task: (i: number) => {
        if (i === 2) throw new Error('rate limited')
        return 'yes'
      },
      graders: [isYes],
    })
    const s = summarize((await runEval(def))[0])
    expect(s.ok).toBe(false)
    expect(s.problems[0]).toMatch(/1 of 2 trials broke/)
  })

  it('runs each variant on the same cases', async () => {
    const def = defineEval({
      name: 'variants',
      cases: [
        { id: 'a', input: 'yes' },
        { id: 'b', input: 'no' },
      ],
      variants: { old: () => 'no', new: (i: string) => i },
      graders: [isYes],
    })
    const runs = await runEval(def)
    expect(runs.map((r) => r.variant)).toEqual(['old', 'new'])
    expect(runs.map((r) => summarize(r).all.score)).toEqual([0, 0.5])
  })

  it('splits cases by a stable hash and can run one split', async () => {
    const cases = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, input: 'yes' }))
    const def = defineEval({ name: 'holdout', cases, task: (i: string) => i, graders: [isYes], holdout: 0.3 })
    const [all] = await runEval(def)
    for (const c of all.cases) expect(c.split).toBe(splitOf(c.id, 0.3))
    const [trainOnly] = await runEval(def, { split: 'train' })
    expect(trainOnly.cases.every((c) => c.split === 'train')).toBe(true)
    expect(summarize(all).test).toBeDefined()
  })

  it('flags gate failures', async () => {
    const def = defineEval({
      name: 'gate',
      cases: [{ id: 'a', input: null }],
      task: (_i, { trial }) => (trial === 0 ? 'yes' : 'no'),
      graders: [isYes],
      trials: 2,
      gate: true,
    })
    const s = summarize((await runEval(def))[0])
    expect(s.ok).toBe(false)
    expect(s.problems[0]).toMatch(/Gate/)
  })
})
