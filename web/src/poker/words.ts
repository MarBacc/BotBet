/** Plain-English wording for the poker view (no jargon, no hex). */
const ACTION: Record<string, string> = {
  fold: 'gives up this hand', call: 'matches the bet', raise: 'raises the bet', check: 'passes', bet: 'bets',
  'posts blind': 'puts in a starting bet', post: 'puts in a starting bet', 'all-in': 'bets everything',
}
export const say = (action: string) => ACTION[action.toLowerCase()] ?? action

const PERSONALITY: [RegExp, string][] = [
  [/nit|tight/i, 'Plays only strong hands'],
  [/maniac|loose|aggress/i, 'Bets aggressively and bluffs a lot'],
  [/theory|chart|book/i, 'Follows poker theory charts'],
]
/** One-line personality from the bot id/name/strategy. */
export function personality(b: { id: string; name: string; strategy?: string }): string {
  for (const [re, text] of PERSONALITY) if (re.test(b.id) || re.test(b.name)) return text
  for (const [re, text] of PERSONALITY) if (b.strategy && re.test(b.strategy)) return text
  return 'Plays its own style'
}

/** Normal-speed delays (ms). */
export const PACE = { action: 1200, newCards: 1500, handEnd: 2500 }
export type Speed = 'slow' | 'normal' | 'fast'
export const SPEED: Record<Speed, number> = { slow: 1.6, normal: 1, fast: 0.45 }
