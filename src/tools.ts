/**
 * Tool testing utilities for agentevals
 *
 * These helpers work alongside AI SDK's native `tool()` function.
 * Use them to create mock/spy executors for testing tool call behavior.
 */

/**
 * Create a mock tool executor that records calls and returns a specified value.
 * Use this with AI SDK's `tool()` function.
 *
 * @example
 * import { tool } from 'ai'
 * import { z } from 'zod'
 * import { createMockExecutor } from '@nem035/agentevals'
 *
 * const mockExecute = createMockExecutor({ temperature: 72, unit: 'F' })
 *
 * const weatherTool = tool({
 *   description: 'Get weather',
 *   inputSchema: z.object({ location: z.string() }),
 *   execute: mockExecute,
 * })
 *
 * // After running the eval...
 * console.log(mockExecute.calls) // [{ location: 'Tokyo' }]
 */
export function createMockExecutor<TArgs = Record<string, unknown>, TResult = unknown>(
  returnValue: TResult
): ((args: TArgs) => TResult) & { calls: TArgs[] } {
  const calls: TArgs[] = []

  const executor = (args: TArgs): TResult => {
    calls.push(args)
    return returnValue
  }

  executor.calls = calls

  return executor
}

/**
 * Create a spy executor that wraps an existing executor and records calls.
 * Use this with AI SDK's `tool()` function.
 *
 * @example
 * import { tool } from 'ai'
 * import { z } from 'zod'
 * import { createSpyExecutor } from '@nem035/agentevals'
 *
 * const spy = createSpyExecutor(async ({ location }) => {
 *   return fetchWeather(location)
 * })
 *
 * const weatherTool = tool({
 *   description: 'Get weather',
 *   inputSchema: z.object({ location: z.string() }),
 *   execute: spy,
 * })
 *
 * // After running the eval...
 * console.log(spy.calls)   // [{ location: 'Tokyo' }]
 * console.log(spy.results) // [{ temperature: 72 }]
 */
export function createSpyExecutor<TArgs = Record<string, unknown>, TResult = unknown>(
  executor: (args: TArgs) => TResult | Promise<TResult>
): ((args: TArgs) => TResult | Promise<TResult>) & {
  calls: TArgs[]
  results: TResult[]
} {
  const calls: TArgs[] = []
  const results: TResult[] = []

  const spy = (args: TArgs): TResult | Promise<TResult> => {
    calls.push(args)
    const result = executor(args)

    if (result instanceof Promise) {
      return result.then((r) => {
        results.push(r)
        return r
      })
    }

    results.push(result)
    return result
  }

  spy.calls = calls
  spy.results = results

  return spy
}
