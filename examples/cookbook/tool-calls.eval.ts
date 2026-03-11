/**
 * Cookbook: Tool Call Testing
 *
 * Demonstrates testing AI tool usage with createMockExecutor,
 * createSpyExecutor, and tool call assertions.
 */
import { evalite, createMockExecutor, createSpyExecutor, matchers } from '@nem035/agentevals'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText, tool } from 'ai'
import { z } from 'zod'

// -- Basic tool call testing with mock executor --

evalite('calls weather tool for weather questions', async ({ expect }) => {
  const mockExecute = createMockExecutor({ temp: 72, condition: 'sunny' })

  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a weather assistant. Always use the getWeather tool to answer weather questions.',
    prompt: 'What is the weather in Tokyo?',
    tools: {
      getWeather: tool({
        description: 'Get current weather for a location',
        parameters: z.object({
          location: z.string().describe('City name'),
        }),
        execute: mockExecute,
      }),
    },
    maxSteps: 3,
  })

  // Assert the tool was called
  expect(result).toolCalls.toInclude('getWeather')

  // Assert arguments using matchers
  expect(result).toolCalls.toHaveArgs('getWeather', {
    location: matchers.stringMatching(/tokyo/i),
  })

  // Verify mock recorded the call
  console.log('Mock calls:', mockExecute.calls)
})

// -- Asserting tool was NOT called --

evalite('does not use tools for simple questions', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'What is 2 + 2?',
    tools: {
      getWeather: tool({
        description: 'Get weather for a location',
        parameters: z.object({ location: z.string() }),
        execute: async () => ({ temp: 72 }),
      }),
    },
  })

  expect(result).toolCalls.not.toHaveBeenCalled()
})

// -- Spy executor: wraps real logic, records calls + results --

evalite('spy on calculator tool', async ({ expect }) => {
  const spy = createSpyExecutor(async ({ a, b, op }: { a: number; b: number; op: string }) => {
    switch (op) {
      case 'add': return a + b
      case 'subtract': return a - b
      case 'multiply': return a * b
      case 'divide': return a / b
      default: throw new Error(`Unknown op: ${op}`)
    }
  })

  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'Use the calculator tool to perform math operations.',
    prompt: 'What is 15 multiplied by 4?',
    tools: {
      calculator: tool({
        description: 'Perform a math operation',
        parameters: z.object({
          a: z.number(),
          b: z.number(),
          op: z.enum(['add', 'subtract', 'multiply', 'divide']),
        }),
        execute: spy,
      }),
    },
    maxSteps: 3,
  })

  expect(result).toolCalls.toInclude('calculator')
  expect(result).toContain('60')

  // Spy records both calls and results
  console.log('Spy calls:', spy.calls)
  console.log('Spy results:', spy.results)
})

// -- Call count assertions --

evalite('calls tool the expected number of times', async ({ expect }) => {
  const mockExecute = createMockExecutor({ population: '14 million' })

  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'Use the lookup tool for each city mentioned. Answer questions about cities.',
    prompt: 'What is the population of Tokyo?',
    tools: {
      lookup: tool({
        description: 'Look up facts about a city',
        parameters: z.object({ city: z.string() }),
        execute: mockExecute,
      }),
    },
    maxSteps: 3,
  })

  // Assert specific tool was called exactly once
  expect(result).toolCalls.toHaveCallCount('lookup', 1)
})

// -- Tool result assertions --

evalite('tool returns expected result', async ({ expect }) => {
  const mockExecute = createMockExecutor({
    available: true,
    price: '$120/night',
    rating: 4.5,
  })

  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a hotel booking assistant. Use the searchHotels tool.',
    prompt: 'Find me a hotel in Paris.',
    tools: {
      searchHotels: tool({
        description: 'Search for hotels in a city',
        parameters: z.object({ city: z.string() }),
        execute: mockExecute,
      }),
    },
    maxSteps: 3,
  })

  expect(result).toolCalls.toHaveResult('searchHotels',
    matchers.objectContaining({ available: true })
  )
})

// -- Using matchers for flexible argument checks --

evalite('flexible argument matching', async ({ expect }) => {
  const mockExecute = createMockExecutor({ results: ['item1', 'item2'] })

  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'Use the search tool to find items.',
    prompt: 'Search for red shoes in size 10.',
    tools: {
      search: tool({
        description: 'Search for products',
        parameters: z.object({
          query: z.string(),
          category: z.string().optional(),
          maxResults: z.number().optional(),
        }),
        execute: mockExecute,
      }),
    },
    maxSteps: 3,
  })

  // Use matchers for flexible assertions
  expect(result).toolCalls.toHaveArgs('search', {
    query: matchers.stringMatching(/shoes/i),
    // matchers.anything() matches any value (or absence)
  })
})
