import type { EvaliteOptions } from '../types.js'

export function mergeEvalOptions(
  base: EvaliteOptions = {},
  override: EvaliteOptions = {}
): EvaliteOptions {
  const tags = [...(base.tags ?? []), ...(override.tags ?? [])]
  const metadata = {
    ...(base.metadata ?? {}),
    ...(override.metadata ?? {}),
  }

  return {
    ...base,
    ...override,
    ...(tags.length > 0 ? { tags } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  }
}
