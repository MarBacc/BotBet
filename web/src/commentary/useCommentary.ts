import { useCallback, useEffect, useRef, useState } from 'react'
import type { Line } from './script'

const MUTE_KEY = 'botbet.voice.muted'
const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false } }
const saveMuted = (m: boolean) => { try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* private mode */ } }

/** POST /api/tts (server caches) -> blob URL, or null on any failure. */
async function fetchClip(text: string): Promise<string | null> {
  try {
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('audio')) return null
    return URL.createObjectURL(await r.blob())
  } catch { return null }
}

export interface Commentary {
  caption: string
  soundOn: boolean
  enabled: boolean          // /api/tts has a key
  ready: number             // clips prefetched
  total: number
  busy: boolean             // a clip is playing: hold the replay
  audible: boolean          // enabled and not muted
  isIdle: () => boolean     // nothing queued or playing (reads refs: safe right after reach())
  toggleSound: () => void
  reach: (ply: number, kinds?: Line['kind'][]) => void
  reset: () => void
}

/**
 * Live commentator: prefetch every line through /api/tts on mount, then speak each line when the
 * replay reaches its ply. Captions always show; audio only when enabled and not muted.
 */
export function useCommentary(lines: Line[]): Commentary {
  const [enabled, setEnabled] = useState(false)
  const [soundOn, setSoundOn] = useState(() => !readMuted())
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(0)
  const clips = useRef(new Map<string, Promise<string | null>>())
  const urls = useRef<string[]>([])
  const queue = useRef<Line[]>([])
  const spoken = useRef(new Set<Line>())
  const running = useRef(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const soundRef = useRef(soundOn)
  const enabledRef = useRef(false)
  const blocked = useRef<Line | null>(null)
  soundRef.current = soundOn

  // 1. is TTS available? then prefetch everything (3 at a time)
  useEffect(() => {
    let alive = true
    fetch('/api/tts')
      .then(r => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : { enabled: false }))
      .then(async (j: { enabled?: boolean }) => {
        if (!alive || !j.enabled) return
        enabledRef.current = true
        setEnabled(true)
        const todo = [...new Set(lines.map(l => l.text))]
        let next = 0
        const worker = async () => {
          while (alive && next < todo.length) {
            const text = todo[next++]
            const p = fetchClip(text)
            clips.current.set(text, p)
            const u = await p
            if (u) urls.current.push(u)
            if (alive) setReady(n => n + 1)
          }
        }
        await Promise.all([worker(), worker(), worker()])
      })
      .catch(() => {})
    return () => {
      alive = false
      audio.current?.pause()
      urls.current.forEach(u => URL.revokeObjectURL(u))
    }
  }, [lines])

  const play = useCallback(async (line: Line) => {
    setCaption(line.text)
    if (!enabledRef.current || !soundRef.current) {
      // captions only: let the closing lines (result screen) each stay readable; never holds the replay
      if (line.kind === 'final' || line.kind === 'end') await new Promise(r => setTimeout(r, 2200))
      return
    }
    const url = await (clips.current.get(line.text) ?? fetchClip(line.text))
    if (!url || !soundRef.current) return
    await new Promise<void>(resolve => {
      const a = new Audio(url)
      audio.current = a
      a.onended = () => resolve()
      a.onerror = () => resolve()
      a.play().catch(() => { blocked.current = line; resolve() }) // autoplay blocked: retry on next keypress
    })
  }, [])

  const pump = useCallback(async () => {
    if (running.current) return
    running.current = true
    while (queue.current.length) {
      const line = queue.current.shift()!
      const audible = enabledRef.current && soundRef.current
      if (audible) setBusy(true)
      await play(line)
    }
    setBusy(false)
    running.current = false
  }, [play])

  /** Queue every not-yet-spoken line at this ply (optionally only some kinds). */
  const reach = useCallback((ply: number, kinds?: Line['kind'][]) => {
    for (const l of lines) {
      if (l.ply !== ply || spoken.current.has(l) || (kinds && !kinds.includes(l.kind))) continue
      spoken.current.add(l)
      queue.current.push(l)
    }
    void pump()
  }, [lines, pump])

  const reset = useCallback(() => {
    audio.current?.pause()
    queue.current = []
    spoken.current.clear()
    setCaption('')
    setBusy(false)
  }, [])

  const toggleSound = useCallback(() => {
    setSoundOn(s => {
      const n = !s
      saveMuted(!n)
      if (!n) audio.current?.pause() // muting ends the current clip; onended may not fire, so release the hold
      return n
    })
    setBusy(false)
  }, [])

  // M toggles sound; the first keypress also unlocks a blocked autoplay
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') { e.stopImmediatePropagation(); toggleSound(); return }
      const b = blocked.current
      if (b) { blocked.current = null; queue.current.unshift(b); void pump() }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [toggleSound, pump])

  const isIdle = useCallback(() => !running.current && queue.current.length === 0, [])
  return { caption, soundOn, enabled, ready, total: new Set(lines.map(l => l.text)).size, busy, audible: enabled && soundOn, isIdle, toggleSound, reach, reset }
}
