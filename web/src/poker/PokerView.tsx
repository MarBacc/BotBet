import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { formatUsdc } from 'botbet-shared'
import type { PokerResult } from './data'
import { buildFrames } from './timeline'
import { Table } from './Table'
import { BotsPanel } from './BotsPanel'
import './poker.css'

const PokerPresent = lazy(() => import('./PokerPresent'))
const usdc = (v: string | null) => (v ? formatUsdc(v) : null)
const short = (s: string, a = 8, b = 6) => (s && s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s || '—')

export default function PokerView({ d, sample, referee }: { d: PokerResult; sample: boolean; referee: string }) {
  const frames = useMemo(() => buildFrames(d), [d])
  const total = frames.length - 1
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [present, setPresent] = useState(() => typeof location !== 'undefined' && new URLSearchParams(location.search).get('present') === '1')
  const base = d.explorerBaseUrl
  const tx = (h?: string) => (h ? `${base}/tx/${h}` : undefined)
  const winner = d.bots.find(b => b.id === d.winnerId) ?? d.bots[0]
  const loser = d.bots.find(b => b.id !== winner.id)
  const ref = d.referee || referee

  useEffect(() => {
    if (!playing) return
    if (i >= total) { setPlaying(false); return }
    const t = setTimeout(() => setI(n => n + 1), 700)
    return () => clearTimeout(t)
  }, [playing, i, total])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (present) return
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return
      if (e.key === 'ArrowLeft') { setPlaying(false); setI(n => Math.max(0, n - 1)) }
      if (e.key === 'ArrowRight') { setPlaying(false); setI(n => Math.min(total, n + 1)) }
      if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); setI(n => (n >= total ? 0 : n)); setPlaying(p => !p) }
      if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey) { setPlaying(false); setPresent(true) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [total, present])

  const f = frames[i]
  return (
    <div className="page">
      {present && (
        <Suspense fallback={null}>
          <PokerPresent d={d} frames={frames} sample={sample} settleUrl={tx(d.settleTxHash)} onExit={() => setPresent(false)} />
        </Suspense>
      )}
      {sample && <div className="sample-ribbon">SAMPLE DATA</div>}
      <header>
        <h1>BotBet — Poker <small className="beta">beta</small></h1>
        {sample ? <span className="tag">SAMPLE DATA</span>
          : d.offline ? <span className="tag">OFFLINE RUN · not settled on-chain</span>
          : <span className="tag live"><span aria-hidden="true">● </span>LIVE ON ARC</span>}
        <span className="ply">chain {d.chainId} · match {short(d.matchId, 10, 6)}</span>
      </header>

      <div className="banner">
        <span><span aria-hidden="true">🏆 </span>{winner.name} wins{loser ? ` vs ${loser.name}` : ''}</span>
        <span>{d.offline ? 'Not settled (offline run)' : `Pot ${usdc(d.potUsdc) ?? ''} paid to ${short(winner.address, 6, 4)}`.replace('Pot  ', 'Pot ')}</span>
      </div>

      <div className="strip">
        <div className="step"><small>1</small><b>Stake</b>
          {d.bots.map(b => b.stakeTxHash
            ? <a key={b.id} className="l" href={tx(b.stakeTxHash)} target="_blank" rel="noreferrer">{b.name}: {short(b.stakeTxHash)}</a>
            : <span key={b.id} className="l">{b.name}{d.stakeUsdc ? `: ${formatUsdc(d.stakeUsdc)}` : ''}</span>)}
          <span className="arr">→</span></div>
        <div className="step"><small>2</small><b>Play</b><span className="l">{d.hands.length} hands · {total} actions</span><span className="arr">→</span></div>
        <div className="step"><small>3</small><b>Referee signs</b><span className="l">EIP-712 · {short(d.signature, 10, 6)}</span><span className="arr">→</span></div>
        <div className="step"><small>4</small><b>Contract pays</b>
          {d.settleTxHash ? <a className="l" href={tx(d.settleTxHash)} target="_blank" rel="noreferrer">settle {short(d.settleTxHash)}</a> : <span className="l">pending</span>}</div>
      </div>

      <div className="pgrid">
        <div>
          <Table d={d} f={f} />
          <div className="ctl">
            <button aria-label="First action" onClick={() => { setPlaying(false); setI(0) }} disabled={i === 0}>⏮</button>
            <button aria-label="Previous action" onClick={() => setI(n => Math.max(0, n - 1))} disabled={i === 0}>◀</button>
            <button onClick={() => { if (i >= total) setI(0); setPlaying(p => !p) }}>{playing ? <><span aria-hidden="true">⏸ </span>Pause</> : <><span aria-hidden="true">▶ </span>Play</>}</button>
            <button aria-label="Next action" onClick={() => setI(n => Math.min(total, n + 1))} disabled={i === total}>▶</button>
            <button aria-label="Last action" onClick={() => { setPlaying(false); setI(total) }} disabled={i === total}>⏭</button>
            <span className="ply">hand {d.hands[f.hand].n}/{d.hands.length} · step {i}/{total}</span>
            <button onClick={() => { setPlaying(false); setPresent(true) }}><span aria-hidden="true">⛶ </span>Present</button>
          </div>
          <div className="ctl"><input type="range" aria-label="Replay position" min={0} max={total} value={i} onChange={e => { setPlaying(false); setI(Number(e.target.value)) }} /></div>
        </div>

        <div className="side">
          <div className="badge">
            <h3><span aria-hidden="true">✔ </span>referee-attested · hand history hash {short(d.handHistoryHash, 10, 6)}</h3>
            {ref && <div className="kv"><span>referee</span><a className="mono" href={`${base}/address/${ref}`} target="_blank" rel="noreferrer">{ref}</a></div>}
            <div className="kv"><span>signature</span><span className="mono">{short(d.signature, 12, 8)}</span></div>
          </div>
          <div className="panel">
            <h2>Hands</h2>
            <ol className="hands">
              {d.hands.map((h, hi) => {
                const start = frames.findIndex(x => x.hand === hi)
                const w = d.bots.find(b => b.id === h.winnerId)?.name ?? '—'
                return <li key={h.n}><button className={f.hand === hi ? 'cur' : ''} onClick={() => { setPlaying(false); setI(start) }}>Hand {h.n} · {w} · pot {h.actions.at(-1)?.pot ?? 0}</button></li>
              })}
            </ol>
          </div>
          <BotsPanel />
        </div>
      </div>
    </div>
  )
}
