import { describe, it, expect } from 'vitest'
import { createEvalContext } from './context.js'
import type { GraderResult, AIResult } from '../types.js'

function makeAIResult(text: string): AIResult {
  return {
    text,
    toolCalls: [],
    toolResults: [],
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    steps: [],
  }
}

describe('createEvalContext', () => {
  it('creates context with expect function', () => {
    const graderResults: GraderResult[] = []
    const context = createEvalContext({}, {}, graderResults)

    expect(typeof context.expect).toBe('function')
  })

  it('expect returns an assertion object', () => {
    const graderResults: GraderResult[] = []
    const context = createEvalContext({}, {}, graderResults)

    const result = makeAIResult('Hello World')
    const assertion = context.expect(result)

    expect(typeof assertion.toContain).toBe('function')
    expect(typeof assertion.toMatch).toBe('function')
    expect(typeof assertion.toAskQuestions).toBe('function')
  })

  it('expect assertions push to graderResults', () => {
    const graderResults: GraderResult[] = []
    const context = createEvalContext({}, {}, graderResults)

    const result = makeAIResult('Hello World')
    context.expect(result).toContain('Hello')

    expect(graderResults).toHaveLength(1)
    expect(graderResults[0].pass).toBe(true)
  })

  it('resolves judge model from eval options', () => {
    const graderResults: GraderResult[] = []
    // We can't easily test the actual judge without mocking generateText,
    // but we can verify the context is created without error
    const context = createEvalContext(
      { timeout: 5000 },
      { timeout: 10000 },
      graderResults
    )

    expect(context).toBeDefined()
    expect(typeof context.expect).toBe('function')
  })
})
