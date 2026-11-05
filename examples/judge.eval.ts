// A model-graded check. The question is one checkable thing, and the judge
// must quote the reply, so you can see what a verdict was based on.
import { defineEval, judge, type JudgeModel } from '@nem035/agentevals'
// With a real model:
// import { aiSdkJudge } from '@nem035/agentevals'
// import { generateText } from 'ai'
// import { anthropic } from '@ai-sdk/anthropic'
// const judgeModel = aiSdkJudge({ generateText, model: anthropic('claude-haiku-4-5') })

// A stub judge so this runs offline: passes when the reply repeats the
// customer's complaint word, and quotes the sentence it found it in.
const judgeModel: JudgeModel = async (prompt) => {
  const input = prompt.match(/<input>\n([\s\S]*?)\n<\/input>/)![1]
  const output = prompt.match(/<output>\n([\s\S]*?)\n<\/output>/)![1]
  const complaint = JSON.parse(input).complaint as string
  const quote = output.split(/(?<=\.)\s/).find((s) => s.toLowerCase().includes(complaint))
  return JSON.stringify({ evidence: quote ? [quote] : [], pass: !!quote, reason: quote ? 'names it' : 'generic apology' })
}

const replies: Record<string, string> = {
  late: 'Sorry your order arrived late. I have refunded the shipping cost.',
  broken: 'We apologize for the inconvenience. Is there anything else?',
  overcharged: 'You were overcharged by $12. That is on us, and the refund is on its way.',
}

export default defineEval({
  name: 'reply names the problem',
  cases: Object.keys(replies).map((complaint) => ({ id: complaint, input: { complaint } })),
  task: (input: { complaint: string }) => replies[input.complaint],
  graders: [judge('Does the reply name the specific problem the customer had? Quote where it does.', { name: 'namesTheProblem' })],
  judgeModel,
})
