// A stand-in for a real model so the examples run without API keys.
// `chance(key, p)` is true for a share p of keys, and the same key always gives
// the same answer, so reruns are repeatable while different trials still vary.
export function chance(key: string, p: number): boolean {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 2 ** 32 < p
}

/** The shape AI SDK `generateText` returns, reduced to what graders read. */
export function sdkResult(text: string, toolCalls: { toolName: string; input: unknown }[] = []) {
  return { text, finishReason: 'stop', steps: [{ toolCalls }], toolCalls }
}
