import type { Case, Grader, GradeContext, Verdict } from './types.js'
import { textOf, toolCallsOf } from './output.js'

/**
 * Define a grader. Name it after what the check actually does: the name is
 * what people read in a failure, and "wrongDate" for a text comparison
 * becomes "the model gets dates wrong" in someone's head.
 */
export function grader<Output = any, C extends Case = Case<any, any>>(
  name: string,
  grade: (output: Output, testCase: C, ctx: GradeContext) => Verdict | boolean | Promise<Verdict | boolean>,
): Grader<Output, C> {
  return { name, kind: 'code', grade }
}

/** Deep-equals the case's `expected`, or a value derived from the case. */
export function equals<C extends Case = Case<any, any>>(
  expected: (testCase: C) => unknown = (c) => c.expected,
  name = 'equalsExpected',
): Grader<unknown, C> {
  return grader(name, (output, c) => {
    const want = expected(c)
    const pass = deepEqual(output, want)
    return { pass, reason: pass ? undefined : `expected ${short(want)}, got ${short(output)}` }
  })
}

/** The output text contains a string (case-insensitive unless asked). */
export function includes<C extends Case = Case<any, any>>(
  text: string | ((testCase: C) => string),
  opts: { caseSensitive?: boolean; name?: string } = {},
): Grader<unknown, C> {
  const label = typeof text === 'string' ? `includes ${JSON.stringify(text)}` : 'includesExpected'
  return grader(opts.name ?? label, (output, c) => {
    const want = typeof text === 'function' ? text(c) : text
    const have = textOf(output)
    const pass = opts.caseSensitive ? have.includes(want) : have.toLowerCase().includes(want.toLowerCase())
    return { pass, reason: pass ? undefined : `text does not include ${JSON.stringify(want)}` }
  })
}

/** The output text matches a regular expression. */
export function matches(pattern: RegExp, name = `matches ${pattern}`): Grader {
  return grader(name, (output) => {
    const pass = pattern.test(textOf(output))
    return { pass, reason: pass ? undefined : `text does not match ${pattern}` }
  })
}

/** A tool was called, optionally with input containing these fields, optionally a set number of times. */
export function toolCalled(toolName: string, opts: { input?: Record<string, unknown>; times?: number; name?: string } = {}): Grader {
  const label = opts.name ?? `called ${toolName}${opts.input ? ` with ${short(opts.input)}` : ''}`
  return grader(label, (output) => {
    const calls = toolCallsOf(output).filter((c) => c.toolName === toolName)
    const matching = opts.input ? calls.filter((c) => partialMatch(c.input, opts.input)) : calls
    if (opts.times !== undefined) {
      const pass = matching.length === opts.times
      return { pass, reason: pass ? undefined : `${toolName} matched ${matching.length} times, expected ${opts.times}` }
    }
    const pass = matching.length > 0
    if (pass) return { pass }
    return {
      pass,
      reason: calls.length === 0 ? `${toolName} was not called` : `${toolName} was called, but not with ${short(opts.input)}`,
    }
  })
}

/** No tools were called. */
export function noToolCalls(name = 'calledNoTools'): Grader {
  return grader(name, (output) => {
    const calls = toolCallsOf(output)
    return { pass: calls.length === 0, reason: calls.length ? `called ${calls.map((c) => c.toolName).join(', ')}` : undefined }
  })
}

/** Validates the output with a schema that has `safeParse` (Zod, Valibot adapters, and similar). */
export function schema(s: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }, name = 'matchesSchema'): Grader {
  return grader(name, (output) => {
    const r = s.safeParse(output)
    return { pass: r.success, reason: r.success ? undefined : String((r.error as { message?: string })?.message ?? r.error) }
  })
}

/** Passes when the wrapped grader fails. Useful for cases that must not trigger a behavior. */
export function not<O, C extends Case>(g: Grader<O, C>, name = `not ${g.name}`): Grader<O, C> {
  return {
    name,
    kind: g.kind,
    grade: async (output, c, ctx) => {
      const v = await g.grade(output, c, ctx)
      const pass = typeof v === 'boolean' ? v : v.pass
      return { pass: !pass, reason: pass ? `${g.name} passed` : undefined }
    },
  }
}

// ---------------------------------------------------------------------------

function short(v: unknown): string {
  const s = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v)
  return s.length > 80 ? `${s.slice(0, 77)}...` : s
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

function partialMatch(actual: unknown, want: unknown): boolean {
  if (want instanceof RegExp) return typeof actual === 'string' && want.test(actual)
  if (typeof want !== 'object' || want === null) return Object.is(actual, want)
  if (typeof actual !== 'object' || actual === null) return false
  return Object.entries(want).every(([k, v]) => partialMatch((actual as Record<string, unknown>)[k], v))
}
