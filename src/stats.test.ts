import { describe, expect, it } from 'vitest'
import { luckCheck, majority, scoreRange } from './stats.js'

describe('luckCheck', () => {
  it('matches the exact coin-toss odds', () => {
    expect(luckCheck(7, 2).chance).toBeCloseTo(184 / 1024, 6) // 0.2+1.8+7.0 on each side = 18%
    expect(luckCheck(7, 2).probablyReal).toBe(false)
    expect(luckCheck(10, 2).chance).toBeCloseTo(0.0386, 3)
    expect(luckCheck(10, 2).probablyReal).toBe(true)
    expect(luckCheck(5, 0).chance).toBeCloseTo(2 / 32, 6)
    expect(luckCheck(5, 9).chance).toBeCloseTo(0.424, 3)
  })

  it('reports the gap as B minus A', () => {
    expect(luckCheck(7, 2).gap).toBe(-5)
    expect(luckCheck(2, 7).gap).toBe(5)
  })

  it('treats no disagreements as no evidence', () => {
    expect(luckCheck(0, 0)).toMatchObject({ chance: 1, probablyReal: false, disagreements: 0 })
  })

  it('stays finite for large counts', () => {
    const r = luckCheck(300, 200)
    expect(Number.isFinite(r.chance)).toBe(true)
    expect(r.probablyReal).toBe(true)
  })
})

describe('scoreRange', () => {
  it('averages per-case pass rates and counts each case once', () => {
    const r = scoreRange([1, 1, 0, 0.5])!
    expect(r.score).toBeCloseTo(0.625)
    expect(r.low).toBeLessThan(r.score)
    expect(r.high).toBeGreaterThan(r.score)
  })

  it('reproduces the give-or-take for 80 cases at 86%', () => {
    const rates = [...Array(69).fill(1), ...Array(11).fill(0)]
    const r = scoreRange(rates)!
    expect(((r.high - r.low) / 2) * 100).toBeCloseTo(7.6, 0)
  })

  it('handles tiny inputs', () => {
    expect(scoreRange([])).toBeUndefined()
    expect(scoreRange([1])).toEqual({ score: 1, low: 1, high: 1 })
  })
})

describe('majority', () => {
  it('uses the majority result and leaves ties out', () => {
    expect(majority(2 / 3)).toBe(true)
    expect(majority(1 / 3)).toBe(false)
    expect(majority(0.5)).toBeUndefined()
    expect(majority(undefined)).toBeUndefined()
  })
})
