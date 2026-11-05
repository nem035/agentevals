/**
 * Core types for agentevals.
 *
 * The model: an eval is a list of cases, a task (your production code), and
 * graders. Each case runs one or more trials. A trial either measured the
 * model (status "ok", graded pass or fail) or it broke (timed out, errored,
 * got cut off, or the grader itself failed) and is kept out of the score.
 */

// ---------------------------------------------------------------------------
// Defining evals
// ---------------------------------------------------------------------------

/** One input with what you expect back. `id` must be stable across runs. */
export interface Case<Input = unknown, Expected = unknown> {
  id: string
  input: Input
  expected?: Expected
  tags?: string[]
}

export interface TaskContext {
  /** Aborted when the trial times out. Pass it to your model call. */
  signal: AbortSignal
  /** 0-based trial number for this case. */
  trial: number
  caseId: string
}

/** The code under test. Call your production code path from here. */
export type Task<Input = unknown, Output = unknown> = (input: Input, ctx: TaskContext) => Output | Promise<Output>

/** What a grader returns. `true`/`false` is shorthand for `{ pass }`. */
export interface Verdict {
  pass: boolean
  reason?: string
  /** Quotes from the output that support the verdict. */
  evidence?: string[]
}

export interface GradeContext {
  /** The judge model from config or the eval, if any. */
  judgeModel?: JudgeModel
}

export interface Grader<Output = any, C extends Case = Case<any, any>> {
  /** Name the grader after what it actually checks. It appears in every failure. */
  name: string
  /** "judge" graders are model-based and can be checked with `check-judge`. */
  kind: 'code' | 'judge'
  grade: (output: Output, testCase: C, ctx: GradeContext) => Verdict | boolean | Promise<Verdict | boolean>
}

/** Sends one prompt to a model and returns its text. Bring any client. */
export type JudgeModel = (prompt: string) => Promise<string>

export interface EvalOptions {
  /** Trials per case. Reported as a per-case pass rate. Default 1. */
  trials?: number
  /** Share of cases (by stable hash of id) held out as a test set, e.g. 0.3. */
  holdout?: number
  /** Gate: every case must pass every trial. Default false (scored). */
  gate?: boolean
  /** Per-trial timeout in ms. Default 60_000. */
  timeoutMs?: number
  /** Fail the run if more than this share of trials broke. Default 0.05. */
  maxBroken?: number
  /** Optional minimum score (0 to 1) for the run to succeed. */
  minScore?: number
  /** Judge model for this eval. Overrides the config's judge. */
  judgeModel?: JudgeModel
}

export interface EvalDefinition<Input = any, Output = any, Expected = any> extends EvalOptions {
  name: string
  /** Cases, or a path to a .json / .jsonl file of cases (relative to the eval file). */
  cases: readonly Case<Input, Expected>[] | string
  /** The code under test. Use `variants` instead to compare several. */
  task?: Task<Input, Output>
  /** Several versions of the task, run on the same cases and compared. The first is the baseline. */
  variants?: Record<string, Task<Input, Output>>
  graders: readonly Grader<Output, Case<Input, Expected>>[]
}

export interface Config extends EvalOptions {
  /** Globs for eval files. Default ["**\/*.eval.ts", "**\/*.eval.js"]. */
  include?: string[]
  exclude?: string[]
  /** Trials run at the same time. Default 5. */
  concurrency?: number
  /** Where runs are saved. Default ".agentevals/runs". */
  outDir?: string
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type BrokenReason = 'timed out' | 'error' | 'cut off' | 'grader error'

export type TrialStatus = 'pass' | 'fail' | 'broken'

export interface GraderOutcome extends Verdict {
  grader: string
  kind: 'code' | 'judge'
}

export interface TrialRecord {
  trial: number
  status: TrialStatus
  /** Why the trial didn't measure the model. Only when status is "broken". */
  broken?: BrokenReason
  error?: string
  /** The task's output, normalized to plain JSON so it can be regraded later. */
  output?: unknown
  verdicts: GraderOutcome[]
  durationMs: number
}

export type Split = 'train' | 'test'

export interface CaseRecord {
  id: string
  split: Split
  tags?: string[]
  input: unknown
  expected?: unknown
  trials: TrialRecord[]
}

export interface CaseSummary {
  id: string
  split: Split
  /** Trials that measured the model. */
  ran: number
  passed: number
  broken: number
  /** passed / ran, or undefined when every trial broke. */
  passRate?: number
}

export interface ScoreSummary {
  /** Cases with at least one trial that measured the model. */
  cases: number
  /** Mean per-case pass rate, 0 to 1. */
  score?: number
  /** 95% range, counting each case once however many trials it had. */
  low?: number
  high?: number
  /** Cases that passed some trials and failed others. */
  flaky: string[]
}

export interface RunRecord {
  version: 1
  eval: string
  variant?: string
  label?: string
  startedAt: string
  durationMs: number
  options: Required<Pick<EvalOptions, 'trials' | 'gate' | 'timeoutMs' | 'maxBroken'>> & Pick<EvalOptions, 'holdout' | 'minScore'>
  cases: CaseRecord[]
}

export interface RunSummary {
  eval: string
  variant?: string
  trials: { total: number; passed: number; failed: number; broken: number; byReason: Partial<Record<BrokenReason, number>> }
  all: ScoreSummary
  train?: ScoreSummary
  test?: ScoreSummary
  /** Gate failures, too many broken trials, or a missed minScore. Empty means the run succeeded. */
  problems: string[]
  ok: boolean
}
