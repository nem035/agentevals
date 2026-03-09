import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createJsonReporter } from './json.js'
import type { RunResult } from '../../types.js'

describe('createJsonReporter', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  function createMockRunResult(overrides: Partial<RunResult> = {}): RunResult {
    return {
      success: true,
      summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
      groups: [
        {
          name: 'test-group',
          duration: 100,
          tasks: [
            {
              name: 'test-task',
              status: 'passed',
              duration: 100,
              trials: [
                {
                  status: 'passed',
                  duration: 100,
                  graderResults: [{ pass: true, reason: 'All good' }],
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  costUsd: 0.01,
                },
              ],
            },
          ],
        },
      ],
      ungrouped: [],
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      costUsd: 0.01,
      duration: 100,
      ...overrides,
    }
  }

  it('outputs valid JSON', () => {
    const reporter = createJsonReporter()
    const result = createMockRunResult()

    reporter.onEnd?.(result)

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const output = consoleSpy.mock.calls[0][0] as string
    expect(() => JSON.parse(output)).not.toThrow()
  })

  it('outputs pretty JSON when configured', () => {
    const reporter = createJsonReporter({ pretty: true })
    const result = createMockRunResult()

    reporter.onEnd?.(result)

    const output = consoleSpy.mock.calls[0][0] as string
    expect(output).toContain('\n')
  })

  it('outputs compact JSON by default', () => {
    const reporter = createJsonReporter()
    const result = createMockRunResult()

    reporter.onEnd?.(result)

    const output = consoleSpy.mock.calls[0][0] as string
    expect(output).not.toContain('\n')
  })

  it('includes all required fields', () => {
    const reporter = createJsonReporter()
    const result = createMockRunResult()

    reporter.onEnd?.(result)

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)

    expect(output).toHaveProperty('success')
    expect(output).toHaveProperty('summary')
    expect(output).toHaveProperty('groups')
    expect(output).toHaveProperty('ungrouped')
    expect(output).toHaveProperty('usage')
    expect(output).toHaveProperty('costUsd')
    expect(output).toHaveProperty('duration')
  })

  it('includes task details', () => {
    const reporter = createJsonReporter()
    const result = createMockRunResult()

    reporter.onEnd?.(result)

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
    const task = output.groups[0].tasks[0]

    expect(task).toHaveProperty('name')
    expect(task).toHaveProperty('status')
    expect(task).toHaveProperty('duration')
    expect(task).toHaveProperty('trials')
  })

  it('includes grader results in trials', () => {
    const reporter = createJsonReporter()
    const result = createMockRunResult()

    reporter.onEnd?.(result)

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
    const trial = output.groups[0].tasks[0].trials[0]

    expect(trial.graders).toHaveLength(1)
    expect(trial.graders[0]).toHaveProperty('pass')
    expect(trial.graders[0]).toHaveProperty('reason')
  })
})
