import { describe, expect, it } from 'vitest'
import { splitOf } from './split.js'

describe('splitOf', () => {
  it('is stable for the same id', () => {
    expect(splitOf('case-42', 0.3)).toBe(splitOf('case-42', 0.3))
  })

  it('holds out roughly the requested share', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `case-${i}`)
    const test = ids.filter((id) => splitOf(id, 0.3) === 'test').length
    expect(test / ids.length).toBeGreaterThan(0.26)
    expect(test / ids.length).toBeLessThan(0.34)
  })

  it('puts everything in train without a holdout', () => {
    expect(splitOf('anything', undefined)).toBe('train')
  })
})
