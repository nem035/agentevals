import { generateText, type LanguageModel } from 'ai'
import { z } from 'zod'
import type {
  AIResult,
  GraderResult,
  GraderFn,
  JudgeOptions,
  JudgeJudgment,
  ToolCallInfo,
  ToolResultInfo,
} from '../types.js'

export class ExpectationError extends Error {
  constructor(
    public graderResult: GraderResult,
    public expectationType: string
  ) {
    super(graderResult.reason)
    this.name = 'ExpectationError'
  }
}

// ============================================================================
// Matcher Types & Utilities
// ============================================================================

/** Symbol to identify matcher objects */
const MATCHER_SYMBOL = Symbol('matcher')

/** Base interface for all matchers */
interface Matcher {
  [MATCHER_SYMBOL]: true
  match(value: unknown): boolean
  description(): string
}

/** Check if a value is a matcher */
function isMatcher(value: unknown): value is Matcher {
  return typeof value === 'object' && value !== null && MATCHER_SYMBOL in value
}

/**
 * Match objects that contain at least the specified properties
 */
function objectContaining(expected: Record<string, unknown>): Matcher {
  return {
    [MATCHER_SYMBOL]: true,
    match(value: unknown): boolean {
      if (typeof value !== 'object' || value === null) return false
      const obj = value as Record<string, unknown>
      return Object.entries(expected).every(([key, expectedVal]) => {
        const actualVal = obj[key]
        return matchValue(actualVal, expectedVal)
      })
    },
    description() {
      return `objectContaining(${JSON.stringify(expected)})`
    },
  }
}

/**
 * Match arrays that contain all specified elements (in any order)
 */
function arrayContaining(expected: unknown[]): Matcher {
  return {
    [MATCHER_SYMBOL]: true,
    match(value: unknown): boolean {
      if (!Array.isArray(value)) return false
      return expected.every((expectedItem) =>
        value.some((actualItem) => matchValue(actualItem, expectedItem))
      )
    },
    description() {
      return `arrayContaining(${JSON.stringify(expected)})`
    },
  }
}

/**
 * Match strings that match the given pattern
 */
function stringMatching(pattern: RegExp | string): Matcher {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
  return {
    [MATCHER_SYMBOL]: true,
    match(value: unknown): boolean {
      if (typeof value !== 'string') return false
      return regex.test(value)
    },
    description() {
      return `stringMatching(${regex})`
    },
  }
}

/**
 * Match any value (always passes)
 */
function anything(): Matcher {
  return {
    [MATCHER_SYMBOL]: true,
    match(): boolean {
      return true
    },
    description() {
      return 'anything()'
    },
  }
}

/**
 * Match a value using a matcher or strict equality
 */
function matchValue(actual: unknown, expected: unknown): boolean {
  if (isMatcher(expected)) {
    return expected.match(actual)
  }

  // Deep equality check
  if (typeof expected === 'object' && expected !== null) {
    if (typeof actual !== 'object' || actual === null) return false

    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) return false
      if (actual.length !== expected.length) return false
      return expected.every((item, i) => matchValue(actual[i], item))
    }

    const expectedObj = expected as Record<string, unknown>
    const actualObj = actual as Record<string, unknown>
    const keys = Object.keys(expectedObj)

    return keys.every((key) => matchValue(actualObj[key], expectedObj[key]))
  }

  return actual === expected
}

/** Export matchers for use in tests */
export const matchers = {
  objectContaining,
  arrayContaining,
  stringMatching,
  anything,
}

// ============================================================================
// Judge Utilities
// ============================================================================

const DefaultJudgeSchema = z.object({
  reasoning: z
    .string()
    .describe('Reason through the evidence before choosing a verdict.'),
  evidence: z
    .array(z.string())
    .describe('Short quotes or phrases from the output that support the verdict.'),
  score: z
    .number()
    .min(0)
    .max(1)
    .describe('Numeric confidence/quality score from 0 to 1.'),
  verdict: z
    .enum(['PASS', 'FAIL'])
    .describe('Final verdict after considering the reasoning and evidence.'),
}) satisfies z.ZodType<JudgeJudgment>

function extractJsonObject(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')

    if (start === -1 || end === -1 || end <= start) {
      throw new Error('No JSON object found in judge response')
    }

    return JSON.parse(text.slice(start, end + 1))
  }
}

