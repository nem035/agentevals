import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defineEval } from './define.js'
import { grader } from './graders.js'
import { runEval } from './run.js'
import { findRun, listRuns, saveRun } from './store.js'

describe('store', () => {
  it('saves runs and finds them by label', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentevals-'))
    const def = defineEval({ name: 'My Eval', cases: [{ id: 'a', input: 1 }], task: () => 'x', graders: [grader('any', () => true)] })
    const [first] = await runEval(def, { label: 'old prompt' })
    await saveRun(first, dir)
    await new Promise((r) => setTimeout(r, 5))
    const [second] = await runEval(def, { label: 'new' })
    const path = await saveRun(second, dir)
    expect(path).toMatch(/my-eval/)
    expect((await listRuns(dir)).map((r) => r.run.label)).toEqual(['old prompt', 'new'])
    expect((await findRun('old prompt', dir)).run.label).toBe('old prompt')
    expect((await findRun(undefined, dir)).run.label).toBe('new')
  })
})
