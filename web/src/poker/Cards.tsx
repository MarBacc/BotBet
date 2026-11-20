const SUIT: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_NAME: Record<string, string> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' }
const RANK_NAME: Record<string, string> = { T: '10', J: 'jack', Q: 'queen', K: 'king', A: 'ace' }

export function Card({ c, hidden = false, big = false }: { c?: string; hidden?: boolean; big?: boolean }) {
  if (hidden) return <span className={`pcard back${big ? ' big' : ''}`} role="img" aria-label="face-down card" />
  if (!c) return <span className={`pcard empty${big ? ' big' : ''}`} role="img" aria-label="table card not dealt yet" />
  const rank = c[0] === 'T' ? '10' : c[0]
  const suit = c[1]?.toLowerCase() ?? ''
  return (
    <span className={`pcard${suit === 'h' || suit === 'd' ? ' red' : ''}${big ? ' big' : ''}`} role="img" aria-label={`${RANK_NAME[c[0]] ?? rank} of ${SUIT_NAME[suit] ?? suit}`}>
      <b>{rank}</b><i aria-hidden="true">{SUIT[suit] ?? '?'}</i>
    </span>
  )
}
