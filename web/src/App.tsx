import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { formatUsdc } from 'botbet-shared'
import deployments from '../../shared/deployments.json'

interface Bot { id: string; name: string; address: string; depth: number; color: string; approveTxHash: string; stakeTxHash: string }
interface Result {
  version: number; chainId: number; escrow: string; usdc: string; explorerBaseUrl: string
  matchId: string; stakeUsdc: string; potUsdc: string; bots: Bot[]; winner: string; winnerId: string
  plies: number; pgn: string
  result: { matchId: string; winner: string; moveCount: number; pgnHash: string; finishedAt: number }
  signature: string; createMatchTxHash: string; settleTxHash: string
  balances: { before: Record<string, string>; after: Record<string, string> }
  finishedAt: number
  referee?: string
}

const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
const short = (s: string, a = 10, b = 8) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s)

async function load(): Promise<{ data: Result; sample: boolean }> {
  for (const [url, sample] of [['/result.json', false], ['/result.sample.json', true]] as const) {
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const data = JSON.parse(await r.text()) as Result
      if (data && Array.isArray(data.bots) && data.pgn) return { data, sample }
    } catch { /* try next */ }
  }
  throw new Error('No result.json or result.sample.json found')
}

export default function App() {
  const [state, setState] = useState<{ data: Result; sample: boolean } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { load().then(setState, (e: Error) => setError(e.message)) }, [])
  if (error) return <div className="page err">{error}</div>
  if (!state) return <div className="page">Loading…</div>
  return <Page data={state.data} sample={state.sample} />
}

