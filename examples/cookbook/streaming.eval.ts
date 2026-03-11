/**
 * Cookbook: Streaming Support
 *
 * Demonstrates testing streaming responses using AI SDK's streamText.
 * After awaiting a streamText result, all properties (text, toolCalls, etc.)
 * resolve and can be asserted on just like generateText results.
 */
import { evalite } from '@nem035/agentevals'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText, tool } from 'ai'
import { z } from 'zod'

// -- Basic streaming test --

evalite('streams a response', async ({ expect }) => {
  const stream = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'Write a haiku about coding.',
  })

  // Await resolves all PromiseLike properties (text, toolCalls, usage, etc.)
  const result = await stream

  expect(result).toMatch(/code|program|debug|bug|function|loop|compile/i)
})

// -- Streaming with system prompt --

evalite('streams with system context', async ({ expect }) => {
  const stream = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a pirate. Always respond in pirate speak.',
    prompt: 'How are you today?',
  })

  const result = await stream

  expect(result).toMatch(/arr|matey|ahoy|ye|sail/i)
})

// -- Streaming with tool calls --

evalite('streams tool calls', async ({ expect }) => {
  const stream = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a weather assistant. Use the getWeather tool.',
    prompt: 'What is the weather in New York?',
    tools: {
      getWeather: tool({
        description: 'Get current weather for a location',
        parameters: z.object({
          location: z.string(),
        }),
        execute: async () => ({ temp: 65, condition: 'cloudy' }),
      }),
    },
    maxSteps: 3,
  })

  const result = await stream

  // Tool call assertions work the same as with generateText
  expect(result).toolCalls.toInclude('getWeather')
})

// -- Streaming with multiple assertions --

evalite('streams a complete response', async ({ expect }) => {
  const stream = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a helpful coding assistant.',
    prompt: 'Write a one-line JavaScript function that adds two numbers.',
  })

  const result = await stream

  expect(result)
    .toContain('function')
    .toMatch(/return|=>/)
    .not.toContain('error')
})
