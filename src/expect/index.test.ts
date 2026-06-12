import { describe, it, expect, beforeEach } from 'vitest'
import { createExpect, ExpectationError } from './index.js'
import type { AIResult, GraderResult } from '../types.js'

function makeAIResult(
  text: string,
  toolCalls: AIResult['toolCalls'] = [],
  toolResults: AIResult['toolResults'] = []
): AIResult {
  return {
    text,
    toolCalls,
    toolResults,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    steps: [],
  }
}

describe('expect', () => {
  let graderResults: GraderResult[]

  beforeEach(() => {
    graderResults = []
  })

  describe('toContain()', () => {
    it('passes when text is found (case insensitive)', () => {
      const result = makeAIResult('Hello World!')
      const e = createExpect(result, graderResults)

      e.toContain('hello')

      expect(graderResults).toHaveLength(1)
      expect(graderResults[0].pass).toBe(true)
    })

    it('passes with case sensitive match', () => {
      const result = makeAIResult('Hello World!')
      const e = createExpect(result, graderResults)

      e.toContain('Hello', { caseSensitive: true })

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when text not found', () => {
      const result = makeAIResult('Hello World!')
      const e = createExpect(result, graderResults)

      expect(() => e.toContain('goodbye')).toThrow(ExpectationError)
      expect(graderResults[0].pass).toBe(false)
    })

    it('fails case sensitive mismatch', () => {
      const result = makeAIResult('Hello World!')
      const e = createExpect(result, graderResults)

      expect(() => e.toContain('hello', { caseSensitive: true })).toThrow(ExpectationError)
    })
  })

  describe('not.toContain()', () => {
    it('passes when text is NOT found', () => {
      const result = makeAIResult('Hello World!')
      const e = createExpect(result, graderResults)

      e.not.toContain('goodbye')

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when text IS found', () => {
      const result = makeAIResult('Hello World!')
      const e = createExpect(result, graderResults)

      expect(() => e.not.toContain('hello')).toThrow(ExpectationError)
    })
  })

  describe('toMatch()', () => {
    it('passes when regex matches', () => {
      const result = makeAIResult('The answer is 42')
      const e = createExpect(result, graderResults)

      e.toMatch(/\d+/)

      expect(graderResults[0].pass).toBe(true)
    })

    it('passes with string pattern', () => {
      const result = makeAIResult('hello@example.com')
      const e = createExpect(result, graderResults)

      e.toMatch('[a-z]+@[a-z]+\\.[a-z]+')

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when regex does not match', () => {
      const result = makeAIResult('no numbers here')
      const e = createExpect(result, graderResults)

      expect(() => e.toMatch(/\d+/)).toThrow(ExpectationError)
    })
  })

  describe('not.toMatch()', () => {
    it('passes when regex does NOT match', () => {
      const result = makeAIResult('no numbers here')
      const e = createExpect(result, graderResults)

      e.not.toMatch(/\d+/)

      expect(graderResults[0].pass).toBe(true)
    })
  })

  describe('toAskQuestions()', () => {
    it('passes when question count is in range', () => {
      const result = makeAIResult('What is your name? How can I help?')
      const e = createExpect(result, graderResults)

      e.toAskQuestions({ min: 1, max: 3 })

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when too few questions', () => {
      const result = makeAIResult('Hello there.')
      const e = createExpect(result, graderResults)

      expect(() => e.toAskQuestions({ min: 1 })).toThrow(ExpectationError)
    })

    it('fails when too many questions', () => {
      const result = makeAIResult('What? Why? How? When? Where?')
      const e = createExpect(result, graderResults)

      expect(() => e.toAskQuestions({ max: 2 })).toThrow(ExpectationError)
    })
  })

  describe('toPassJudge()', () => {
    it('fails empty output without requiring a judge model', async () => {
      const result = makeAIResult('   ')
      const e = createExpect(result, graderResults)

      await expect(e.toPassJudge('Provides a helpful answer')).rejects.toThrow(ExpectationError)
      expect(graderResults[0].pass).toBe(false)
      expect(graderResults[0].reason).toContain('output was empty')
    })

    it('allows negated empty-output judge checks without requiring a judge model', async () => {
      const result = makeAIResult('')
      const e = createExpect(result, graderResults)

      await e.not.toPassJudge('Provides a helpful answer')

      expect(graderResults[0].pass).toBe(true)
    })
  })

  describe('toolCalls.toInclude()', () => {
    it('passes when tool was called', () => {
      const result = makeAIResult('Done', [
        { type: 'tool-call', toolCallId: '1', toolName: 'search', input: { query: 'test' } },
      ])
      const e = createExpect(result, graderResults)

      e.toolCalls.toInclude('search')

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when tool was not called', () => {
      const result = makeAIResult('Done', [])
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.toInclude('search')).toThrow(ExpectationError)
    })
  })

  describe('toolCalls.not.toInclude()', () => {
    it('passes when tool was NOT called', () => {
      const result = makeAIResult('Done', [])
      const e = createExpect(result, graderResults)

      e.toolCalls.not.toInclude('delete')

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when tool WAS called', () => {
      const result = makeAIResult('Done', [
        { type: 'tool-call', toolCallId: '1', toolName: 'delete', input: {} },
      ])
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.not.toInclude('delete')).toThrow(ExpectationError)
    })
  })

  describe('toolCalls.toHaveArgs()', () => {
    it('passes when args match', () => {
      const result = makeAIResult('Done', [
        { type: 'tool-call', toolCallId: '1', toolName: 'search', input: { query: 'hello', limit: 10 } },
      ])
      const e = createExpect(result, graderResults)

      e.toolCalls.toHaveArgs('search', { query: 'hello' })

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when args do not match', () => {
      const result = makeAIResult('Done', [
        { type: 'tool-call', toolCallId: '1', toolName: 'search', input: { query: 'hello' } },
      ])
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.toHaveArgs('search', { query: 'goodbye' })).toThrow(ExpectationError)
    })

    it('fails when tool not called', () => {
      const result = makeAIResult('Done', [])
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.toHaveArgs('search', { query: 'test' })).toThrow(ExpectationError)
    })
  })

  describe('toolCalls.toHaveResult()', () => {
    it('passes when result matches', () => {
      const result = makeAIResult(
        'Done',
        [{ type: 'tool-call', toolCallId: '1', toolName: 'search', input: {} }],
        [{ type: 'tool-result', toolCallId: '1', toolName: 'search', input: {}, output: { count: 5 } }]
      )
      const e = createExpect(result, graderResults)

      e.toolCalls.toHaveResult('search', { count: 5 })

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when result does not match', () => {
      const result = makeAIResult(
        'Done',
        [{ type: 'tool-call', toolCallId: '1', toolName: 'search', input: {} }],
        [{ type: 'tool-result', toolCallId: '1', toolName: 'search', input: {}, output: { count: 5 } }]
      )
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.toHaveResult('search', { count: 10 })).toThrow(ExpectationError)
    })

    it('fails when no result (tool not executed)', () => {
      const result = makeAIResult(
        'Done',
        [{ type: 'tool-call', toolCallId: '1', toolName: 'search', input: {} }],
        [] // no tool results
      )
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.toHaveResult('search', { count: 5 })).toThrow(ExpectationError)
    })
  })

  describe('to() custom grader', () => {
    it('passes with custom grader', () => {
      const result = makeAIResult('Safe content')
      const e = createExpect(result, graderResults)

      const customGrader = (r: AIResult) => ({
        pass: !r.text.includes('unsafe'),
        reason: 'Content is safe',
      })

      e.to(customGrader)

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails with custom grader', () => {
      const result = makeAIResult('unsafe content here')
      const e = createExpect(result, graderResults)

      const customGrader = (r: AIResult) => ({
        pass: !r.text.includes('unsafe'),
        reason: 'Content is unsafe',
      })

      expect(() => e.to(customGrader)).toThrow(ExpectationError)
    })

    it('supports async custom grader', async () => {
      const result = makeAIResult('test content')
      const e = createExpect(result, graderResults)

      const asyncGrader = async (_r: AIResult) => ({
        pass: true,
        reason: 'Async check passed',
      })

      await e.to(asyncGrader)

      expect(graderResults[0].pass).toBe(true)
    })
  })

  describe('fluent chaining', () => {
    it('supports chaining toContain calls', () => {
      const result = makeAIResult('Hello World!')
      const e = createExpect(result, graderResults)

      e.toContain('hello').toContain('world')

      expect(graderResults).toHaveLength(2)
      expect(graderResults[0].pass).toBe(true)
      expect(graderResults[1].pass).toBe(true)
    })

    it('supports chaining toContain with toMatch', () => {
      const result = makeAIResult('Hello World 123!')
      const e = createExpect(result, graderResults)

      e.toContain('hello').toMatch(/\d+/)

      expect(graderResults).toHaveLength(2)
      expect(graderResults[0].pass).toBe(true)
      expect(graderResults[1].pass).toBe(true)
    })

    it('supports chaining with not', () => {
      const result = makeAIResult('Hello World!')
      const e = createExpect(result, graderResults)

      e.toContain('hello').not.toContain('goodbye')

      expect(graderResults).toHaveLength(2)
      expect(graderResults[0].pass).toBe(true)
      expect(graderResults[1].pass).toBe(true)
    })

    it('throws on first failing assertion in chain', () => {
      const result = makeAIResult('Hello World!')
      const e = createExpect(result, graderResults)

      expect(() => e.toContain('hello').toContain('xyz').toContain('world')).toThrow(ExpectationError)

      expect(graderResults).toHaveLength(2)
      expect(graderResults[0].pass).toBe(true)
      expect(graderResults[1].pass).toBe(false)
    })
  })
})
