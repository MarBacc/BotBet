import { useEffect, useRef, useState } from 'react'
import { fromBaseUnits } from 'botbet-shared'

/** One announcer line from result.json facts, e.g. "Checkmate in 28 moves! Deep Thought takes the 4 USDC pot, settled on Arc." */
export function announcerLine(o: { plies: number; mate: boolean; winnerName: string; potUsdc: string }): string {
  const moves = Math.ceil(o.plies / 2)
  const lead = o.mate ? `Checkmate in ${moves} moves!` : `Game over after ${moves} moves!`
  return `${lead} ${o.winnerName} takes the ${fromBaseUnits(o.potUsdc)} USDC pot, settled on Arc.`
}

export function HearResult({ line }: { line: string }) {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [caption, setCaption] = useState('')
  const audio = useRef<HTMLAudioElement | null>(null)
  const clip = useRef<{ line: string; url: string } | null>(null) // in-memory cache of the spoken line

  useEffect(() => {
    fetch('/api/tts')
      .then(r => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : { enabled: false }))
      .then((j: { enabled?: boolean }) => setEnabled(Boolean(j.enabled)))
      .catch(() => setEnabled(false))
    return () => { audio.current?.pause() }
  }, [])

  if (!enabled) return null

  const speak = async () => {
    setBusy(true)
    setCaption(line)
    try {
      if (clip.current?.line !== line) {
        const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: line }) })
        if (!r.ok || !(r.headers.get('content-type') ?? '').includes('audio')) throw new Error()
        if (clip.current) URL.revokeObjectURL(clip.current.url)
        clip.current = { line, url: URL.createObjectURL(await r.blob()) }
      }
      audio.current?.pause()
      const a = new Audio(clip.current.url)
      audio.current = a
      await a.play()
    } catch {
      /* silent: the caption stays as the fallback */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hear">
      <button onClick={speak} disabled={busy}>{busy ? 'Loading audio…' : <><span aria-hidden="true">🔊 </span>Hear the result</>}</button>
      {caption && <span className="caption" aria-live="polite">“{caption}”</span>}
    </div>
  )
}
