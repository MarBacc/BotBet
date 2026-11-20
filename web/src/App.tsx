import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Chess } from 'chess.js'
import { formatUsdc } from 'botbet-shared'
import deployments from '../../shared/deployments.json'
import { CapCard, CapTech, useCapDemo } from './CapCard'
import { describeMove, dollars, PaceControl, paceMs, Proof, Tip, TIPS, type PaceId } from './plain/plain'
import { HearResult, announcerLine } from './Announcer'
import { Board } from './Board'
import { loadPoker, type PokerResult } from './poker/data'
import { ModeTabs, type Mode } from './poker/Tabs'

const Present = lazy(() => import('./Present'))
const PokerView = lazy(() => import('./poker/PokerView'))
const About = lazy(() => import('./About').then(m => ({ default: m.About })))

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

const short = (s: string, a = 10, b = 8) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s)

const DEFAULT_EXPLORER = 'https://explorer.testnet.arc.io' // docs/arc.md
const isInt = (v: unknown): v is string => typeof v === 'string' && /^-?\d+$/.test(v.trim())
const str = (v: unknown, dflt = '') => (typeof v === 'string' ? v : v == null ? dflt : String(v))
/** Base-unit string -> "2.00 USDC" via botbet-shared, or "—" if missing/garbled. */
const money = (v: unknown, decimals = 2) => (isInt(v) ? formatUsdc(v, { decimals }) : '—')

/** Accept a parsed result.json and fill safe defaults; null if it cannot be shown at all. */
export function validate(raw: unknown): Result | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Partial<Result> & Record<string, unknown>
  if (!Array.isArray(d.bots) || d.bots.length < 2 || typeof d.pgn !== 'string') return null
  if (!isInt(d.potUsdc) || !isInt(d.stakeUsdc)) return null
  try { new Chess().loadPgn(d.pgn) } catch { return null }
  const bots: Bot[] = d.bots.slice(0, 2).map((b: Partial<Bot> | null, i) => ({
    id: str(b?.id, `bot${i}`), name: str(b?.name, `Bot ${i + 1}`), address: str(b?.address),
    depth: Number(b?.depth) || 0, color: str(b?.color, i ? 'black' : 'white'),
    approveTxHash: str(b?.approveTxHash), stakeTxHash: str(b?.stakeTxHash),
  }))
  const winnerId = bots.some(b => b.id === d.winnerId) ? str(d.winnerId) : (bots.find(b => b.address && b.address === d.winner)?.id ?? bots[0].id)
  const r = (d.result ?? {}) as Partial<Result['result']>
  const finishedAt = Number(d.finishedAt ?? r.finishedAt) || 0
  const base = str(d.explorerBaseUrl).trim().replace(/\/+$/, '')
  return {
    version: Number(d.version) || 1, chainId: Number(d.chainId) || 5042002, escrow: str(d.escrow), usdc: str(d.usdc),
    explorerBaseUrl: /^https?:\/\//.test(base) ? base : DEFAULT_EXPLORER,
    matchId: str(d.matchId), stakeUsdc: d.stakeUsdc, potUsdc: d.potUsdc, bots, winner: str(d.winner), winnerId,
    plies: Number(d.plies) || 0, pgn: d.pgn,
    result: { matchId: str(r.matchId ?? d.matchId), winner: str(r.winner ?? d.winner), moveCount: Number(r.moveCount ?? d.plies) || 0, pgnHash: str(r.pgnHash), finishedAt },
    signature: str(d.signature), createMatchTxHash: str(d.createMatchTxHash), settleTxHash: str(d.settleTxHash),
    balances: { before: { ...(d.balances?.before ?? {}) }, after: { ...(d.balances?.after ?? {}) } },
    finishedAt, referee: typeof d.referee === 'string' ? d.referee : undefined,
  }
}

type Loaded = { data: Result; sample: boolean; warning?: string }

async function fetchJson(url: string): Promise<{ status: 'missing' } | { status: 'ok'; json: unknown } | { status: 'bad' }> {
  try {
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return { status: 'missing' }
    try { return { status: 'ok', json: JSON.parse(await r.text()) } } catch { return { status: 'bad' } }
  } catch { return { status: 'missing' } }
}

