import type { PokerResult } from './data'

const STREET_CARDS: Record<string, number> = { preflop: 0, flop: 3, turn: 4, river: 5, showdown: 5 }

export interface Frame {
  hand: number            // index into hands
  action: number          // index into that hand's actions; -1 = hand start
  text: string
  pot: number
  boardShown: number
  chips: Record<string, number>
  showdown: boolean
  handOver: boolean
}

/** One frame per action across all hands, plus a start frame per hand. */
export function buildFrames(d: PokerResult): Frame[] {
  const name = (id: string) => d.bots.find(b => b.id === id)?.name ?? id
  const frames: Frame[] = []
  let chips: Record<string, number> = Object.fromEntries(d.bots.map(b => [b.id, b.startChips]))
  d.hands.forEach((h, hi) => {
    frames.push({ hand: hi, action: -1, text: `Hand ${h.n} — cards dealt`, pot: 0, boardShown: 0, chips, showdown: false, handOver: false })
    h.actions.forEach((a, ai) => {
      const last = ai === h.actions.length - 1
      const amt = a.amount > 0 && !/fold|check|show/i.test(a.action) ? ` ${a.amount}` : ''
      const after = last ? { ...chips, ...h.chipsAfter } : chips
      frames.push({
        hand: hi, action: ai, text: `${name(a.botId)} ${a.action}${amt}${last && h.winnerId ? ` — ${name(h.winnerId)} wins the pot` : ''}`,
        pot: a.pot, boardShown: Math.min(h.board.length, STREET_CARDS[a.street.toLowerCase()] ?? 0),
        chips: after, showdown: /showdown/i.test(a.street), handOver: last,
      })
      if (last) chips = after
    })
  })
  return frames
}
