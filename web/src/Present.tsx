import { useEffect, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Board } from './Board'
import { dollars, PaceControl, paceMs, type PaceId } from './plain/plain'

export interface PresentProps {
  fens: string[]
  lastMoves: ([string, string] | null)[]
  /** one plain-English sentence per move */
  story: string[]
  winnerName: string
  loserName: string
  potUsdc: string
  settleUrl?: string
  sample: boolean
  pace: PaceId
  onPace: (p: PaceId) => void
  onExit: () => void
}

function Qr({ text }: { text: string }) {
  const svg = (() => {
    const q = qrcode(0, 'M')
    q.addData(text)
    q.make()
    return q.createSvgTag({ cellSize: 8, margin: 2, scalable: true })
  })()
  return <div className="qr" role="img" aria-label="QR code that opens the public record of the payout" dangerouslySetInnerHTML={{ __html: svg }} />
}

export default function Present(p: PresentProps) {
  const total = p.story.length
  const [ply, setPly] = useState(0)
  const done = ply >= total

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => { /* not allowed: overlay still fills the window */ })
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}) }
  }, [])

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => setPly(n => n + 1), ply === 0 ? 1200 : paceMs(p.pace))
    return () => clearTimeout(t)
  }, [ply, done, p.pace])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.stopImmediatePropagation(); p.onExit() }
      if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); setPly(total) }
      if (e.key === 'r' || e.key === 'R') setPly(0)
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [p, total])

  const move = ply > 0 ? p.story[ply - 1] : 'The game is about to start'
  return (
    <div className="present" role="dialog" aria-modal="true" aria-label="Full-screen replay">
      {p.sample && <div className="sample-ribbon">SAMPLE DATA</div>}
      {!done ? (
        <div className="pr-replay">
          <Board fen={p.fens[ply]} hl={p.lastMoves[ply]} label={move} className="pr-board" />
          <div className="pr-side">
            <div className="pr-vs">{p.winnerName} <span>vs</span> {p.loserName}</div>
            <div className="pr-move" aria-live="polite">{move}</div>
            <div className="pr-ply">Move {ply} of {total}</div>
            <div className="pr-pot">Prize pool {dollars(p.potUsdc)}</div>
            <div className="ctl"><PaceControl pace={p.pace} onChange={p.onPace} /><button onClick={() => setPly(total)}>Skip to the end</button></div>
          </div>
        </div>
      ) : (
        <div className="pr-result">
          <div className="pr-win"><span aria-hidden="true">🏆 </span>{p.winnerName} wins</div>
          <div className="pr-pay">The {dollars(p.potUsdc)} prize pool was paid out automatically</div>
          <div className="pr-att">Result confirmed by an independent referee ✓</div>
          {p.settleUrl && (
            <div className="pr-qr">
              <Qr text={p.settleUrl} />
              <div>
                <div className="pr-scan">Scan to see the payout on the public record</div>
                <a className="proof" href={p.settleUrl} target="_blank" rel="noreferrer">See proof ↗</a>
              </div>
            </div>
          )}
          <div className="ctl"><button onClick={() => setPly(0)}>Watch again</button><button onClick={p.onExit}>Close</button></div>
        </div>
      )}
      <div className="pr-help">Esc to close · Space to skip to the end · R to watch again</div>
    </div>
  )
}