export async function loadSample(): Promise<Result | null> {
  const s = await fetchJson(`${import.meta.env.BASE_URL}result.sample.json`)
  return s.status === 'ok' ? validate(s.json) : null
}

async function load(): Promise<Loaded> {
  // dev-only: ?data=/some/path.json previews another result file (poll-loop checks)
  const q = import.meta.env.DEV ? new URLSearchParams(location.search).get('data') : null
  const live = await fetchJson(q || `${import.meta.env.BASE_URL}result.json`)
  let warning: string | undefined
  if (live.status === 'ok') {
    const data = validate(live.json)
    if (data) return { data, sample: false }
    warning = 'The latest result.json is incomplete, so the sample match is shown instead.'
  } else if (live.status === 'bad') {
    warning = 'The latest result.json could not be read, so the sample match is shown instead.'
  }
  const data = await loadSample()
  if (data) return { data, sample: true, warning }
  throw new Error('No match result is available yet. Run `npm run settle` to create one.')
}

class Boundary extends Component<{ fallback: (err: Error) => ReactNode; children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() { return this.state.err ? this.props.fallback(this.state.err) : this.props.children }
}

export default function App() {
  const [state, setState] = useState<Loaded | null>(null)
  const [sample, setSample] = useState<Result | null>(null)
  const [error, setError] = useState('')
  // Poker (beta): the tab appears only if poker-result.json exists; chess stays the default.
  const [poker, setPoker] = useState<{ data: PokerResult; sample: boolean } | null>(null)
  const [mode, setMode] = useState<Mode>(() => (import.meta.env.DEV && new URLSearchParams(location.search).get('mode') === 'poker' ? 'poker' : 'chess'))
  useEffect(() => {
    load().then(setState, (e: Error) => setError(e.message))
    loadSample().then(setSample)
    loadPoker().then(setPoker, () => setPoker(null))
  }, [])
  if (error) return <div className="page center err">{error}</div>
  if (!state) return <div className="page center" aria-busy="true"><div className="spin" /><span>Loading match result…</span></div>
  const tabs = poker && <ModeTabs mode={mode} onChange={setMode} />
  if (poker && mode === 'poker') return (
    <>
      {tabs}
      <Boundary fallback={() => <div className="page center err">The poker result could not be displayed.</div>}>
        <Suspense fallback={<div className="page center" aria-busy="true"><div className="spin" /></div>}>
          <PokerView d={poker.data} sample={poker.sample} referee={deployments.referee} />
        </Suspense>
      </Boundary>
    </>
  )
  return (
    <>
    {tabs}
    <Boundary fallback={() => (sample && !state.sample
      ? <Boundary fallback={() => <div className="page center err">Something went wrong showing this match.</div>}>
          <Page data={sample} sample warning="The latest result could not be displayed, so the sample match is shown instead." />
        </Boundary>
      : <div className="page center err">Something went wrong showing this match.</div>)}>
      <Page data={state.data} sample={state.sample} warning={state.warning} />
    </Boundary>
    </>
  )
}

