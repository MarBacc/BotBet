import type { PokerResult } from './data'
import type { Frame } from './timeline'
import { Card } from './Cards'

export function Table({ d, f, big = false }: { d: PokerResult; f: Frame; big?: boolean }) {
  const hand = d.hands[f.hand]
  const actor = f.action >= 0 ? hand.actions[f.action].botId : null
  return (
    <div className={`ptable${big ? ' big' : ''}`} aria-label={`Hand ${hand.n}, pot ${f.pot} chips`}>
      {d.bots.map((b, i) => {
        const hole = hand.holeCards[b.id] ?? []
        return (
          <div key={b.id} className={`seat s${i}${actor === b.id ? ' acting' : ''}${f.handOver && hand.winnerId === b.id ? ' won' : ''}`}>
            <div className="seat-name">{b.name}</div>
            <div className="seat-strat">{b.strategy}</div>
            <div className="seat-cards">{[0, 1].map(k => <Card key={k} c={hole[k]} big={big} />)}</div>
            <div className="seat-chips">{f.chips[b.id] ?? 0} chips</div>
          </div>
        )
      })}
      <div className="felt">
        <div className="pboard">{[0, 1, 2, 3, 4].map(k => <Card key={k} c={k < f.boardShown ? hand.board[k] : undefined} big={big} />)}</div>
        <div className="pot">Pot {f.pot}</div>
        <div className="paction" aria-live="polite">{f.text}</div>
      </div>
    </div>
  )
}
