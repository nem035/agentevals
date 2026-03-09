import { describe, it, expect, vi } from 'vitest'
import { runEvals } from './runner.js'
import type { EvalTask, EvalGroup, EvaliteConfig, AIResult } from '../types.js'

function makeAIResult(text: string = 'Mock response'): AIResult {
  return {
    text,
    toolCalls: [],
    toolResults: [],
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    totalUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    steps: [],
  }
}

function createMockConfig(overrides: Partial<EvaliteConfig> = {}): EvaliteConfig {
  return {
    trials: 1,
    parallel: false,
    timeout: 5000,
    ...overrides,
  }
}

describe('runEvals', () => {
  it('runs a simple passing eval', async () => {
    const tasks: EvalTask[] = [
      {
        name: 'passing-task',
        fn: async ({ expect }) => {
          const result = makeAIResult('Mock response')
          expect(result).toContain('Mock')
        },
        options: {},
      },
    ]

    const result = await runEvals([], tasks, {
      config: createMockConfig(),
    })

    expect(result.success).toBe(true)
    expect(result.summary.total).toBe(1)
    expect(result.summary.passed).toBe(1)
    expect(result.summary.failed).toBe(0)
  })

  it('runs a failing eval', async () => {
    const tasks: EvalTask[] = [
      {
        name: 'failing-task',
        fn: async ({ expect }) => {
          const result = makeAIResult('Mock response')
          expect(result).toContain('nonexistent text')
        },
        options: {},
      },
    ]

    const result = await runEvals([], tasks, {
      config: createMockConfig(),
    })

    expect(result.success).toBe(false)
    expect(result.summary.failed).toBe(1)
  })

  it('handles task errors', async () => {
    const tasks: EvalTask[] = [
      {
        name: 'error-task',
        fn: async () => {
          throw new Error('Unexpected error')
        },
        options: {},
      },
    ]

    const result = await runEvals([], tasks, {
      config: createMockConfig(),
    })

    expect(result.success).toBe(false)
    expect(result.ungrouped[0].status).toBe('error')
  })

  it('runs multiple trials', async () => {
    let callCount = 0
    const tasks: EvalTask[] = [
      {
        name: 'multi-trial-task',
        fn: async ({ expect }) => {
          callCount++
          const result = makeAIResult('Mock response')
          expect(result).toContain('Mock')
        },
        options: {},
      },
    ]

    const result = await runEvals([], tasks, {
      config: createMockConfig({ trials: 3 }),
    })

    expect(callCount).toBe(3)
    expect(result.ungrouped[0].trials).toHaveLength(3)
  })

  it('runs grouped tasks', async () => {
    const groups: EvalGroup[] = [
      {
        name: 'test-group',
        options: {},
        tasks: [
          {
            name: 'task-1',
            fn: async ({ expect }) => {
              const result = makeAIResult('Hello')
              expect(result).toContain('Hello')
            },
            options: {},
            group: 'test-group',
          },
          {
            name: 'task-2',
            fn: async ({ expect }) => {
              const result = makeAIResult('World')
              expect(result).toContain('World')
            },
            options: {},
            group: 'test-group',
          },
        ],
      },
    ]

    const result = await runEvals(groups, [], {
      config: createMockConfig(),
    })

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].tasks).toHaveLength(2)
    expect(result.summary.total).toBe(2)
    expect(result.summary.passed).toBe(2)
  })

  it('calls lifecycle hooks', async () => {
    const onTaskStart = vi.fn()
    const onTaskEnd = vi.fn()

    const tasks: EvalTask[] = [
      {
        name: 'task-1',
        fn: async ({ expect }) => {
          const result = makeAIResult('Mock')
          expect(result).toContain('Mock')
        },
        options: {},
      },
    ]

    await runEvals([], tasks, {
      config: createMockConfig(),
      onTaskStart,
      onTaskEnd,
    })

    expect(onTaskStart).toHaveBeenCalledTimes(1)
    expect(onTaskEnd).toHaveBeenCalledTimes(1)
  })

  it('runs both groups and ungrouped tasks', async () => {
    const groups: EvalGroup[] = [
      {
        name: 'group-1',
        options: {},
        tasks: [
          { name: 'grouped-task', fn: async () => {}, options: {}, group: 'group-1' },
        ],
      },
    ]

    const ungrouped: EvalTask[] = [
      { name: 'standalone-task', fn: async () => {}, options: {} },
    ]

    const result = await runEvals(groups, ungrouped, {
      config: createMockConfig(),
    })

    expect(result.groups).toHaveLength(1)
    expect(result.ungrouped).toHaveLength(1)
    expect(result.summary.total).toBe(2)
  })

  it('aggregates duration correctly', async () => {
    const tasks: EvalTask[] = [
      {
        name: 'slow-task',
        fn: async () => {
          await new Promise((r) => setTimeout(r, 50))
        },
        options: {},
      },
    ]

    const result = await runEvals([], tasks, {
      config: createMockConfig(),
    })

    expect(result.duration).toBeGreaterThanOrEqual(50)
  })
})
