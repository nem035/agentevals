/**
 * Cookbook: Model Comparison
 *
 * Demonstrates running the same eval against different models
 * to compare their performance. Use groups to organize results
 * by model.
 */
import { evalite } from '@nem035/agentevals'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

// -- Define shared test prompts --

const mathPrompt = 'Solve for x: 3x + 7 = 22. Show your work.'
const codingPrompt = 'Write a JavaScript function that checks if a string is a palindrome.'
const reasoningPrompt = 'If all cats are animals, and some animals are pets, can we conclude that some cats are pets? Explain.'

// -- Claude evaluations --

evalite.group('claude-sonnet', () => {
  const model = anthropic('claude-sonnet-4-20250514')

  evalite('solves algebra', async ({ expect }) => {
    const result = await generateText({ model, prompt: mathPrompt })
    expect(result).toContain('5')
  })

  evalite('writes correct code', async ({ expect }) => {
    const result = await generateText({ model, prompt: codingPrompt })
    expect(result)
      .toMatch(/function|const|=>/)
      .toMatch(/reverse|split|join/i)
  })

  evalite('handles logical reasoning', async ({ expect }) => {
    const result = await generateText({ model, prompt: reasoningPrompt })
    // The correct answer is: No, we cannot conclude that
    expect(result).toMatch(/cannot|can't|no|not necessarily/i)
  })
})

// -- GPT evaluations --

evalite.group('gpt-4o', () => {
  const model = openai('gpt-4o')

  evalite('solves algebra', async ({ expect }) => {
    const result = await generateText({ model, prompt: mathPrompt })
    expect(result).toContain('5')
  })

  evalite('writes correct code', async ({ expect }) => {
    const result = await generateText({ model, prompt: codingPrompt })
    expect(result)
      .toMatch(/function|const|=>/)
      .toMatch(/reverse|split|join/i)
  })

  evalite('handles logical reasoning', async ({ expect }) => {
    const result = await generateText({ model, prompt: reasoningPrompt })
    expect(result).toMatch(/cannot|can't|no|not necessarily/i)
  })
})

// -- Side-by-side with shared assertions via helper --

function mathEval(modelName: string, model: Parameters<typeof generateText>[0]['model']) {
  evalite.group(`${modelName}-math-suite`, () => {
    const problems = [
      { prompt: 'What is 15% of 200?', expected: '30' },
      { prompt: 'What is the square root of 144?', expected: '12' },
      { prompt: 'What is 7 factorial?', expected: '5040' },
    ]

    for (const { prompt, expected } of problems) {
      evalite(prompt, async ({ expect }) => {
        const result = await generateText({ model, prompt })
        expect(result).toContain(expected)
      })
    }
  })
}

mathEval('claude', anthropic('claude-sonnet-4-20250514'))
mathEval('gpt-4o', openai('gpt-4o'))
