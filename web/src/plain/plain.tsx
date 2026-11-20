import type { Move } from 'chess.js'
import { formatUsdc } from 'botbet-shared'

const PIECE: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

/** Base units -> "$4.00" (rounded like the rest of the page). */
export function dollars(v: string | bigint): string {
  const neg = typeof v === 'bigint' ? v < 0n : v.trim().startsWith('-')
  const abs = typeof v === 'bigint' ? (v < 0n ? -v : v) : v.trim().replace(/^-/, '')
  return `${neg ? '-' : ''}$${formatUsdc(abs, { decimals: 2, symbol: false })}`
}

/** One move as a plain sentence, without square names or notation. */
export function describeMove(m: Move, n: number, names: { w: string; b: string }, winnerName: string): string {
  const me = names[m.color as 'w' | 'b']
  const them = names[m.color === 'w' ? 'b' : 'w']
  const piece = PIECE[m.piece] ?? 'piece'
  let s: string
  if (m.flags.includes('k') || m.flags.includes('q')) s = `${me} tucks the king to safety behind a rook (castling)`
  else if (m.promotion) s = `${me}'s pawn reaches the far side of the board and becomes a ${PIECE[m.promotion] ?? 'queen'}`
  else s = `${me}'s ${piece} moves`
  if (m.captured) s += ` and captures ${them}'s ${PIECE[m.captured] ?? 'piece'}`
  if (m.san.includes('#')) return `Move ${n} · ${s}. Checkmate! ${winnerName} wins.`
  if (m.san.includes('+')) s += ` and puts ${them}'s king in check`
  return `Move ${n} · ${s}.`
}

/** Small ⓘ with a one-sentence explanation (hover, focus, or screen reader). */
export function Tip({ text }: { text: string }) {
  return <span className="tip" tabIndex={0} role="note" aria-label={text} title={text} data-tip={text}>ⓘ</span>
}

export const TIPS = {
  blockchain: 'A public record that anyone can check and nobody can secretly change.',
  dollars: 'USDC: a digital dollar that is always worth one US dollar.',
  referee: 'An independent program that watches the game and signs who won, so the payout cannot be faked.',
}

export function Proof({ href, label }: { href?: string; label?: string }) {
  if (!href) return null
  return <a className="proof" href={href} target="_blank" rel="noreferrer" aria-label={label ? `See proof: ${label} (opens the public record)` : 'See proof (opens the public record)'}>See proof ↗</a>
}

export const PACES = [
  { id: 'slow', label: 'Slow', ms: 1500 },
  { id: 'normal', label: 'Normal', ms: 900 },
  { id: 'fast', label: 'Fast', ms: 400 },
] as const
export type PaceId = (typeof PACES)[number]['id']
export const paceMs = (p: PaceId) => PACES.find(x => x.id === p)?.ms ?? 900

export function PaceControl({ pace, onChange }: { pace: PaceId; onChange: (p: PaceId) => void }) {
  return (
    <span className="pace" role="group" aria-label="Replay speed">
      {PACES.map(p => (
        <button key={p.id} aria-pressed={pace === p.id} className={pace === p.id ? 'on' : ''} onClick={() => onChange(p.id)}>{p.label}</button>
      ))}
    </span>
  )
}
