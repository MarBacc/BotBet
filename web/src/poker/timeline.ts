import type { PokerResult } from './data'
import { say, PACE } from './words'

const STREET_CARDS: Record<string, number> = { preflop: 0, flop: 3, turn: 4, river: 5, showdown: 5 }

export interface Frame {
  hand: number            // index into hands
  action: number          // index into that hand's actions; -1 = hand start
  actor: string | null
  text: string
  pot: number
  boardShown: number
  chips: Record<string, number>
  handOver: boolean
  delay: number           // ms to wait AFTER showing this frame (Normal speed)
}

/** One frame per action across all hands, plus a start frame per hand. Plain English only. */
export function buildFrames(d: PokerResult): Frame[] {
  const name = (id: string) => d.bots.find(b => b.id === id)?.name ?? id
  const frames: Frame[] = []
  let chips: Record<string, number> = Object.fromEntries(d.bots.map(b => [b.id, b.startChips]))
  d.hands.forEach((h, hi) => {
    frames.push({ hand: hi, action: -1, actor: null, text: `Hand ${h.n}: each bot gets two secret cards.`, pot: 0, boardShown: 0, chips, handOver: false, delay: PACE.action })
    let shown = 0
    const real = h.actions.filter(a => !/showdown/i.test(a.street))
    const folded = real.find(a => /fold/i.test(a.action))
    const compared = !folded && h.actions.some(a => /showdown/i.test(a.street))
    real.forEach((a, ai) => {
      const last = ai === real.length - 1
      const nowShown = Math.min(h.board.length, STREET_CARDS[a.street.toLowerCase()] ?? 0)
      const newCards = nowShown > shown
      shown = nowShown
      const amt = a.amount > 0 && !/fold|check|call|post/i.test(a.action) ? ` (${a.amount} chips)` : ''
      let text = `${name(a.botId)} ${say(a.action)}${amt}.`
      const after = last ? { ...chips, ...h.chipsAfter } : chips
      if (last) {
        const w = h.winnerId ? name(h.winnerId) : ''
        const pot = a.pot
        text = !w ? `${text} It's a tie, so the prize pool is shared.`
          : folded ? `${name(folded.botId)} gives up, so ${w} takes the prize pool (${pot} chips).`
          : `Cards compared: ${w} wins this hand with the stronger hand and takes ${pot} chips.`
        if (compared) shown = h.board.length
      }
      frames.push({
        hand: hi, action: ai, actor: a.botId, text, pot: a.pot, boardShown: last && compared ? h.board.length : shown,
        chips: after, handOver: last, delay: last ? PACE.handEnd : newCards ? PACE.newCards : PACE.action,
      })
      if (last) chips = after
    })
  })
  return frames
}
