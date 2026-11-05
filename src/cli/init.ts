export const INIT_CONFIG = `import { defineConfig } from '@nem035/agentevals'
// import { aiSdkJudge } from '@nem035/agentevals'
// import { generateText } from 'ai'
// import { anthropic } from '@ai-sdk/anthropic'

export default defineConfig({
  include: ['evals/**/*.eval.ts'],
  concurrency: 5,
  // The judge gets its own setting, separate from the model under test,
  // so changing the model you test never changes the grader.
  // judgeModel: aiSdkJudge({ generateText, model: anthropic('claude-haiku-4-5') }),
})
`

export const INIT_EVAL = `import { defineEval, grader } from '@nem035/agentevals'

// Replace this with a call to your production code, so the eval tests what
// users actually get: import { extractDate } from '../src/extract'
async function extractDate(email: string, sentOn: string): Promise<string> {
  const sent = new Date(sentOn + 'T00:00:00Z')
  const nth = email.match(/the (\\d+)(?:st|nd|rd|th) of next month/)
  if (nth) return iso(new Date(Date.UTC(sent.getUTCFullYear(), sent.getUTCMonth() + 1, Number(nth[1]))))
  if (/tomorrow/i.test(email)) return iso(new Date(sent.getTime() + 86_400_000))
  return 'unknown'
}
const iso = (d: Date) => d.toISOString().slice(0, 10)

// Named after what it checks: two ISO dates are the same day.
const sameDay = grader('sameDay', (output: string, c) => output === c.expected)

export default defineEval({
  name: 'date extraction',
  cases: './dates.cases.jsonl',
  task: (input: { email: string; sentOn: string }) => extractDate(input.email, input.sentOn),
  graders: [sameDay],
  trials: 1,
  holdout: 0.3,
})
`

export const INIT_CASES = [
  { id: 'nth-next-month', input: { email: 'Can we push the review to the 3rd of next month?', sentOn: '2026-10-20' }, expected: '2026-11-03', tags: ['relative'] },
  { id: 'tomorrow', input: { email: 'Does tomorrow work for the call?', sentOn: '2026-10-20' }, expected: '2026-10-21', tags: ['relative'] },
  { id: 'two-weeks-from-friday', input: { email: "Let's meet two weeks from Friday.", sentOn: '2026-10-20' }, expected: '2026-11-06', tags: ['relative'] },
  { id: 'end-of-next-week', input: { email: 'I can send it by the end of next week.', sentOn: '2026-10-20' }, expected: '2026-10-30', tags: ['relative'] },
  { id: 'nth-next-month-2', input: { email: 'Invoice is due the 15th of next month.', sentOn: '2026-01-31' }, expected: '2026-02-15', tags: ['relative'] },
]
  .map((c) => JSON.stringify(c))
  .join('\n')
  .concat('\n')