function formatRubric(rubric: JudgeOptions['rubric']): string {
  if (!rubric) {
    return ''
  }

  const items = Array.isArray(rubric) ? rubric : [rubric]
  return `\n\n## Additional Rubric\n${items.map((item) => `- ${item}`).join('\n')}`
}

// ============================================================================
// Tool Call Assertions
// ============================================================================

export class ToolCallsExpect {
  private negated: boolean = false

  constructor(
    private toolCalls: readonly ToolCallInfo[],
    private toolResults: readonly ToolResultInfo[],
    private graderResults: GraderResult[]
  ) {}

  get not(): ToolCallsExpect {
    const instance = new ToolCallsExpect(this.toolCalls, this.toolResults, this.graderResults)
    instance.negated = !this.negated
    return instance
  }

  /**
   * Assert that any tool was called
   */
  toHaveBeenCalled(): this {
    const called = this.toolCalls.length > 0
    const pass = this.negated ? !called : called
    const reason = this.negated
      ? called
        ? `Expected no tools to be called, but ${this.toolCalls.length} were called: ${this.toolCalls.map((t) => t.toolName).join(', ')}`
        : 'No tools were called (as expected)'
      : called
        ? `Tools were called: ${this.toolCalls.map((t) => t.toolName).join(', ')}`
        : 'Expected at least one tool to be called, but none were'

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toolCalls.toHaveBeenCalled')
    }

    return this
  }

  /**
   * Assert the number of times a tool was called
   */
  toHaveCallCount(count: number): this
  toHaveCallCount(toolName: string, count: number): this
  toHaveCallCount(toolNameOrCount: string | number, maybeCount?: number): this {
    let toolName: string | undefined
    let expectedCount: number

    if (typeof toolNameOrCount === 'number') {
      expectedCount = toolNameOrCount
    } else {
      toolName = toolNameOrCount
      expectedCount = maybeCount!
    }

    const actualCount = toolName
      ? this.toolCalls.filter((tc) => tc.toolName === toolName).length
      : this.toolCalls.length

    const countMatches = actualCount === expectedCount
    const pass = this.negated ? !countMatches : countMatches

    const subject = toolName ? `Tool "${toolName}"` : 'Tools'
    const reason = this.negated
      ? countMatches
        ? `Expected ${subject} NOT to be called ${expectedCount} time(s), but it was`
        : `${subject} was called ${actualCount} time(s), not ${expectedCount} (as expected)`
      : countMatches
        ? `${subject} was called ${expectedCount} time(s)`
        : `Expected ${subject} to be called ${expectedCount} time(s), but was called ${actualCount} time(s)`

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toolCalls.toHaveCallCount')
    }

    return this
  }

  /**
   * Assert that a specific tool was called
   */
  toInclude(toolName: string): this {
    const found = this.toolCalls.some((tc) => tc.toolName === toolName)
    const pass = this.negated ? !found : found
    const reason = this.negated
      ? found
        ? `Expected tool "${toolName}" NOT to be called, but it was`
        : `Tool "${toolName}" was not called (as expected)`
      : found
        ? `Tool "${toolName}" was called`
        : `Expected tool "${toolName}" to be called, but it was not. Called tools: ${this.toolCalls.map((t) => t.toolName).join(', ') || '(none)'}`

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toolCalls.toInclude')
    }

    return this
  }

  /**
   * Assert that a tool was called with specific arguments.
   * Supports matchers like objectContaining(), arrayContaining(), stringMatching()
   */
  toHaveArgs(toolName: string, expectedArgs: Record<string, unknown>): this {
    const call = this.toolCalls.find((tc) => tc.toolName === toolName)

    if (!call) {
      const result: GraderResult = {
        pass: this.negated,
        reason: this.negated
          ? `Tool "${toolName}" was not called (as expected)`
          : `Expected tool "${toolName}" to be called, but it was not`,
      }
      this.graderResults.push(result)
      if (!result.pass) {
        throw new ExpectationError(result, 'toolCalls.toHaveArgs')
      }
      return this
    }

    const argsMatch = matchValue(call.input, expectedArgs)

    const pass = this.negated ? !argsMatch : argsMatch
    const expectedStr = Object.entries(expectedArgs)
      .map(([k, v]) => `${k}: ${isMatcher(v) ? v.description() : JSON.stringify(v)}`)
      .join(', ')
    const reason = this.negated
      ? argsMatch
        ? `Expected tool "${toolName}" NOT to have args {${expectedStr}}`
        : `Tool "${toolName}" has different args (as expected)`
      : argsMatch
        ? `Tool "${toolName}" called with expected args`
        : `Tool "${toolName}" called with different args. Expected: {${expectedStr}}, Got: ${JSON.stringify(call.input)}`

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toolCalls.toHaveArgs')
    }

    return this
  }

  /**
   * Assert that a tool returned a specific result
   */
  toHaveResult(toolName: string, expectedResult: unknown): this {
    const toolResult = this.toolResults.find((tr) => tr.toolName === toolName)

    if (!toolResult) {
      const result: GraderResult = {
        pass: this.negated,
        reason: `Tool "${toolName}" has no result`,
      }
      this.graderResults.push(result)
      if (!result.pass) {
        throw new ExpectationError(result, 'toolCalls.toHaveResult')
      }
      return this
    }

    const resultMatches = matchValue(toolResult.output, expectedResult)
    const pass = this.negated ? !resultMatches : resultMatches

    const graderResult: GraderResult = {
      pass,
      reason: pass
        ? `Tool "${toolName}" returned expected result`
        : `Tool "${toolName}" returned different result. Expected: ${isMatcher(expectedResult) ? expectedResult.description() : JSON.stringify(expectedResult)}, Got: ${JSON.stringify(toolResult.output)}`,
    }
    this.graderResults.push(graderResult)

    if (!pass) {
      throw new ExpectationError(graderResult, 'toolCalls.toHaveResult')
    }

    return this
  }

  /**
   * Get all calls to a specific tool
   */
  getCalls(toolName?: string): readonly ToolCallInfo[] {
    return toolName ? this.toolCalls.filter((tc) => tc.toolName === toolName) : this.toolCalls
  }
}

