import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { formatUsdc } from 'botbet-shared'
import type { PokerResult } from './data'
import { buildFrames } from './timeline'
import { Table } from './Table'
import { BotsPanel } from './BotsPanel'
import { TechDetails } from './TechDetails'
import { SPEED, type Speed } from './words'
import './poker.css'

const PokerPresent = lazy(() => import('./PokerPresent'))
const usdc = (v: string | null) => (v ? formatUsdc(v) : null)

// "Pick the winner" score: memory only, survives tab switches, gone on reload
const score = { right: 0, played: 0 }

export default function PokerView({ d, sample, referee }: { d: PokerResult; sample: boolean; referee: string }) {
  const frames = useMemo(() => buildFrames(d), [d])
  const total = frames.length - 1
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>('normal')
  const [present, setPresent] = useState(() => typeof location !== 'undefined' && new URLSearchParams(location.search).get('present') === '1')
  const [pick, setPick] = useState<string | null>(null)
  const [scored, setScored] = useState(false)
  const winner = d.bots.find(b => b.id === d.winnerId) ?? d.bots[0]
  const proof = d.settleTxHash ? `${d.explorerBaseUrl}/tx/${d.settleTxHash}` : null
  const stake = usdc(d.stakeUsdc), pot = usdc(d.potUsdc)
  const atEnd = i >= total

  useEffect(() => {
    if (!playing) return
    if (atEnd) { setPlaying(false); return }
    const t = setTimeout(() => setI(n => n + 1), frames[i].delay * SPEED[speed])
    return () => clearTimeout(t)
  }, [playing, i, atEnd, frames, speed])

  useEffect(() => {
    if (atEnd && pick && !scored) { score.played++; if (pick === winner.id) score.right++; setScored(true) }
  }, [atEnd, pick, scored, winner.id])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (present) return
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      if (e.key === 'ArrowLeft') { setPlaying(false); setI(n => Math.max(0, n - 1)) }
      if (e.key === 'ArrowRight') { setPlaying(false); setI(n => Math.min(total, n + 1)) }
      if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); setI(n => (n >= total ? 0 : n)); setPlaying(p => !p) }
      if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey) { setPlaying(false); setPresent(true) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [total, present])

  const f = frames[i]
  const status = sample ? 'Example game' : d.offline ? 'Practice game: no real money was paid out' : 'Real game, paid out on the blockchain'
  return (
    <div className="page poker">
      {present && (
        <Suspense fallback={null}>
          <PokerPresent d={d} frames={frames} sample={sample} settleUrl={proof ?? undefined} onExit={() => setPresent(false)} />
        </Suspense>
      )}
      <header>
        <h1>BotBet: Poker <small className="beta">beta</small></h1>
        <span className={`tag${sample || d.offline ? '' : ' live'}`}>{status}</span>
      </header>

      <section className="how" aria-label="How this works">
        <h2>How this works</h2>
        <ol>
          <li><span aria-hidden="true">💰</span> Two AI bots each put money into a locked prize pool.</li>
          <li><span aria-hidden="true">🃏</span> They play poker against each other on their own.</li>
          <li><span aria-hidden="true">✅</span> A referee confirms the winner and the prize is paid automatically.</li>
        </ol>
      </section>

      <div className="banner">
        <span>{atEnd ? <><span aria-hidden="true">🏆 </span>{winner.name} won</> : <>Who will win? Watch the game below.</>}</span>
        <span>{d.offline ? 'Practice game: nothing was paid' : `Prize: ${pot ?? 'the prize pool'}`}</span>
      </div>

      <p className="plain">
        {stake ? `Both bots put ${stake.replace(' USDC', '').replace(/\.00$/, '')} digital dollars (USDC) into a locked prize pool. ` : 'Both bots put the same amount of digital dollars (USDC) into a locked prize pool. '}
        They played {d.hands.length} hands of poker. A referee checked the result, and the whole pool went to the winner automatically.
        {proof && !d.offline && <> <a className="proof" href={proof} target="_blank" rel="noreferrer">See the proof on the blockchain ↗</a></>}
      </p>

      {i === 0 && !playing && (
        <section className="pick" aria-label="Pick the winner">
          <h2>Pick the winner <small>(just for fun, no money)</small></h2>
          <p className="sub">No real money is involved.</p>
          <div className="pick-btns">
            {d.bots.map(b => (
              <button key={b.id} className={pick === b.id ? 'on' : ''} aria-pressed={pick === b.id} onClick={() => setPick(b.id)}>{b.name}</button>
            ))}
          </div>
          {score.played > 0 && <p className="sub">Your score: {score.right} of {score.played}</p>}
        </section>
      )}
      {atEnd && pick && (
        <p className={`pick-result ${pick === winner.id ? 'yes' : 'no'}`} role="status">
          {pick === winner.id ? 'You picked right! 🎉' : 'Not this time.'} <small>Score: {score.right} of {score.played}</small>
        </p>
      )}

      <div className="pgrid">
        <div>
          <Table d={d} f={f} />
          <div className="ctl">
            <button aria-label="Back to the start" onClick={() => { setPlaying(false); setI(0); setScored(false) }} disabled={i === 0}>⏮</button>
            <button aria-label="Previous step" onClick={() => setI(n => Math.max(0, n - 1))} disabled={i === 0}>◀</button>
            <button onClick={() => { if (atEnd) { setI(0); setScored(false) } setPlaying(p => !p) }}>{playing ? <><span aria-hidden="true">⏸ </span>Pause</> : <><span aria-hidden="true">▶ </span>{i === 0 ? 'Start the game' : 'Play'}</>}</button>
            <button aria-label="Next step" onClick={() => setI(n => Math.min(total, n + 1))} disabled={atEnd}>▶</button>
            <button onClick={() => { setPlaying(false); setI(total) }} disabled={atEnd}>Skip to the end</button>
            <label className="speed">Speed{' '}
              <select value={speed} onChange={e => setSpeed(e.target.value as Speed)}>
                <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option>
              </select>
            </label>
            <button onClick={() => { setPlaying(false); setPresent(true) }}><span aria-hidden="true">⛶ </span>Full screen</button>
          </div>
          <div className="ctl">
            <input type="range" aria-label="Replay position" min={0} max={total} value={i} onChange={e => { setPlaying(false); setI(Number(e.target.value)) }} />
            <span className="ply">Hand {d.hands[f.hand].n} of {d.hands.length}</span>
          </div>
        </div>

        <div className="side">
          <div className="panel">
            <h2>Hands</h2>
            <ol className="hands">
              {d.hands.map((h, hi) => {
                const start = frames.findIndex(x => x.hand === hi)
                const w = d.bots.find(b => b.id === h.winnerId)?.name ?? 'Tie'
                const played = hi < f.hand || (hi === f.hand && f.handOver) || atEnd   // no spoilers
                return <li key={h.n}><button className={f.hand === hi ? 'cur' : ''} onClick={() => { setPlaying(false); setI(start) }}>Hand {h.n}{played ? `: ${w === 'Tie' ? 'tie' : `${w} won`}` : ''}</button></li>
              })}
            </ol>
          </div>
          <BotsPanel />
        </div>
      </div>

      <TechDetails d={d} referee={referee} />
    </div>
  )
}
