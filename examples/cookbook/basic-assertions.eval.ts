/**
 * Cookbook: Basic Assertions
 *
 * Demonstrates the core assertion methods: toContain, toMatch,
 * toAskQuestions, negation (.not), and fluent chaining.
 */
import { evalite } from '@nem035/agentevals'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

// -- toContain: check that output includes specific text --

evalite('responds to greeting', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a friendly assistant. Keep responses brief.',
    prompt: 'Hello!',
  })

  // Case-insensitive by default
  expect(result).toContain('hello')
})

evalite('case-sensitive matching', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'Say "TypeScript" exactly.',
  })

  expect(result).toContain('TypeScript', { caseSensitive: true })
})

// -- toMatch: check that output matches a regex --

evalite('answers math correctly', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'What is 2 + 2? Just the number.',
  })

  expect(result).toMatch(/\b4\b/)
})

evalite('provides a numbered list', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'List 3 programming languages. Use a numbered list.',
  })

  // Match numbered list pattern
  expect(result).toMatch(/1\.\s+\w+/)
})

// -- toAskQuestions: check that output contains questions --

evalite('asks clarifying questions', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a helpful assistant. When the user request is vague, ask clarifying questions.',
    prompt: 'Help me with my project.',
  })

  // At least 1 question mark
  expect(result).toAskQuestions()
})

evalite('asks a bounded number of questions', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'Ask the user 2-3 questions to understand their needs.',
    prompt: 'I want to build an app.',
  })

  expect(result).toAskQuestions({ min: 2, max: 3 })
})

// -- Negation with .not --

evalite('does not apologize unnecessarily', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a confident assistant. Answer directly without apologizing.',
    prompt: 'What is the capital of France?',
  })

  expect(result)
    .toContain('Paris')
    .not.toMatch(/sorry|apologize|apologies/i)
})

// -- Fluent chaining --

evalite('comprehensive response check', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a coding assistant. Be concise and helpful.',
    prompt: 'How do I reverse a string in JavaScript?',
  })

  expect(result)
    .toContain('reverse')
    .toMatch(/split|join|reverse/i)
    .not.toContain('error')
})
