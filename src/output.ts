/**
 * Task outputs are stored as plain JSON so a run can be regraded later and
 * graders see the same value whether they run live or on a saved run.
 *
 * Results that look like a model SDK response (an object with `text` plus
 * `finishReason`, `steps` or `toolCalls`) are reduced to the fields evals use.
 * Anything else is kept as-is, minus functions and cycles.
 */

export interface ToolCall {
  toolName: string
  input: unknown
}

export interface ModelOutput {
  text: string
  toolCalls: ToolCall[]
  finishReason?: string
  usage?: { inputTokens?: number; outputTokens?: number }
}

type AnyRecord = Record<string, unknown>

const isRecord = (v: unknown): v is AnyRecord => typeof v === 'object' && v !== null && !Array.isArray(v)

function looksLikeModelResult(v: unknown): v is AnyRecord {
  return isRecord(v) && typeof v.text === 'string' && ('finishReason' in v || 'steps' in v || 'toolCalls' in v)
}

function readToolCalls(v: AnyRecord): ToolCall[] {
  const calls: ToolCall[] = []
  const push = (list: unknown) => {
    if (!Array.isArray(list)) return
    for (const c of list) {
      if (isRecord(c) && typeof c.toolName === 'string') calls.push({ toolName: c.toolName, input: c.input ?? c.args })
    }
  }
  if (Array.isArray(v.steps) && v.steps.length > 0) {
    for (const step of v.steps) if (isRecord(step)) push(step.toolCalls)
  } else {
    push(v.toolCalls)
  }
  return calls
}

export function normalizeOutput(raw: unknown): unknown {
  if (looksLikeModelResult(raw)) {
    const usage = isRecord(raw.totalUsage) ? raw.totalUsage : isRecord(raw.usage) ? raw.usage : undefined
    const out: ModelOutput = {
      text: raw.text as string,
      toolCalls: readToolCalls(raw),
      finishReason: typeof raw.finishReason === 'string' ? raw.finishReason : undefined,
      usage: usage
        ? { inputTokens: usage.inputTokens as number | undefined, outputTokens: usage.outputTokens as number | undefined }
        : undefined,
    }
    return toJson(out)
  }
  return toJson(raw)
}

function toJson(v: unknown): unknown {
  if (v === undefined) return null
  const seen = new WeakSet<object>()
  return JSON.parse(
    JSON.stringify(v, (_k, value) => {
      if (typeof value === 'function') return undefined
      if (typeof value === 'bigint') return value.toString()
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return undefined
        seen.add(value)
      }
      return value
    }) ?? 'null',
  )
}

/** True when the output says the model stopped at its output limit. */
export function wasCutOff(output: unknown): boolean {
  return isRecord(output) && (output.finishReason === 'length' || output.stopReason === 'max_tokens')
}

/** The text of an output: the string itself, or its `text` field. */
export function textOf(output: unknown): string {
  if (typeof output === 'string') return output
  if (isRecord(output) && typeof output.text === 'string') return output.text
  return JSON.stringify(output)
}

/** Tool calls recorded on an output, if any. */
export function toolCallsOf(output: unknown): ToolCall[] {
  if (isRecord(output) && Array.isArray(output.toolCalls)) {
    return output.toolCalls.filter((c): c is ToolCall => isRecord(c) && typeof c.toolName === 'string')
  }
  return []
}
