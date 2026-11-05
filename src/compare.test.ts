import { describe, expect, it } from 'vitest'
import { compareRuns } from './compare.js'
import type { RunRecord, TrialStatus } from './types.js'

function run(results: Record<string, TrialStatus[]>): RunRecord {
  return {
    version: 1,
    eval: 'e',
    startedAt: new Date().toISOString(),
    durationMs: 0,
    options: { trials: 3, gate: false, timeoutMs: 1000, maxBroken: 0.05 },
    cases: Object.entries(results).map(([id, statuses]) => ({
      id,
      split: 'train',
      input: null,
      trials: statuses.map((status, trial) => ({ trial, status, verdicts: [], durationMs: 0, broken: status === 'broken' ? 'error' : undefined })),
    })),
  }
}

describe('compareRuns', () => {
  it('counts disagreements by each case majority', () => {
    const a = run({ x: ['pass', 'pass', 'fail'], y: ['fail', 'fail', 'pass'], z: ['pass', 'pass', 'pass'], w: ['broken', 'broken', 'broken'] })
    const b = run({ x: ['fail', 'fail', 'pass'], y: ['pass', 'pass', 'pass'], z: ['pass', 'pass', 'pass'], w: ['pass', 'pass', 'pass'] })
    const cmp = compareRuns(a, b).all
    expect(cmp.onlyAIds).toEqual(['x'])
    expect(cmp.onlyBIds).toEqual(['y'])
    expect(cmp.bothPassed).toBe(1)
    expect(cmp.skipped).toBe(1)
    expect(cmp.chance).toBe(1)
  })
})
