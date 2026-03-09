import type { GraderFn } from '../types.js'

export type { GraderFn }

export interface CustomGrader {
  name: string
  fn: GraderFn
}

/**
 * Define a custom grader for use with expect().to()
 *
 * @example
 * const noPII = defineGrader('noPII', (result) => {
 *   const piiPattern = /\b\d{3}-\d{2}-\d{4}\b/
 *   const hasPII = piiPattern.test(result.text)
 *   return {
 *     pass: !hasPII,
 *     reason: hasPII ? 'Response contains PII' : 'No PII detected',
 *   }
 * })
 *
 * // Usage in an eval
 * expect(result).to(noPII)
 */
export function defineGrader(name: string, fn: GraderFn): GraderFn {
  // Attach name for debugging purposes
  Object.defineProperty(fn, 'name', { value: name })
  return fn
}
