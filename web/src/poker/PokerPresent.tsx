import { useEffect, useState } from 'react'
import qrcode from 'qrcode-generator'
import { formatUsdc } from 'botbet-shared'
import type { PokerResult } from './data'
import type { Frame } from './timeline'
import { Table } from './Table'

const STEP_MS = 900

function Qr({ text }: { text: string }) {
  const q = qrcode(0, 'M'); q.addData(text); q.make()
  return <div className="qr" role="img" aria-label="QR code linking to the settle transaction on the Arc explorer" dangerouslySetInnerHTML={{ __html: q.createSvgTag({ cellSize: 8, margin: 2, scalable: true }) }} />
}

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
    const t = setTimeout(() => (i >= total ? setEnd(true) : setI(n => n + 1)), i === 0 ? 1000 : STEP_MS)
    return () => clearTimeout(t)
  }, [i, total, end])
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
    <div className="present" role="dialog" aria-modal="true" aria-label="Poker presentation mode">
      {sample && <div className="sample-ribbon">SAMPLE DATA</div>}
      {!end ? (
        <div className="pp-replay">
          <Table d={d} f={frames[i]} big />
        </div>
      ) : (
        <div className="pr-result">
          <div className="pr-win"><span aria-hidden="true">🏆 </span>{winner.name} wins</div>
          <div className="pr-pay">{formatUsdc(d.potUsdc)} paid to {winner.address.slice(0, 6)}…{winner.address.slice(-4)}</div>
          <div className="pr-att">referee-attested · hand history hash {d.handHistoryHash.slice(0, 10)}…</div>
          {settleUrl && (
            <div className="pr-qr">
              <Qr text={settleUrl} />
              <div>
                <div className="pr-scan">Scan to open the settle transaction</div>
                <a className="mono" href={settleUrl} target="_blank" rel="noreferrer">{settleUrl.replace(/^https?:\/\//, '').replace(/(0x[0-9a-fA-F]{8})[0-9a-fA-F]+([0-9a-fA-F]{6})$/, '$1…$2')}</a>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="pr-help">P / Esc exit · Space skip to result · R replay</div>
    </div>
  )
}
