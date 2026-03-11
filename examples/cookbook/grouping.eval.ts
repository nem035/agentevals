/**
 * Cookbook: Grouping & Organization
 *
 * Demonstrates organizing evals with evalite.group(),
 * shared options, and structuring large eval suites.
 */
import { evalite } from '@nem035/agentevals'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

// -- Ungrouped evals (top-level) --

evalite('basic sanity check', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'Say "ok".',
  })

  expect(result).toMatch(/ok/i)
})

// -- Simple group --

evalite.group('math', () => {
  evalite('addition', async ({ expect }) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: 'What is 2 + 3? Just the number.',
    })
    expect(result).toContain('5')
  })

  evalite('multiplication', async ({ expect }) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: 'What is 7 * 8? Just the number.',
    })
    expect(result).toContain('56')
  })

  evalite('division', async ({ expect }) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: 'What is 100 / 4? Just the number.',
    })
    expect(result).toContain('25')
  })
})

// -- Group with shared options --

evalite.group('quality-checks', {
  judge: anthropic('claude-sonnet-4-20250514'),  // shared judge for all evals in group
  timeout: 30000,                                 // shared timeout
}, () => {

  evalite('helpful responses', async ({ expect }) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: 'How do I learn TypeScript?',
    })

    // toPassJudge uses the group's judge model automatically
    await expect(result).toPassJudge('Provides actionable advice for learning TypeScript')
  })

  evalite('clear explanations', async ({ expect }) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: 'Explain what an API is.',
    })

    await expect(result).toPassJudge('Explains APIs in clear, non-technical language')
  })

})

// -- Multiple groups in one file for organized test suites --

evalite.group('tone-formal', () => {
  evalite('uses formal language', async ({ expect }) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: 'You are a formal business assistant. Use professional language.',
      prompt: 'Draft a meeting request.',
    })

    expect(result).toMatch(/dear|regards|please|kindly|request/i)
  })
})

evalite.group('tone-casual', () => {
  evalite('uses casual language', async ({ expect }) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: 'You are a casual, friendly assistant. Be relaxed and conversational.',
      prompt: 'How do I start a new project?',
    })

    expect(result).toMatch(/hey|cool|awesome|just|gonna|let's/i)
  })
})

// -- Pattern: parameterized groups for testing variations --

const personas = [
  { name: 'teacher', system: 'You are a patient teacher.', expectPattern: /explain|understand|learn/i },
  { name: 'coach', system: 'You are a motivating coach.', expectPattern: /great|can do|believe|goal/i },
  { name: 'expert', system: 'You are a domain expert. Be precise.', expectPattern: /specifically|precisely|technically/i },
]

for (const persona of personas) {
  evalite.group(`persona-${persona.name}`, () => {
    evalite('responds in character', async ({ expect }) => {
      const result = await generateText({
        model: anthropic('claude-sonnet-4-20250514'),
        system: persona.system,
        prompt: 'Help me understand recursion.',
      })

      expect(result).toMatch(persona.expectPattern)
    })
  })
}
