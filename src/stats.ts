/**
 * The two pieces of statistics agentevals uses, both small enough to read.
 */

export interface LuckCheck {
  onlyA: number
  onlyB: number
  /** Cases where the two runs disagree. */
  disagreements: number
  /** onlyB - onlyA: always equals B's total minus A's total on these cases. */
  gap: number
  /** Chance that fair coin tosses split at least this lopsided, either way (exact McNemar test). */
  chance: number
  /** chance < cutoff (default 0.05). */
  probablyReal: boolean
}

/**
 * If nothing changed between two runs, each case they disagree on is a fair
 * coin toss between them. This adds up the chance of every split at least as
 * lopsided as the one observed.
 */
export function luckCheck(onlyA: number, onlyB: number, cutoff = 0.05): LuckCheck {
  const n = onlyA + onlyB
  const gap = Math.abs(onlyA - onlyB)
  let chanceOfSplit = 0.5 ** n // chance that k = 0 tosses favor B
  let total = 0
  for (let k = 0; k <= n; k++) {
    if (Math.abs(n - 2 * k) >= gap) total += chanceOfSplit
    chanceOfSplit = (chanceOfSplit * (n - k)) / (k + 1)
  }
  const chance = n === 0 ? 1 : Math.min(1, total)
  return { onlyA, onlyB, disagreements: n, gap: onlyB - onlyA, chance, probablyReal: chance < cutoff }
}

export interface ScoreRange {
  score: number
  low: number
  high: number
}

/**
 * Mean of per-case pass rates with a 95% range computed over cases, so a case
 * run ten times still counts once. Returns undefined for fewer than 2 cases.
 */
export function scoreRange(passRatePerCase: readonly number[]): ScoreRange | undefined {
  const n = passRatePerCase.length
  if (n === 0) return undefined
  const score = passRatePerCase.reduce((s, x) => s + x, 0) / n
  if (n < 2) return { score, low: score, high: score }
  const variance = passRatePerCase.reduce((s, x) => s + (x - score) ** 2, 0) / (n - 1)
  const giveOrTake = 1.96 * Math.sqrt(variance / n)
  return { score, low: Math.max(0, score - giveOrTake), high: Math.min(1, score + giveOrTake) }
}

/** A case's majority result across trials: true, false, or undefined on a tie. */
export function majority(passRate: number | undefined): boolean | undefined {
  if (passRate === undefined || passRate === 0.5) return undefined
  return passRate > 0.5
}
