import { describe, it, expect } from 'vitest'
import { configSchema } from './schema.js'

describe('configSchema', () => {
  it('accepts empty config', () => {
    const result = configSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts valid full config', () => {
    const config = {
      include: ['**/*.eval.ts'],
      exclude: ['node_modules/**'],
      trials: 3,
      timeout: 30000,
      parallel: true,
      maxConcurrency: 10,
      reporters: ['console', 'json'],
      maxCost: 5.0,
    }

    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('rejects negative trials', () => {
    const config = {
      trials: -1,
    }

    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects invalid reporter', () => {
    const config = {
      reporters: ['invalid'],
    }

    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects zero maxConcurrency', () => {
    const config = {
      maxConcurrency: 0,
    }

    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })
})
