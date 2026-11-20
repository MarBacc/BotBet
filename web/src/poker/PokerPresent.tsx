import { useEffect, useState } from 'react'
import qrcode from 'qrcode-generator'
import { formatUsdc } from 'botbet-shared'
import type { PokerResult } from './data'
import type { Frame } from './timeline'
import { Table } from './Table'

function Qr({ text }: { text: string }) {
  const q = qrcode(0, 'M'); q.addData(text); q.make()
  return <div className="qr" role="img" aria-label="QR code: see the proof on the blockchain" dangerouslySetInnerHTML={{ __html: q.createSvgTag({ cellSize: 8, margin: 2, scalable: true }) }} />
}

/** Full-screen replay at Normal pace, then the winner and a QR code to the proof. */
export default function PokerPresent({ d, frames, sample, settleUrl, onExit }: { d: PokerResult; frames: Frame[]; sample: boolean; settleUrl?: string; onExit: () => void }) {
  const total = frames.length - 1
  const [i, setI] = useState(0)
  const [end, setEnd] = useState(false)
  const winner = d.bots.find(b => b.id === d.winnerId) ?? d.bots[0]

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}) }
  }, [])
  useEffect(() => {
    if (end) return
    const t = setTimeout(() => (i >= total ? setEnd(true) : setI(n => n + 1)), frames[i].delay)
    return () => clearTimeout(t)
  }, [i, total, end, frames])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.stopImmediatePropagation(); onExit() }
      if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); setEnd(true) }
      if (e.key === 'r' || e.key === 'R') { setEnd(false); setI(0) }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [onExit])

  return (
    <div className="present" role="dialog" aria-modal="true" aria-label="Full-screen poker replay">
      {sample && <div className="sample-ribbon">EXAMPLE</div>}
      {!end ? (
        <div className="pp-replay"><Table d={d} f={frames[i]} big /></div>
      ) : (
        <div className="pr-result">
          <div className="pr-win"><span aria-hidden="true">🏆 </span>{winner.name} wins</div>
          <div className="pr-pay">{d.offline ? 'Practice game: nothing was paid' : `${d.potUsdc ? formatUsdc(d.potUsdc) : 'The prize pool'} paid out automatically`}</div>
          <div className="pr-att">A referee confirmed the result.</div>
          {settleUrl && !d.offline && (
            <div className="pr-qr">
              <Qr text={settleUrl} />
              <div className="pr-scan">Scan to see the proof on the blockchain</div>
            </div>
          )}
        </div>
      )}
      <div className="pr-help">P / Esc exit · Space skip to the end · R replay</div>
    </div>
  )
}
