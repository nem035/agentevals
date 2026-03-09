import type {
  AIResult,
  EvalContext,
  EvaliteOptions,
  GraderResult,
} from '../types.js'
import { createExpect, Expect } from '../expect/index.js'

/**
 * Creates the eval context that gets passed to each eval function.
 *
 * In the new API, users call AI SDK functions directly (generateText, streamText).
 * The context only provides the `expect()` function for making assertions.
 */
export function createEvalContext(
  evalOptions: EvaliteOptions,
  groupOptions: EvaliteOptions,
  graderResults: GraderResult[]
): EvalContext & { expect: (result: AIResult) => Expect } {
  // Resolve judge model: eval-level overrides group-level
  const judgeModel = evalOptions.judge ?? groupOptions.judge

  return {
    expect: (result: AIResult) => createExpect(result, graderResults, judgeModel),
  }
}