// ============================================================================
// Main Expect Class
// ============================================================================

export class Expect {
  private negated: boolean = false
  private _toolCalls: ToolCallsExpect

  constructor(
    private result: AIResult,
    private graderResults: GraderResult[],
    private judgeModel?: LanguageModel
  ) {
    this._toolCalls = new ToolCallsExpect(result.toolCalls, result.toolResults, graderResults)
  }

  get not(): Expect {
    const instance = new Expect(this.result, this.graderResults, this.judgeModel)
    instance.negated = !this.negated
    instance._toolCalls = this._toolCalls.not
    return instance
  }

  get toolCalls(): ToolCallsExpect {
    return this.negated ? this._toolCalls.not : this._toolCalls
  }

  toContain(text: string, options?: { caseSensitive?: boolean }): this {
    const caseSensitive = options?.caseSensitive ?? false
    const content = caseSensitive ? this.result.text : this.result.text.toLowerCase()
    const searchText = caseSensitive ? text : text.toLowerCase()

    const found = content.includes(searchText)
    const pass = this.negated ? !found : found

    const reason = this.negated
      ? found
        ? `Expected output NOT to contain "${text}"`
        : `Output does not contain "${text}" (as expected)`
      : found
        ? `Output contains "${text}"`
        : `Expected output to contain "${text}", but it was not found`

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toContain')
    }

