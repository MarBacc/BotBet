const SUIT: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_NAME: Record<string, string> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' }
const RANK_NAME: Record<string, string> = { T: '10', J: 'jack', Q: 'queen', K: 'king', A: 'ace' }

export function Card({ c, hidden = false, big = false }: { c?: string; hidden?: boolean; big?: boolean }) {
  if (!c || hidden) return <span className={`pcard back${big ? ' big' : ''}`} role="img" aria-label={c ? 'face-down card' : 'empty card slot'} />
  const rank = c[0] === 'T' ? '10' : c[0]
  const suit = c[1]?.toLowerCase() ?? ''
  return (
    <span className={`pcard${suit === 'h' || suit === 'd' ? ' red' : ''}${big ? ' big' : ''}`} role="img" aria-label={`${RANK_NAME[c[0]] ?? rank} of ${SUIT_NAME[suit] ?? suit}`}>
      <b>{rank}</b><i aria-hidden="true">{SUIT[suit] ?? '?'}</i>
    </span>
  )
}
