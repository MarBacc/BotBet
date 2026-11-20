import type { PokerResult } from './data'
import type { Frame } from './timeline'
import { Card } from './Cards'
import { personality } from './words'

/** The table. The bots' own cards are ALWAYS face-down: only the shared table cards are shown. */
export function Table({ d, f, big = false }: { d: PokerResult; f: Frame; big?: boolean }) {
  const hand = d.hands[f.hand]
  const totalChips = d.bots.reduce((s, b) => s + (b.startChips || 0), 0) || 1
  return (
    <div className={`ptable${big ? ' big' : ''}`} aria-label={`Hand ${hand.n}, prize pool ${f.pot} chips`}>
      {d.bots.map((b, i) => {
        const chips = f.chips[b.id] ?? 0
        return (
          <div key={b.id} className={`seat s${i}${f.actor === b.id ? ' acting' : ''}${f.handOver && hand.winnerId === b.id ? ' won' : ''}`}>
            <div className="seat-who">
              <div className="seat-name">{b.name}</div>
              <div className="seat-strat">{personality(b)}</div>
            </div>
            <div className="seat-cards" aria-label="two secret cards, face down">{[0, 1].map(k => <Card key={k} hidden big={big} />)}</div>
            <div className="seat-chips">
              <div className="chipbar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, (chips / totalChips) * 100))}%` }} /></div>
              <b>{chips} chips</b>
            </div>
          </div>
        )
      })}
      <div className="felt">
        <div className="pboard" aria-label="shared table cards">{[0, 1, 2, 3, 4].map(k => <Card key={k} c={k < f.boardShown ? hand.board[k] : undefined} big={big} />)}</div>
        <div className="pot">Prize pool: {f.pot} chips</div>
        <div className="paction" aria-live="polite">{f.text}</div>
      </div>
    </div>
  )
}
