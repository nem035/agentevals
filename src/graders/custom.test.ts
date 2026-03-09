import { describe, it, expect } from 'vitest'
import { defineGrader } from './custom.js'
import type { AIResult, GraderResult } from '../types.js'

describe('defineGrader', () => {
  it('creates a grader function', () => {
    const grader = defineGrader('myGrader', () => ({
      pass: true,
      reason: 'All good',
    }))

    expect(typeof grader).toBe('function')
  })

  it('grader returns correct result', async () => {
    const containsHello = defineGrader('containsHello', (result) => {
      const hasHello = result.text.toLowerCase().includes('hello')
      return {
        pass: hasHello,
        reason: hasHello ? 'Contains hello' : 'Missing hello',
      }
    })

    const passingResult: AIResult = {
      text: 'Hello world!',
      toolCalls: [],
      toolResults: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      steps: [],
    }

    const failingResult: AIResult = {
      text: 'Goodbye world!',
      toolCalls: [],
      toolResults: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      steps: [],
    }

    const passResult = await containsHello(passingResult) as GraderResult
    const failResult = await containsHello(failingResult) as GraderResult

    expect(passResult.pass).toBe(true)
    expect(failResult.pass).toBe(false)
  })

  it('grader can return score', async () => {
    const scoreGrader = defineGrader('scoreGrader', () => ({
      pass: true,
      reason: 'Scored',
      score: 0.85,
    }))

    const result: AIResult = {
      text: 'test',
      toolCalls: [],
      toolResults: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      steps: [],
    }

    const graderResult = await scoreGrader(result) as GraderResult
    expect(graderResult.score).toBe(0.85)
  })

  it('supports async graders', async () => {
    const asyncGrader = defineGrader('asyncGrader', async (result) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return {
        pass: result.text.length > 0,
        reason: 'Async check complete',
      }
    })

    const result: AIResult = {
      text: 'test',
      toolCalls: [],
      toolResults: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      steps: [],
    }

    const graderResult = await asyncGrader(result)
    expect(graderResult.pass).toBe(true)
  })
})
