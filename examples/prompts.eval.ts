// Comparing two prompts on the same cases. `variants` runs both and the CLI
// compares them case by case with the luck check, so you don't pick a winner
// from a gap that is only noise.
import { defineEval, equals } from '@nem035/agentevals'
import { chance } from './fake-model.js'

const reviews = [
  ['Arrived broken and support never answered.', 'negative'],
  ['Exactly what I needed, works great.', 'positive'],
  ['It is fine. Does the job.', 'neutral'],
  ['Not bad at all, I would buy again.', 'positive'],
  ['I wanted to love it, but it stopped charging after a week.', 'negative'],
  ['Cheaper than the others and just as good.', 'positive'],
  ['The color is different from the photo.', 'negative'],
  ['Shipping took a while, product is ok.', 'neutral'],
  ['Could not be happier!!!', 'positive'],
  ['Meh.', 'neutral'],
  ['Great, another charger that dies in a week.', 'negative'],
  ['Does what it says.', 'neutral'],
] as const

// A fake classifier: the prompt with examples handles a few hard cases better.
const classify = (accuracy: number) => (input: { text: string }, ctx: { caseId: string; trial: number }) => {
  const right = reviews.find(([t]) => t === input.text)![1]
  const hard = /not bad|wanted to love|great, another/i.test(input.text)
  return chance(`${ctx.caseId}/${ctx.trial}/${accuracy}`, hard ? accuracy - 0.4 : accuracy) ? right : 'neutral'
}

export default defineEval({
  name: 'review sentiment',
  cases: reviews.map(([text, label], i) => ({ id: `review-${i + 1}`, input: { text }, expected: label })),
  variants: {
    'zero-shot prompt': classify(0.85),
    'prompt with examples': classify(0.95),
  },
  graders: [equals()],
  trials: 3,
})
