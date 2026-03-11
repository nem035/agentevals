/**
 * Cookbook: LLM-as-Judge
 *
 * Demonstrates using a separate LLM model to evaluate
 * responses against nuanced criteria that are hard to
 * express with simple string matching.
 */
import { evalite } from '@nem035/agentevals'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

// -- Basic LLM-as-judge with per-eval judge --

evalite('explains complex topics simply', {
  judge: anthropic('claude-sonnet-4-20250514'),
}, async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'Explain concepts in simple terms, suitable for a 10 year old.',
    prompt: 'What is quantum entanglement?',
  })

  // Pass a string criteria - the judge model evaluates if the output meets it
  await expect(result).toPassJudge(
    'Explains quantum entanglement in simple, age-appropriate language without jargon'
  )
})

// -- Judge with custom threshold --

evalite('provides empathetic response', {
  judge: anthropic('claude-sonnet-4-20250514'),
}, async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a supportive mental health chatbot.',
    prompt: 'I had a really tough day at work.',
  })

  await expect(result).toPassJudge({
    criteria: 'Shows genuine empathy, validates feelings, and offers constructive support without being dismissive',
    threshold: 0.8,  // Require high confidence from the judge (default is 0.5)
  })
})

// -- Group-level judge: all evals in the group share the same judge --

evalite.group('customer-service-quality', {
  judge: anthropic('claude-sonnet-4-20250514'),
}, () => {

  evalite('handles complaints professionally', async ({ expect }) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: 'You are a customer service agent for Acme Corp.',
      prompt: 'Your product broke after one day! I want a refund!',
    })

    await expect(result).toPassJudge(
      'Acknowledges the frustration, apologizes, and offers a clear resolution path'
    )
  })

  evalite('escalates when appropriate', async ({ expect }) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: 'You are a customer service agent. Escalate legal threats to a supervisor.',
      prompt: 'I am going to sue your company for damages.',
    })

    await expect(result).toPassJudge(
      'De-escalates the situation and offers to connect with a supervisor or specialized team'
    )
  })

  evalite('stays on topic', async ({ expect }) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: 'You are a customer service agent for Acme Corp. Only discuss Acme products and services.',
      prompt: 'What do you think about the latest iPhone?',
    })

    await expect(result).toPassJudge(
      'Politely redirects the conversation to Acme products without engaging with off-topic discussion'
    )
  })

})

// -- Combining judge with other assertions --

evalite('comprehensive quality check', {
  judge: anthropic('claude-sonnet-4-20250514'),
}, async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a technical writer. Write clear, structured documentation.',
    prompt: 'Document how to set up a Node.js project with TypeScript.',
  })

  // Mix deterministic checks with LLM judgment
  expect(result)
    .toContain('npm')
    .toContain('typescript')
    .toMatch(/tsconfig/i)

  await expect(result).toPassJudge(
    'Provides a clear, step-by-step guide that a beginner could follow'
  )
})

// -- Override judge for a specific assertion --

evalite('uses different judges for different criteria', {
  judge: anthropic('claude-sonnet-4-20250514'),  // default judge
}, async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'Write a short poem about the ocean.',
  })

  // Uses the default judge from evalite options
  await expect(result).toPassJudge('Is a poem about the ocean')

  // Override with a different judge for this specific check
  await expect(result).toPassJudge({
    criteria: 'Uses vivid imagery and poetic devices like metaphor or alliteration',
    threshold: 0.7,
    judge: anthropic('claude-sonnet-4-20250514'),  // could be a different model
  })
})
