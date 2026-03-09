import { evalite } from '../src/index.js'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

evalite('responds to greeting', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a friendly assistant. Keep responses brief.',
    prompt: 'Hello!',
  })

  expect(result).toContain('hello')
})

evalite('answers math questions', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'What is 2 + 2? Just give me the number.',
  })

  expect(result).toMatch(/4/)
})

evalite.group('conversation', () => {
  evalite('maintains context', async ({ expect }) => {
    // Multi-turn conversation using AI SDK messages
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: 'You are a friendly assistant. Keep responses brief.',
      messages: [
        { role: 'user', content: 'My favorite color is blue.' },
        { role: 'assistant', content: 'That\'s nice! Blue is a great color.' },
        { role: 'user', content: 'What is my favorite color?' },
      ],
    })

    expect(result).toContain('blue')
  })
})
