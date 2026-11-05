import { describe, expect, it } from 'vitest'
import { normalizeOutput, textOf, toolCallsOf, wasCutOff } from './output.js'

describe('normalizeOutput', () => {
  it('reduces an SDK-style result to text, tool calls, finish reason and usage', () => {
    const raw = {
      text: 'It is sunny',
      finishReason: 'stop',
      steps: [{ toolCalls: [{ toolName: 'getWeather', input: { city: 'Tokyo' } }] }, { toolCalls: [] }],
      totalUsage: { inputTokens: 10, outputTokens: 5 },
      response: { body: () => 'functions are dropped' },
    }
    const out = normalizeOutput(raw)
    expect(out).toEqual({
      text: 'It is sunny',
      toolCalls: [{ toolName: 'getWeather', input: { city: 'Tokyo' } }],
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 5 },
    })
    expect(textOf(out)).toBe('It is sunny')
    expect(toolCallsOf(out)).toHaveLength(1)
  })

  it('keeps other values as plain JSON', () => {
    expect(normalizeOutput({ date: '2026-11-03', f: () => 1 })).toEqual({ date: '2026-11-03' })
    expect(normalizeOutput(undefined)).toBeNull()
    expect(normalizeOutput('plain')).toBe('plain')
  })

  it('detects replies cut off at the output limit', () => {
    expect(wasCutOff({ finishReason: 'length' })).toBe(true)
    expect(wasCutOff({ stopReason: 'max_tokens' })).toBe(true)
    expect(wasCutOff({ finishReason: 'stop' })).toBe(false)
  })
})
