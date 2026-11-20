import { fromBaseUnits } from 'botbet-shared'

/** One commentary line. `ply` = replay position at which it is spoken; `end` lines play on the result screen. */
export interface Line { ply: number; text: string; kind: 'intro' | 'capture' | 'check' | 'swing' | 'queen' | 'mate' | 'final' | 'end' }

export interface ScriptInput {
  fens: string[]          // fens[0] = start, fens[k] = after ply k
  sans: string[]
  winnerName: string
  loserName: string
  potUsdc: string         // base units
  hasCapDemo?: boolean
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

/** White material minus black material for a FEN. */
function balance(fen: string): number {
  let s = 0
  for (const ch of fen.split(' ')[0]) {
    const v = VALUE[ch.toLowerCase()]
    if (v !== undefined) s += ch === ch.toUpperCase() ? v : -v
  }
  return s
}

/** Which piece (if any) a ply captured: compare piece counts before/after. */
function captured(before: string, after: string): string | null {
  const count = (fen: string) => {
    const c: Record<string, number> = {}
    for (const ch of fen.split(' ')[0]) if (/[a-z]/i.test(ch)) c[ch] = (c[ch] ?? 0) + 1
    return c
  }
  const a = count(before), b = count(after)
  for (const k of Object.keys(a)) if ((b[k] ?? 0) < a[k] && k.toLowerCase() !== 'p') return NAME[k.toLowerCase()]
  for (const k of Object.keys(a)) if ((b[k] ?? 0) < a[k]) return NAME[k.toLowerCase()]
  return null
}

const PIECE: Record<string, string> = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' }
/** SAN -> words a voice can say: "Nxe5+" -> "Knight takes e5, check". */
export function spoken(san: string): string {
  if (san.startsWith('O-O-O')) return `castles queenside${san.includes('#') ? ', checkmate' : san.includes('+') ? ', check' : ''}`
  if (san.startsWith('O-O')) return `castles${san.includes('#') ? ', checkmate' : san.includes('+') ? ', check' : ''}`
  const m = /^([KQRBN])?([a-h]?[1-8]?)(x?)([a-h][1-8])(?:=([QRBN]))?([+#])?/.exec(san)
  if (!m) return san
  const [, pc, , cap, sq, promo, chk] = m
  let t = `${pc ? PIECE[pc] : 'Pawn'} ${cap ? 'takes ' : 'to '}${sq}`
  if (promo) t += `, promotes to ${PIECE[promo].toLowerCase()}`
  if (chk === '+') t += ', check'
  if (chk === '#') t += ', checkmate'
  return t
}
const SWING = ['A {cap} falls. The balance swings.', 'There goes a {cap}. Big material swing.', 'The {cap} is gone. That changes everything.']

const words = (s: string) => s.trim().split(/\s+/).length
const usdc = (base: string) => { try { return fromBaseUnits(base) } catch { return null } }

/** Deterministic commentary, 8–12 short lines (each under 15 words). No LLM. */
export function buildScript(i: ScriptInput): Line[] {
  const total = i.sans.length
  const pot = usdc(i.potUsdc)
  const stake = (() => { try { return fromBaseUnits((BigInt(i.potUsdc) / 2n).toString()) } catch { return null } })()
  const mate = total > 0 && i.sans[total - 1].includes('#')
  const out: Line[] = []

  out.push({ ply: 0, kind: 'intro', text: `${i.winnerName} faces ${i.loserName}. ${stake ? `${stake} USDC each on the line, ` : ''}settled on Arc.` })

  // candidate mid-game moments, in priority order per kind
  const cands: Line[] = []
  let firstCapture = false, checks = 0, swings = 0
  const queenOut = { w: false, b: false }
  for (let k = 1; k < total; k++) {          // final ply handled separately
    const san = i.sans[k - 1]
    const before = i.fens[k - 1], after = i.fens[k]
    const swing = Math.abs(balance(after) - balance(before))
    const cap = san.includes('x') ? captured(before, after) : null
    const side = before.split(' ')[1] === 'b' ? 'b' : 'w'
    if (cap && !firstCapture) { firstCapture = true; cands.push({ ply: k, kind: 'capture', text: `First blood. ${spoken(san)}, winning a ${cap}.` }) }
    else if (cap && swing >= 3 && swings < SWING.length) cands.push({ ply: k, kind: 'swing', text: `${spoken(san)}! ${SWING[swings++].replace('{cap}', cap)}` })
    if (san.startsWith('Q') && !queenOut[side]) { queenOut[side] = true; cands.push({ ply: k, kind: 'queen', text: `The ${side === 'w' ? 'white' : 'black'} queen comes out.` }) }
    if (san.includes('+') && checks < 2) { checks++; cands.push({ ply: k, kind: 'check', text: `${spoken(san)}! The king is under fire.` }) }
  }
  if (mate && total >= 4) cands.push({ ply: Math.max(1, total - 3), kind: 'mate', text: 'Mate is in sight.' })

  // keep lines at least 3 plies apart, prefer the earlier-listed kinds, cap mid-game lines at 6
  const priority: Line['kind'][] = ['capture', 'mate', 'check', 'swing', 'queen']
  cands.sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind) || a.ply - b.ply)
  const picked: Line[] = []
  for (const c of cands) {
    if (picked.length >= 6) break
    if (picked.some(p => Math.abs(p.ply - c.ply) < 3) || c.ply < 2) continue
    picked.push(c)
  }
  // short games (demo positions start mid-game): add neutral beats so there are at least 8 lines
  const FILL = [`${i.winnerName} presses.`, 'The net is tightening.', `No way out for ${i.loserName}.`]
  for (const t of FILL) {
    if (picked.length + 4 >= 8 || total < 6) break
    const free = [...Array(total - 2).keys()].map(x => x + 2).filter(k => [0, ...picked.map(p => p.ply), total].every(q => Math.abs(q - k) >= 3))
    if (!free.length) break
    picked.push({ ply: free[Math.floor(free.length / 2)], kind: 'swing', text: t })
  }
  const fills = picked.filter(p => FILL.includes(p.text)).sort((a, b) => a.ply - b.ply)
  fills.forEach((f, n) => { f.text = FILL[n] })   // keep the fillers' story order
  out.push(...picked.sort((a, b) => a.ply - b.ply))

  if (total > 0) {
    const last = i.sans[total - 1]
    out.push({ ply: total, kind: 'final', text: mate ? `${spoken(last).replace(', checkmate', '')}. Checkmate! ${i.winnerName} wins.` : `${spoken(last)}. It's over. ${i.winnerName} wins.` })
  }
  out.push({ ply: total, kind: 'end', text: `${i.winnerName} takes the ${pot ? `${pot} USDC ` : ''}pot.` })
  out.push({ ply: total, kind: 'end', text: 'Referee-signed and paid out on-chain.' })
  if (i.hasCapDemo) out.push({ ply: total, kind: 'end', text: CAP_LINE })

  // safety: never more than 15 words (Arc demo captions must stay readable)
  return out.map(l => (words(l.text) < 15 ? l : { ...l, text: l.text.split(/\s+/).slice(0, 14).join(' ') }))
}

/** Agent-wallet card line. */
export const CAP_LINE = 'The bot tried to overspend. The contract said no.'