    return this
  }

  toMatch(pattern: RegExp | string): this {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    const matches = regex.test(this.result.text)
    const pass = this.negated ? !matches : matches

    const reason = this.negated
      ? matches
        ? `Expected output NOT to match pattern ${regex}`
        : `Output does not match pattern ${regex} (as expected)`
      : matches
        ? `Output matches pattern ${regex}`
        : `Expected output to match pattern ${regex}, but it did not`

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toMatch')
    }

    return this
  }

  toAskQuestions(options?: { min?: number; max?: number }): this {
    const { min = 1, max = Infinity } = options ?? {}
    const questionCount = (this.result.text.match(/\?/g) || []).length

    const inRange = questionCount >= min && questionCount <= max
    const pass = this.negated ? !inRange : inRange

    const reason = this.negated
      ? `Expected NOT to ask ${min}-${max} questions, but found ${questionCount}`
      : inRange
        ? `Output asks ${questionCount} questions (within ${min}-${max})`
        : `Expected ${min}-${max} questions, but found ${questionCount}`

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toAskQuestions')
    }

    return this
  }

  async toPassJudge(criteriaOrOptions: string | JudgeOptions): Promise<this> {
    const options: JudgeOptions =
      typeof criteriaOrOptions === 'string'
        ? { criteria: criteriaOrOptions }
        : criteriaOrOptions

    const { criteria, threshold = 0.5 } = options
    const model = options.judge ?? this.judgeModel

    if (this.result.text.trim().length === 0) {
      const pass = this.negated
      const result: GraderResult = {
        pass,
        score: 0,
        reason: this.negated
          ? 'Output is empty, so it did not pass judge (as expected)'
          : 'Expected output to pass judge, but output was empty',
      }
      this.graderResults.push(result)

      if (!pass) {
        throw new ExpectationError(result, 'toPassJudge')
      }

      return this
    }

    if (!model) {
      throw new Error(
        'No judge model configured. Pass a judge model to evalite() options or to toPassJudge({ judge: model }).'
      )
    }

    // Call the judge model using AI SDK directly
    const judgeResult = await generateText({
      model,
      temperature: options.temperature ?? 0,
      system: `You are an evaluation judge. Analyze the AI output and determine if it meets the given criteria.
Return ONLY a valid JSON object with these fields in this order:
- "reasoning": string explaining the judgment using concrete evidence
- "evidence": array of short quotes or phrases from the output that support the verdict
- "score": number from 0 to 1
- "verdict": "PASS" or "FAIL"

Be objective and precise. Grade the final output, not the path the model may have taken.`,
      prompt: `## Criteria
${criteria}${formatRubric(options.rubric)}

## AI Output to Evaluate
${this.result.text}

## Your Judgment (JSON)`,
    })

    // Parse the judge response
    let judgment: JudgeJudgment
    try {
      const schema = options.schema ?? DefaultJudgeSchema
      judgment = schema.parse(extractJsonObject(judgeResult.text))
    } catch (err) {
      judgment = {
        verdict: 'FAIL',
        score: 0,
        reasoning: `Failed to parse judge response: ${err instanceof Error ? err.message : String(err)}`,
        evidence: [],
      }
    }

    const passesThreshold = judgment.verdict === 'PASS' && judgment.score >= threshold
    const pass = this.negated ? !passesThreshold : passesThreshold

    const judgeUsage = judgeResult.usage
    const evidence =
      judgment.evidence.length > 0
        ? ` Evidence: ${judgment.evidence.map((item) => `"${item}"`).join('; ')}`
        : ''

    const result: GraderResult = {
      pass,
      score: judgment.score,
      reason: this.negated
        ? passesThreshold
          ? `Expected NOT to pass judge (score: ${judgment.score}). ${judgment.reasoning}${evidence}`
          : `Did not pass judge (as expected). ${judgment.reasoning}${evidence}`
        : passesThreshold
          ? `Passed judge (score: ${judgment.score}). ${judgment.reasoning}${evidence}`
          : `Failed judge (score: ${judgment.score}, threshold: ${threshold}). ${judgment.reasoning}${evidence}`,
      usage: {
        inputTokens: judgeUsage.inputTokens ?? 0,
        outputTokens: judgeUsage.outputTokens ?? 0,
        totalTokens: judgeUsage.totalTokens ?? 0,
      },
    }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toPassJudge')
    }

    return this
  }

  to(grader: GraderFn): this | Promise<this> {
    const graderResult = grader(this.result)

    if (graderResult instanceof Promise) {
      return graderResult.then((res) => {
        const pass = this.negated ? !res.pass : res.pass
        const finalResult: GraderResult = {
          ...res,
          pass,
          reason: this.negated && res.pass !== pass ? `(negated) ${res.reason}` : res.reason,
        }
        this.graderResults.push(finalResult)

        if (!pass) {
          throw new ExpectationError(finalResult, 'custom')
        }

        return this
      })
    }

    const pass = this.negated ? !graderResult.pass : graderResult.pass
    const finalResult: GraderResult = {
      ...graderResult,
      pass,
      reason:
        this.negated && graderResult.pass !== pass
          ? `(negated) ${graderResult.reason}`
          : graderResult.reason,
    }
    this.graderResults.push(finalResult)

    if (!pass) {
      throw new ExpectationError(finalResult, 'custom')
    }

    return this
  }
}

export function createExpect(
  result: AIResult,
  graderResults: GraderResult[],
  judgeModel?: LanguageModel
): Expect {
  return new Expect(result, graderResults, judgeModel)
}
