/**
 * Core types for agentevals
 *
 * Designed to work natively with AI SDK (ai package) types.
 * Users bring their own models and call generateText/streamText directly.
 */

import type { LanguageModel } from 'ai'
import type { z } from 'zod'

// ============================================================================
// AI Result Interface
// ============================================================================

/**
 * Minimal interface for what we need from an AI SDK result.
 * Works with both GenerateTextResult (sync props) and
 * StreamTextResult (PromiseLike props) after awaiting.
 */
export interface AIResult {
  /** The generated text */
  text: string
  /** Tool calls made during generation */
  toolCalls: readonly ToolCallInfo[]
  /** Tool results from execution */
  toolResults: readonly ToolResultInfo[]
  /** Token usage information */
  usage: UsageInfo
  /** Total usage across all steps */
  totalUsage: UsageInfo
  /** Step-by-step details */
  steps: readonly StepInfo[]
}

export interface ToolCallInfo {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  input: unknown
}

export interface ToolResultInfo {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  input: unknown
  output: unknown
}

export interface UsageInfo {
  inputTokens: number | undefined
  outputTokens: number | undefined
  totalTokens: number | undefined
}

export interface StepInfo {
  text: string
  toolCalls: readonly ToolCallInfo[]
  toolResults: readonly ToolResultInfo[]
  usage: UsageInfo
}

// ============================================================================
// Grading
// ============================================================================

export interface GraderResult {
  pass: boolean
  reason: string
  score?: number
  usage?: UsageInfo
  costUsd?: number
}

export type GraderFn = (result: AIResult) => GraderResult | Promise<GraderResult>

// ============================================================================
// Eval Structure
// ============================================================================

export interface EvaliteOptions {
  /** LLM model to use as a judge for toPassJudge() assertions */
  judge?: LanguageModel
  /** Timeout in milliseconds for this eval */
  timeout?: number
  /** Short labels for filtering, reporting, or grouping eval intent */
  tags?: string[]
  /** Human-readable context shown by reporters and JSON output */
  description?: string
  /** Extra user-defined metadata preserved on registered tasks/groups */
  metadata?: EvalMetadata
}

export interface EvalContext {
  /** Create assertions on an AI SDK result */
  expect: (result: AIResult) => ExpectInterface
}

export type EvalFn = (context: EvalContext) => void | Promise<void>
export type EvalCaseName<TCase> = string | ((testCase: TCase, index: number) => string)
export type EvalCaseFn<TCase> = (
  testCase: TCase,
  context: EvalContext
) => void | Promise<void>

export interface EvaliteEach<TCase> {
  (name: EvalCaseName<TCase>, fn: EvalCaseFn<TCase>): void
  (name: EvalCaseName<TCase>, options: EvaliteOptions, fn: EvalCaseFn<TCase>): void
}

export interface EvaliteGroupFn {
  (name: string, fn: () => void): void
  (name: string, options: EvaliteOptions, fn: () => void): void
}

export interface EvaliteApi {
  (name: string, fn: EvalFn): void
  (name: string, options: EvaliteOptions, fn: EvalFn): void
  group: EvaliteGroupFn
  each: <TCase>(cases: readonly TCase[]) => EvaliteEach<TCase>
}

export interface EvalMetadata {
  [key: string]: unknown
}

export interface EvalTask {
  name: string
  fn: EvalFn
  options: EvaliteOptions
  group?: string
  file?: string
}

export interface EvalGroup {
  name: string
  tasks: EvalTask[]
  options: EvaliteOptions
}

// ============================================================================
// Expect Interfaces
// ============================================================================

export interface ExpectInterface {
  not: ExpectInterface
  toolCalls: ToolCallsExpectInterface
  /** Assert the text contains a substring (case-insensitive by default) */
  toContain(text: string, options?: { caseSensitive?: boolean }): ExpectInterface
  /** Assert the text matches a regex pattern */
  toMatch(pattern: RegExp | string): ExpectInterface
  /** Assert the response asks questions */
  toAskQuestions(options?: { min?: number; max?: number }): ExpectInterface
  /** Assert via LLM-as-judge evaluation */
  toPassJudge(criteriaOrOptions: string | JudgeOptions): Promise<ExpectInterface>
  /** Assert via a custom grader function */
  to(grader: GraderFn): ExpectInterface | Promise<ExpectInterface>
}

export interface ToolCallsExpectInterface {
  not: ToolCallsExpectInterface
  toHaveBeenCalled(): ToolCallsExpectInterface
  toHaveCallCount(count: number): ToolCallsExpectInterface
  toHaveCallCount(toolName: string, count: number): ToolCallsExpectInterface
  toInclude(toolName: string): ToolCallsExpectInterface
  toHaveArgs(toolName: string, expectedArgs: Record<string, unknown>): ToolCallsExpectInterface
  toHaveResult(toolName: string, expectedResult: unknown): ToolCallsExpectInterface
  getCalls(toolName?: string): readonly ToolCallInfo[]
}

export interface JudgeOptions {
  criteria: string
  threshold?: number
  /** Override the judge model for this specific assertion */
  judge?: LanguageModel
  /** Sampling temperature for the judge call. Defaults to 0 for stable evals. */
  temperature?: number
  /** Additional rubric reminders to include after the core criteria. */
  rubric?: string | string[]
  /** Override the structured judgment schema used to validate the judge output. */
  schema?: z.ZodType<JudgeJudgment>
}

export interface JudgeJudgment {
  /** Reasoning comes first to encourage an evidence-backed verdict. */
  reasoning: string
  /** Specific phrases from the output that support the verdict. */
  evidence: string[]
  /** Numeric confidence/quality score from 0 to 1. */
  score: number
  /** Final verdict after considering the reasoning and evidence. */
  verdict: 'PASS' | 'FAIL'
}

// ============================================================================
// Execution Results
// ============================================================================

export type TaskStatus = 'passed' | 'failed' | 'skipped' | 'error'

export interface TrialResult {
  status: TaskStatus
  duration: number
  graderResults: GraderResult[]
  error?: string
  usage: UsageInfo
  costUsd: number
}

export interface TaskResult {
  name: string
  group?: string
  file?: string
  tags?: string[]
  description?: string
  metadata?: EvalMetadata
  status: TaskStatus
  trials: TrialResult[]
  duration: number
}

export interface GroupResult {
  name: string
  tags?: string[]
  description?: string
  metadata?: EvalMetadata
  tasks: TaskResult[]
  duration: number
}

export interface RunResult {
  success: boolean
  groups: GroupResult[]
  ungrouped: TaskResult[]
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
  }
  usage: UsageInfo
  costUsd: number
  duration: number
}

// ============================================================================
// Configuration
// ============================================================================

export interface EvaliteConfig {
  include?: string[]
  exclude?: string[]
  trials?: number
  timeout?: number
  parallel?: boolean
  maxConcurrency?: number
  reporters?: ('console' | 'json')[]
  maxCost?: number
}
