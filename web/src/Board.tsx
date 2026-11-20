import { useMemo } from 'react'
import { Chess } from 'chess.js'

const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
const NAME: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }

export function Board({ fen, hl, label, className = '' }: { fen: string; hl: [string, string] | null; label: string; className?: string }) {
  const board = useMemo(() => new Chess(fen).board(), [fen])
  return (
    <div className={`board ${className}`} role="img" aria-label={label}>
      {board.flatMap((row, r) => row.map((p, c) => {
        const name = 'abcdefgh'[c] + (8 - r)
        return (
          <div key={name} className={`sq ${(r + c) % 2 ? 'd' : 'l'}${hl && (hl[0] === name || hl[1] === name) ? ' hl' : ''}`}>
            {p && <span aria-hidden="true" title={`${p.color === 'w' ? 'white' : 'black'} ${NAME[p.type]} on ${name}`} className={p.color === 'w' ? 'pw' : 'pb'}>{GLYPH[p.type]}</span>}
          </div>
        )
      }))}
    </div>
  )
}
