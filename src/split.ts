import type { Split } from './types.js'

/**
 * Assign a case to the train or test set from a hash of its id, so the split
 * is random but never changes between runs, machines or reorderings, and new
 * cases don't reshuffle old ones.
 */
export function splitOf(caseId: string, holdout: number | undefined): Split {
  if (!holdout) return 'train'
  return hashToUnit(caseId) < holdout ? 'test' : 'train'
}

/** FNV-1a 32-bit hash mapped to [0, 1). */
function hashToUnit(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 0x100000000
}
