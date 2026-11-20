import { useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { formatUsdc } from 'botbet-shared'
import { Board } from './Board'
import { loadCapDemo } from './CapCard'
import { buildScript } from './commentary/script'
import { useCommentary } from './commentary/useCommentary'
import { CaptionBar } from './commentary/CaptionBar'

const STEP_MS = 300 // brisk for a demo: ~17 s for a 55-ply game

export interface PresentProps {
  fens: string[]
  lastMoves: ([string, string] | null)[]
  sans: string[]
  winnerName: string
  loserName: string
  winnerAddress: string
  potUsdc: string
  settleUrl?: string
  sample: boolean
  startNo: number
  startBlack: boolean
  onExit: () => void
}

function Qr({ text }: { text: string }) {
  const svg = (() => {
    const q = qrcode(0, 'M')
    q.addData(text)
    q.make()
    return q.createSvgTag({ cellSize: 8, margin: 2, scalable: true })
  })()
  return <div className="qr" role="img" aria-label="QR code linking to the settle transaction on the Arc explorer" dangerouslySetInnerHTML={{ __html: svg }} />
}

export default function Present(p: PresentProps) {
  const total = p.sans.length
  const [ply, setPly] = useState(0)
  const done = ply >= total
  // live commentator: captions always; ElevenLabs audio when /api/tts has a key (holds the replay while speaking)
  const [hasCap, setHasCap] = useState<boolean | null>(null)
  useEffect(() => { loadCapDemo().then(c => setHasCap(!!c), () => setHasCap(false)) }, [])
  const lines = useMemo(() => (hasCap === null ? [] : buildScript({ fens: p.fens, sans: p.sans, winnerName: p.winnerName, loserName: p.loserName, potUsdc: p.potUsdc, hasCapDemo: hasCap })),
    [hasCap, p.fens, p.sans, p.winnerName, p.loserName, p.potUsdc])
  const voice = useCommentary(lines)
  const { reach } = voice
  // the final move is spoken over the final board; the result screen (with the payout lines) follows it
  const [ended, setEnded] = useState(false)
  useEffect(() => { if (ply < total) reach(ply); else reach(ply, ['final']) }, [ply, total, reach])
  const { isIdle, audible } = voice
  useEffect(() => {
    if (!done || ended || (audible && (voice.busy || !isIdle()))) return
    setEnded(true)
    reach(total, ['end'])
  }, [done, voice.busy, ended, reach, total, audible, isIdle])

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => { /* not allowed: overlay still fills the window */ })
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}) }
  }, [])

  useEffect(() => {
    if (done || voice.busy || hasCap === null) return
    const t = setTimeout(() => setPly(n => n + 1), ply === 0 ? 800 : STEP_MS)
    return () => clearTimeout(t)
  }, [ply, done, voice.busy, hasCap])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.stopImmediatePropagation(); p.onExit() }
      if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); setPly(total) }
      if (e.key === 'r' || e.key === 'R') { voice.reset(); setEnded(false); setPly(0) }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [p, total, voice.reset])

  const k = ply - 1 + (p.startBlack ? 1 : 0)
  const move = ply > 0 ? `${p.startNo + Math.floor(k / 2)}${k % 2 ? '…' : '.'} ${p.sans[ply - 1]}` : 'Starting position'
  return (
    <div className="present" role="dialog" aria-modal="true" aria-label="Presentation mode">
      {p.sample && <div className="sample-ribbon">SAMPLE DATA</div>}
      {!ended ? (
        <div className="pr-replay">
          <Board fen={p.fens[ply]} hl={p.lastMoves[ply]} label={`Replay, ${move}`} className="pr-board" />
          <div className="pr-side">
            <div className="pr-vs">{p.winnerName} <span>vs</span> {p.loserName}</div>
            <div className="pr-move" aria-live="polite">{move}</div>
            <div className="pr-ply">ply {ply} / {total}</div>
            <div className="pr-pot">Pot {formatUsdc(p.potUsdc)}</div>
          </div>
        </div>
      ) : (
        <div className="pr-result">
          <div className="pr-win"><span aria-hidden="true">🏆 </span>{p.winnerName} wins</div>
          <div className="pr-pay">{formatUsdc(p.potUsdc)} paid to {p.winnerAddress.slice(0, 6)}…{p.winnerAddress.slice(-4)}</div>
          <div className="pr-att">referee-attested · settled on Arc</div>
          {p.settleUrl && (
            <div className="pr-qr">
              <Qr text={p.settleUrl} />
              <div>
                <div className="pr-scan">Scan to open the settle transaction</div>
                <a className="mono" href={p.settleUrl} target="_blank" rel="noreferrer">{p.settleUrl.replace(/^https?:\/\//, '').replace(/(0x[0-9a-fA-F]{8})[0-9a-fA-F]+([0-9a-fA-F]{6})$/, '$1…$2')}</a>
              </div>
            </div>
          )}
        </div>
      )}
      <CaptionBar c={voice} />
      <div className="pr-help">P / Esc exit · Space skip to result · R replay{voice.enabled ? ' · M sound' : ''}</div>
    </div>
  )
}