function Page({ data: d, sample }: { data: Result; sample: boolean }) {
  const base = d.explorerBaseUrl
  const tx = (h: string) => `${base}/tx/${h}`
  const addr = (a: string) => `${base}/address/${a}`
  const referee = d.referee ?? deployments.referee

  const { fens, sans, lastMoves } = useMemo(() => {
    const g = new Chess()
    g.loadPgn(d.pgn)
    const hist = g.history({ verbose: true })
    return {
      fens: [hist.length ? hist[0].before : new Chess().fen(), ...hist.map(m => m.after)],
      sans: hist.map(m => m.san),
      lastMoves: [null, ...hist.map(m => [m.from, m.to] as [string, string])],
    }
  }, [d.pgn])
  const total = sans.length
  const [ply, setPly] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    if (ply >= total) { setPlaying(false); return }
    const t = setTimeout(() => setPly(p => p + 1), 900)
    return () => clearTimeout(t)
  }, [playing, ply, total])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setPly(p => Math.max(0, p - 1))
      if (e.key === 'ArrowRight') setPly(p => Math.min(total, p + 1))
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [total])

  const board = useMemo(() => new Chess(fens[ply]).board(), [fens, ply])
  const hl = lastMoves[ply]
  const winner = d.bots.find(b => b.id === d.winnerId) ?? d.bots[0]
  const loser = d.bots.find(b => b.id !== winner.id)
  const [wb, bb] = d.bots
  const delta = (id: string) => BigInt(d.balances.after[id]) - BigInt(d.balances.before[id])

  const rows: number[] = []
  for (let i = 0; i < total; i += 2) rows.push(i)

  return (
    <div className="page">
      <header>
        <h1>BotBet — Arena</h1>
        {sample && <span className="tag">SAMPLE DATA</span>}
        <span className="ply">chain {d.chainId} · match {short(d.matchId, 10, 6)}</span>
      </header>

      <div className="banner">
        <span>🏆 {winner.name} wins{loser ? ` vs ${loser.name}` : ''}</span>
        <span>Pot {formatUsdc(d.potUsdc)} paid to {short(winner.address, 6, 4)}</span>
      </div>

      <div className="strip">
        <div className="step"><small>1</small><b>Stake</b>
          {d.bots.map(b => <a key={b.id} className="l" href={tx(b.stakeTxHash)} target="_blank" rel="noreferrer">{b.name}: {short(b.stakeTxHash, 8, 6)}</a>)}
          <span className="arr">→</span></div>
        <div className="step"><small>2</small><b>Play</b><span className="l">{d.plies} plies · depth {wb.depth} vs {bb.depth}</span><span className="arr">→</span></div>
        <div className="step"><small>3</small><b>Referee signs</b><span className="l">EIP-712 · {short(d.signature, 10, 6)}</span><span className="arr">→</span></div>
        <div className="step"><small>4</small><b>Contract pays</b>
          <a className="l" href={tx(d.settleTxHash)} target="_blank" rel="noreferrer">settle {short(d.settleTxHash, 8, 6)}</a></div>
      </div>

      <div className="grid">
        <div>
          <div className="board">
            {board.flatMap((row, r) => row.map((p, c) => {
              const name = 'abcdefgh'[c] + (8 - r)
              return (
                <div key={name} className={`sq ${(r + c) % 2 ? 'd' : 'l'}${hl && (hl[0] === name || hl[1] === name) ? ' hl' : ''}`}>
                  {p && <span className={p.color === 'w' ? 'pw' : 'pb'}>{GLYPH[p.type]}</span>}
                </div>
              )
            }))}
          </div>
          <div className="ctl">
            <button onClick={() => { setPlaying(false); setPly(0) }} disabled={ply === 0}>⏮</button>
            <button onClick={() => setPly(p => Math.max(0, p - 1))} disabled={ply === 0}>◀</button>
            <button onClick={() => { if (ply >= total) setPly(0); setPlaying(p => !p) }}>{playing ? '⏸ Pause' : '▶ Play'}</button>
            <button onClick={() => setPly(p => Math.min(total, p + 1))} disabled={ply === total}>▶</button>
            <button onClick={() => { setPlaying(false); setPly(total) }} disabled={ply === total}>⏭</button>
            <span className="ply">ply {ply}/{total}</span>
          </div>
          <div className="ctl"><input type="range" min={0} max={total} value={ply} onChange={e => { setPlaying(false); setPly(Number(e.target.value)) }} /></div>
        </div>

        <div className="panel">
          <h2>Moves</h2>
          <div className="moves">
            {rows.map(i => (
              <Row key={i} i={i} sans={sans} ply={ply} go={setPly} />
            ))}
          </div>
        </div>

        <div className="side">
          <div className="badge">
            <h3>✔ referee-attested</h3>
            <div className="kv"><span>referee</span><a className="mono" href={addr(referee)} target="_blank" rel="noreferrer">{referee}</a></div>
            <div className="kv"><span>matchId</span><span className="mono">{short(d.result.matchId, 10, 8)}</span></div>
            <div className="kv"><span>moveCount</span><span className="mono">{d.result.moveCount}</span></div>
            <div className="kv"><span>pgnHash</span><span className="mono">{short(d.result.pgnHash, 10, 8)}</span></div>
            <div className="kv"><span>signature</span><span className="mono">{short(d.signature, 12, 8)}</span></div>
          </div>

          <div className="panel">
            <h2>Bots</h2>
            {d.bots.map(b => (
              <div className="bot" key={b.id}>
                <span className={`nm${b.id === d.winnerId ? ' w' : ''}`}>{b.name} {b.id === d.winnerId && '🏆'}</span>
                <span>{b.color} · depth {b.depth} · stake {formatUsdc(d.stakeUsdc)}</span>
                <a className="mono" href={addr(b.address)} target="_blank" rel="noreferrer">{b.address}</a>
                <span className="mono">
                  <a href={tx(b.approveTxHash)} target="_blank" rel="noreferrer">approve {short(b.approveTxHash, 6, 4)}</a>{' · '}
                  <a href={tx(b.stakeTxHash)} target="_blank" rel="noreferrer">stake {short(b.stakeTxHash, 6, 4)}</a>
                </span>
              </div>
            ))}
            <div className="kv"><span>Pot</span><span className="big">{formatUsdc(d.potUsdc)}</span></div>
          </div>

          <div className="panel">
            <h2>Payouts &amp; balances</h2>
            {d.bots.map(b => {
              const dl = delta(b.id)
              return (
                <div className="kv" key={b.id}>
                  <span>{b.name}</span>
                  <span>{formatUsdc(d.balances.before[b.id], { decimals: 4 })} → <b>{formatUsdc(d.balances.after[b.id], { decimals: 4 })}</b>{' '}
                    <span className={dl >= 0n ? 'pos' : 'neg'}>({dl >= 0n ? '+' : ''}{formatUsdc(dl.toString(), { decimals: 4 })})</span></span>
                </div>
              )
            })}
            <div className="kv"><span>Payout</span><span className="pos">{formatUsdc(d.potUsdc)} → {winner.name}</span></div>
          </div>

          <div className="panel">
            <h2>On-chain</h2>
            <div className="kv"><span>Escrow</span><a className="mono" href={addr(d.escrow)} target="_blank" rel="noreferrer">{short(d.escrow, 8, 6)}</a></div>
            <div className="kv"><span>createMatch</span><a className="mono" href={tx(d.createMatchTxHash)} target="_blank" rel="noreferrer">{short(d.createMatchTxHash, 8, 6)}</a></div>
            <div className="kv"><span>settle</span><a className="mono" href={tx(d.settleTxHash)} target="_blank" rel="noreferrer">{short(d.settleTxHash, 8, 6)}</a></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ i, sans, ply, go }: { i: number; sans: string[]; ply: number; go: (n: number) => void }) {
  return (
    <>
      <span className="n">{i / 2 + 1}.</span>
      <button className={ply === i + 1 ? 'cur' : ''} onClick={() => go(i + 1)}>{sans[i]}</button>
      {sans[i + 1] ? <button className={ply === i + 2 ? 'cur' : ''} onClick={() => go(i + 2)}>{sans[i + 1]}</button> : <span />}
    </>
  )
}