export function Page({ data: d, sample, warning }: { data: Result; sample: boolean; warning?: string }) {
  const base = d.explorerBaseUrl
  const tx = (h: string) => (h ? `${base}/tx/${h}` : undefined)
  const addr = (a: string) => (a ? `${base}/address/${a}` : undefined)
  const referee = d.referee ?? deployments.referee
  const [cap, capSample, toggleCap] = useCapDemo()

  const winner = d.bots.find(b => b.id === d.winnerId) ?? d.bots[0]
  const loser = d.bots.find(b => b.id !== winner.id)
  const [wb, bb] = d.bots
  const byColor = { w: (d.bots.find(b => b.color === 'white') ?? wb).name, b: (d.bots.find(b => b.color === 'black') ?? bb).name }

  const { fens, sans, lastMoves, mate, story } = useMemo(() => {
    const g = new Chess()
    g.loadPgn(d.pgn)
    const hist = g.history({ verbose: true })
    return {
      mate: g.isCheckmate(),
      fens: [hist.length ? hist[0].before : new Chess().fen(), ...hist.map(m => m.after)],
      sans: hist.map(m => m.san),
      lastMoves: [null, ...hist.map(m => [m.from, m.to] as [string, string])],
      story: hist.map((m, i) => describeMove(m, i + 1, byColor, winner.name)),
    }
  }, [d.pgn, byColor.w, byColor.b, winner.name])
  const total = sans.length
  const [ply, setPly] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [pace, setPace] = useState<PaceId>('normal')
  const [pick, setPick] = useState<string | null>(null)
  const [present, setPresent] = useState(() => typeof location !== 'undefined' && new URLSearchParams(location.search).get('present') === '1')
  const cur = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    if (!playing) return
    if (ply >= total) { setPlaying(false); return }
    const t = setTimeout(() => setPly(p => p + 1), paceMs(pace))
    return () => clearTimeout(t)
  }, [playing, ply, total, pace])

  useEffect(() => { cur.current?.scrollIntoView?.({ block: 'nearest' }) }, [ply])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|BUTTON|SUMMARY)$/.test(e.target.tagName) && e.key === ' ') return
      if (e.key === 'ArrowLeft') { setPlaying(false); setPly(p => Math.max(0, p - 1)) }
      if (e.key === 'ArrowRight') { setPlaying(false); setPly(p => Math.min(total, p + 1)) }
      if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey) { setPlaying(false); setPresent(true); return }
      if (e.key === ' ') {
        e.preventDefault()
        setPly(p => (p >= total ? 0 : p))
        setPlaying(p => !p)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [total])

  const hl = lastMoves[ply]
  const delta = (id: string) => (isInt(d.balances.after[id]) && isInt(d.balances.before[id]) ? BigInt(d.balances.after[id]) - BigInt(d.balances.before[id]) : null)
  const balanceLine = d.bots.map(b => {
    const dl = delta(b.id)
    if (dl === null) return null
    return dl >= 0n ? `${b.name} finished with ${dollars(dl)} more` : `${b.name} lost ${dollars(-dl)}`
  }).filter(Boolean).join('; ')
  const date = d.finishedAt ? new Date(d.finishedAt * 1000).toLocaleDateString([], { dateStyle: 'long' }) : ''
  const strong = (b: Bot) => (b.depth >= Math.max(wb.depth, bb.depth) ? 'the stronger bot' : 'the faster bot')
  const done = ply >= total

  // Developer view: move numbers follow the start FEN (demo games start mid-game, possibly with Black to move).
  const [, side0 = 'w', , , , full0 = '1'] = fens[0].split(' ')
  const start = { no: Number(full0) || 1, black: side0 === 'b' }
  const rows: { n: number; w: number | null; b: number | null }[] = []
  for (let k = 0; k < total; k++) {
    const black = (k + (start.black ? 1 : 0)) % 2 === 1
    const n = start.no + Math.floor((k + (start.black ? 1 : 0)) / 2)
    if (!black || !rows.length || rows[rows.length - 1].b !== null) rows.push({ n, w: black ? null : k, b: null })
    if (black) rows[rows.length - 1].b = k
  }

  return (
    <div className="page">
      {present && (
        <Suspense fallback={<div className="present center"><div className="spin" /></div>}>
          <Present fens={fens} lastMoves={lastMoves} story={story} sans={sans} winnerName={winner.name} loserName={loser?.name ?? ''}
            potUsdc={d.potUsdc} settleUrl={tx(d.settleTxHash)} sample={sample} pace={pace} onPace={setPace}
            onExit={() => setPresent(false)} />
        </Suspense>
      )}
      {sample && <div className="sample-ribbon">SAMPLE DATA</div>}
      {warning && <div className="warn" role="status">{warning}</div>}
      <header>
        <h1>Watch two AI bots play chess for real money</h1>
        {sample
          ? <span className="tag" title="This is example data, not a real match">Example match (sample data)</span>
          : <span className="tag live">Played and paid out for real on the Arc blockchain <Tip text={TIPS.blockchain} />{date ? ` · ${date}` : ''}</span>}
        {import.meta.env.DEV && <button className="dev" onClick={toggleCap}>dev: cap card</button>}
      </header>

      <section className="how" aria-label="How this works">
        <h2>How this works</h2>
        <ol className="strip">
          <li className="step"><b>1. Each bot puts 2 digital dollars <Tip text={TIPS.dollars} /> into a locked prize pool.</b>
            {d.bots.map(b => <span key={b.id} className="l">{b.name}: <Proof href={tx(b.stakeTxHash)} label={`${b.name} entry money`} /></span>)}</li>
          <li className="step"><b>2. The bots play a full game on their own.</b>
            <span className="l">{Math.ceil(total / 2)} moves each, no human help.</span></li>
          <li className="step"><b>3. A referee <Tip text={TIPS.referee} /> confirms the winner and the {dollars(d.potUsdc).replace('.00', '')} are paid out automatically.</b>
            <span className="l"><Proof href={tx(d.settleTxHash)} label="payout" /></span></li>
        </ol>
      </section>

      <div className="banner">
        <span><span aria-hidden="true">🏆 </span>{winner.name} wins{loser ? ` against ${loser.name}` : ''}!</span>
        <span>{dollars(d.potUsdc)} prize pool paid out automatically <Proof href={tx(d.settleTxHash)} label="payout" /></span>
      </div>
      <HearResult line={announcerLine({ plies: d.plies, mate, winnerName: winner.name, potUsdc: d.potUsdc })} />

      <section className="panel guess" aria-label="Pick the winner">
        <h2>Pick the winner (just for fun, no money)</h2>
        {!pick
          ? <div className="ctl">{d.bots.map(b => <button key={b.id} onClick={() => { setPick(b.id); setPly(0); setPlaying(true) }}>{b.name}</button>)}</div>
          : done
            ? <p className="pick-result" role="status">{pick === winner.id ? 'You picked right! 🎉' : 'Not this time.'}</p>
            : <p role="status">You picked {d.bots.find(b => b.id === pick)?.name}. Watch the game to find out…</p>}
        <p className="why">No real money is involved for you.</p>
      </section>

      <div className="grid">
        <div>
          <Board fen={fens[ply]} hl={hl} label={ply ? story[ply - 1] : 'The board before the first move'} />
          <div className="ctl">
            <button aria-label="Back to the start" onClick={() => { setPlaying(false); setPly(0) }} disabled={ply === 0}>⏮</button>
            <button aria-label="Previous move" onClick={() => setPly(p => Math.max(0, p - 1))} disabled={ply === 0}>◀</button>
            <button onClick={() => { if (ply >= total) setPly(0); setPlaying(p => !p) }}>{playing ? <><span aria-hidden="true">⏸ </span>Pause</> : <><span aria-hidden="true">▶ </span>Play</>}</button>
            <button aria-label="Next move" onClick={() => setPly(p => Math.min(total, p + 1))} disabled={ply === total}>▶</button>
            <button onClick={() => { setPlaying(false); setPly(total) }} disabled={ply === total}>Skip to the end</button>
            <PaceControl pace={pace} onChange={setPace} />
            <button onClick={() => { setPlaying(false); setPresent(true) }}><span aria-hidden="true">⛶ </span>Full screen</button>
          </div>
          <div className="ctl"><span className="ply">Move {ply} of {total}</span>
            <input type="range" aria-label="Replay position" aria-valuetext={`move ${ply} of ${total}`} min={0} max={total} value={ply} onChange={e => { setPlaying(false); setPly(Number(e.target.value)) }} /></div>
        </div>

        <div className="panel">
          <h2>The game, move by move</h2>
          <ol className="story" aria-label="Moves in words">
            {story.map((s, i) => (
              <li key={i} ref={ply === i + 1 ? cur : undefined} className={ply === i + 1 ? 'cur' : ''} aria-current={ply === i + 1 ? 'step' : undefined}>
                <button onClick={() => { setPlaying(false); setPly(i + 1) }}>{s}</button>
              </li>
            ))}
          </ol>
        </div>

        <div className="side">
          <div className="badge">
            <h3>Result confirmed by an independent referee ✓ <Tip text={TIPS.referee} /></h3>
            <p>The prize was only released after the referee's signed result was checked. <Proof href={tx(d.settleTxHash)} label="referee-checked payout" /></p>
          </div>

          <div className="panel">
            <h2>The bots</h2>
            {d.bots.map(b => (
              <div className="bot" key={b.id}>
                <span className={`nm${b.id === d.winnerId ? ' w' : ''}`}>{b.name} {b.id === d.winnerId && <span role="img" aria-label="winner">🏆</span>}</span>
                <span>{b.name}, {strong(b)} (thinks {b.depth} moves ahead). Plays {b.color}.</span>
                <span>Entry money: {dollars(d.stakeUsdc)} <Proof href={tx(b.stakeTxHash)} label={`${b.name} entry money`} /></span>
              </div>
            ))}
            <div className="kv"><span>Prize pool</span><span className="big">{dollars(d.potUsdc)}</span></div>
          </div>

          <div className="panel">
            <h2>Who won what</h2>
            <p>{balanceLine || `${winner.name} received the ${dollars(d.potUsdc)} prize pool.`}</p>
            <p className="why">Small differences come from the tiny network fee each bot pays to send its entry money.</p>
          </div>

          {cap && <CapCard c={cap} base={base} sample={capSample} />}
        </div>
      </div>

      <details className="panel devinfo">
        <summary>Technical details (for developers)</summary>
        <div className="kv"><span>Status</span><span>{sample ? 'SAMPLE DATA' : 'LIVE ON ARC'} · chain {d.chainId} · match <span className="mono">{d.matchId}</span></span></div>
        <div className="kv"><span>Pot</span><span>{formatUsdc(d.potUsdc)} (stake {formatUsdc(d.stakeUsdc)} each)</span></div>
        <h3>referee-attested (EIP-712)</h3>
        <div className="kv"><span>referee</span><a className="mono" href={addr(referee)} target="_blank" rel="noreferrer">{referee}</a></div>
        <div className="kv"><span>matchId</span><span className="mono">{d.result.matchId}</span></div>
        <div className="kv"><span>moveCount (plies)</span><span className="mono">{d.result.moveCount}</span></div>
        <div className="kv"><span>pgnHash</span><span className="mono">{d.result.pgnHash}</span></div>
        <div className="kv"><span>signature</span><span className="mono">{short(d.signature, 12, 8)}</span></div>
        <h3>Bots</h3>
        {d.bots.map(b => (
          <div className="kv" key={b.id}><span>{b.name} · {b.color} · depth {b.depth}</span>
            <span className="mono"><a href={addr(b.address)} target="_blank" rel="noreferrer">{b.address}</a>{' · '}
              <a href={tx(b.approveTxHash)} target="_blank" rel="noreferrer">approve {short(b.approveTxHash, 6, 4)}</a>{' · '}
              <a href={tx(b.stakeTxHash)} target="_blank" rel="noreferrer">stake {short(b.stakeTxHash, 6, 4)}</a></span></div>
        ))}
        {d.bots.map(b => (
          <div className="kv" key={`bal-${b.id}`}><span>{b.name} balance</span><span>{money(d.balances.before[b.id], 4)} → {money(d.balances.after[b.id], 4)}</span></div>
        ))}
        <h3>On-chain</h3>
        <div className="kv"><span>Escrow</span><a className="mono" href={addr(d.escrow)} target="_blank" rel="noreferrer">{d.escrow}</a></div>
        <div className="kv"><span>createMatch</span><a className="mono" href={tx(d.createMatchTxHash)} target="_blank" rel="noreferrer">{short(d.createMatchTxHash, 8, 6)}</a></div>
        <div className="kv"><span>settle</span><a className="mono" href={tx(d.settleTxHash)} target="_blank" rel="noreferrer">{short(d.settleTxHash, 8, 6)}</a></div>
        {cap && <CapTech c={cap} base={base} />}
        <h3>Moves (SAN) · <span className="ply">ply {ply}/{total}</span></h3>
        <div className="moves" role="group" aria-label="Move list in chess notation">
          {rows.map(r => <Row key={r.n} row={r} sans={sans} ply={ply} go={setPly} />)}
        </div>
        <Suspense fallback={null}><About base={base} /></Suspense>
      </details>
    </div>
  )
}

function Row({ row, sans, ply, go }: { row: { n: number; w: number | null; b: number | null }; sans: string[]; ply: number; go: (n: number) => void }) {
  const cell = (k: number | null, color: string) => k === null
    ? <span className="ell">…</span>
    : <button aria-label={`Move ${row.n}, ${color} ${sans[k]}`} aria-current={ply === k + 1 ? 'step' : undefined} className={ply === k + 1 ? 'cur' : ''} onClick={() => go(k + 1)}>{sans[k]}</button>
  return (
    <>
      <span className="n">{row.n}.</span>
      {cell(row.w, 'white')}
      {row.b === null ? <span /> : cell(row.b, 'black')}
    </>
  )
}
