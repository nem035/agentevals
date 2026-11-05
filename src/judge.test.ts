import { describe, expect, it } from 'vitest'
import { judge } from './judge.js'

const c = { id: 'x', input: 'help me', expected: undefined }

describe('judge', () => {
  it('passes with a quote that is really in the output', async () => {
    const g = judge('Does it name the mistake? Quote it.', {
      model: async () => '{"evidence": ["you typed 13 as the month"], "pass": true, "reason": "names it"}',
    })
    expect(await g.grade('Looks like you typed 13 as the month.', c, {})).toMatchObject({ pass: true })
  })

  it('fails a pass that quotes nothing', async () => {
    const g = judge('Q', { model: async () => '{"evidence": [], "pass": true}' })
    expect(await g.grade('anything', c, {})).toMatchObject({ pass: false, reason: /without quoting/ })
  })

  it('treats an invented quote as a broken grader, not a model failure', async () => {
    const g = judge('Q', { model: async () => '{"evidence": ["not there"], "pass": false}' })
    await expect(g.grade('the actual output', c, {})).rejects.toThrow(/not in the output/)
  })

  it('needs a judge model', async () => {
    await expect(judge('Q').grade('x', c, {})).rejects.toThrow(/No judge model/)
  })

  it('uses the judge model from context', async () => {
    const g = judge('Q', { requireQuote: false })
    expect(await g.grade('x', c, { judgeModel: async () => 'Sure: {"pass": false, "evidence": []}' })).toMatchObject({ pass: false })
  })
})
