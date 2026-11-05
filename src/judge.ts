import type { Case, Grader, JudgeModel, Verdict } from './types.js'
import { textOf } from './output.js'

export interface JudgeOptions<C extends Case = Case<any, any>> {
  /** Shown in failures. Defaults to the question. */
  name?: string
  /** Judge model for this grader. Otherwise the eval's or the config's judge is used. */
  model?: JudgeModel
  /** What the judge sees as the input. Defaults to the case input. */
  input?: (testCase: C) => unknown
  /**
   * Require the judge to quote the output for a pass, and check that every
   * quote really appears in it. Default true: a verdict you can't check is a
   * verdict you can't settle a disagreement with.
   */
  requireQuote?: boolean
}

/**
 * A model-based grader. Ask a question that can be checked against the
 * output ("Does the reply name the user's mistake? Quote it."), not for a
 * score ("Rate it 1 to 10"). Split questions that have "and" in them.
 */
export function judge<C extends Case = Case<any, any>>(question: string, opts: JudgeOptions<C> = {}): Grader<unknown, C> {
  const requireQuote = opts.requireQuote ?? true
  return {
    name: opts.name ?? question,
    kind: 'judge',
    grade: async (output, c, ctx) => {
      const model = opts.model ?? ctx.judgeModel
      if (!model) throw new Error('No judge model: set `judgeModel` in agentevals.config.ts or on the eval')
      const text = textOf(output)
      const raw = await model(buildPrompt(question, opts.input ? opts.input(c) : c.input, c.expected, text, requireQuote))
      return checkVerdict(parseVerdict(raw), text, requireQuote)
    },
  }
}

function buildPrompt(question: string, input: unknown, expected: unknown, output: string, requireQuote: boolean): string {
  const lines = [
    'You are grading one output of an AI system. Answer the question about the output only.',
    '',
    `Question: ${question}`,
    '',
    '<input>',
    typeof input === 'string' ? input : JSON.stringify(input, null, 2),
    '</input>',
  ]
  if (expected !== undefined) {
    lines.push('', '<reference_answer>', typeof expected === 'string' ? expected : JSON.stringify(expected, null, 2), '</reference_answer>')
  }
  lines.push(
    '',
    '<output>',
    output,
    '</output>',
    '',
    'Reply with JSON only, in this shape:',
    '{"evidence": ["exact quote from the output", ...], "pass": true or false, "reason": "one sentence"}',
    requireQuote
      ? 'Every evidence item must be copied exactly from the output. A pass needs at least one quote.'
      : 'Evidence quotes must be copied exactly from the output.',
  )
  return lines.join('\n')
}

interface RawVerdict {
  pass: boolean
  reason?: string
  evidence: string[]
}

function parseVerdict(raw: string): RawVerdict {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error(`Judge did not reply with JSON: ${raw.slice(0, 120)}`)
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  const pass = parsed.pass ?? (typeof parsed.verdict === 'string' ? parsed.verdict.toLowerCase() === 'pass' : undefined)
  if (typeof pass !== 'boolean') throw new Error('Judge reply has no boolean "pass"')
  const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.filter((e): e is string => typeof e === 'string') : []
  return { pass, reason: typeof parsed.reason === 'string' ? parsed.reason : undefined, evidence }
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** A judge that quotes text the output doesn't contain is broken, not a verdict on the model. */
function checkVerdict(v: RawVerdict, output: string, requireQuote: boolean): Verdict {
  const haystack = squash(output)
  const missing = v.evidence.filter((q) => !haystack.includes(squash(q)))
  if (missing.length > 0) throw new Error(`Judge quoted text that is not in the output: ${JSON.stringify(missing[0])}`)
  if (v.pass && requireQuote && v.evidence.length === 0) {
    return { pass: false, reason: 'Judge passed it without quoting the output', evidence: [] }
  }
  return { pass: v.pass, reason: v.reason, evidence: v.evidence }
}

/**
 * Adapter for the Vercel AI SDK, without depending on it:
 *   judgeModel: aiSdkJudge({ generateText, model: anthropic('...') })
 */
export function aiSdkJudge(opts: {
  generateText: (args: { model: any; prompt: string; temperature?: number }) => Promise<{ text: string }>
  model: unknown
  temperature?: number
}): JudgeModel {
  return async (prompt) => (await opts.generateText({ model: opts.model, prompt, temperature: opts.temperature ?? 0 })).text
}
