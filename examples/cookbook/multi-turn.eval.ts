/**
 * Cookbook: Multi-turn Conversations
 *
 * Demonstrates testing multi-turn conversations using AI SDK's
 * messages array. Test context retention, conversation flow,
 * and multi-step interactions.
 */
import { evalite } from '@nem035/agentevals'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

// -- Basic context retention --

evalite('remembers user name', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a friendly assistant.',
    messages: [
      { role: 'user', content: 'Hi, my name is Alice.' },
      { role: 'assistant', content: 'Hello Alice! Nice to meet you. How can I help?' },
      { role: 'user', content: 'What is my name?' },
    ],
  })

  expect(result).toContain('Alice')
})

// -- Retaining facts across turns --

evalite('remembers stated preferences', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a personal assistant. Remember user preferences.',
    messages: [
      { role: 'user', content: 'I am allergic to peanuts and I prefer Italian food.' },
      { role: 'assistant', content: 'Noted! I will keep your peanut allergy and Italian food preference in mind.' },
      { role: 'user', content: 'Suggest a dinner for me.' },
    ],
  })

  // Should suggest Italian food and avoid peanuts
  expect(result)
    .not.toMatch(/peanut/i)
    .toMatch(/italian|pasta|pizza|risotto|bruschetta/i)
})

// -- Multi-step task progression --

evalite('follows multi-step instructions', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a coding tutor helping a student build a todo app.',
    messages: [
      { role: 'user', content: 'I want to build a todo app in React.' },
      { role: 'assistant', content: 'Let\'s start with the project setup. First, create a new React project using create-react-app or Vite.' },
      { role: 'user', content: 'Done! I set up the project with Vite. What next?' },
      { role: 'assistant', content: 'Now let\'s create the TodoItem component. Create a file called TodoItem.tsx.' },
      { role: 'user', content: 'OK, I created the file. What should the component look like?' },
    ],
  })

  // Should continue the tutorial flow and reference TodoItem
  expect(result)
    .toMatch(/TodoItem|component|props|interface/i)
    .toMatch(/function|const|export/i)
})

// -- Conversation with corrections --

evalite('handles user corrections gracefully', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a geography assistant.',
    messages: [
      { role: 'user', content: 'What is the capital of Australia?' },
      { role: 'assistant', content: 'The capital of Australia is Sydney.' },
      { role: 'user', content: 'That is wrong. The capital is Canberra, not Sydney.' },
    ],
  })

  // Should acknowledge the correction
  expect(result)
    .toContain('Canberra')
    .toMatch(/correct|right|apolog|mistake|thank/i)
})

// -- Building up complex context --

evalite('maintains order details across turns', async ({ expect }) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a pizza ordering assistant.',
    messages: [
      { role: 'user', content: 'I want to order a large pizza.' },
      { role: 'assistant', content: 'A large pizza. What toppings would you like?' },
      { role: 'user', content: 'Pepperoni and mushrooms.' },
      { role: 'assistant', content: 'Large pizza with pepperoni and mushrooms. Anything else?' },
      { role: 'user', content: 'Add a side of garlic bread. Can you summarize my order?' },
    ],
  })

  expect(result)
    .toContain('large')
    .toContain('pepperoni')
    .toContain('mushroom')
    .toMatch(/garlic bread/i)
})
