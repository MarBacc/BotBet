import { useEffect, useState } from 'react'
import { formatUsdc } from 'botbet-shared'

export interface CapDemo {
  wallet: string
  capUsdc: string
  allowed: { amount: string; txHash: string }
  refused: { amount: string; reason: string }
}

const fmt = (v: string) => formatUsdc(v, { symbol: false })

/** Turn a raw revert like "CapExceeded(100000, 50000)" into "CapExceeded: 0.10 > cap 0.05". */
export function decodeReason(c: CapDemo): string {
  const m = /CapExceeded\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(c.refused.reason ?? '')
  if (m) return `CapExceeded: ${fmt(m[1])} > cap ${fmt(m[2])}`
  if (c.refused.reason) return c.refused.reason
  return `CapExceeded: ${fmt(c.refused.amount)} > cap ${fmt(c.capUsdc)}`
}

export async function loadCapDemo(): Promise<CapDemo | null> {
  try {
    const r = await fetch('/cap-demo.json')
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null
    const c = (await r.json()) as CapDemo
    return c && c.allowed && c.refused ? c : null
  } catch {
    return null
  }
}

export function useCapDemo(): [CapDemo | null, boolean, () => void] {
  const [live, setLive] = useState<CapDemo | null>(null)
  const [preview, setPreview] = useState<CapDemo | null>(null)
  useEffect(() => { loadCapDemo().then(setLive) }, [])
  const toggle = () => {
    if (!import.meta.env.DEV) return
    if (preview) { setPreview(null); return }
    import('./dev/cap-demo.sample.json').then(m => setPreview(m.default as CapDemo))
  }
  return [live ?? preview, !live && !!preview, toggle]
}

export function CapCard({ c, base, sample }: { c: CapDemo; base: string; sample: boolean }) {
  return (
    <div className="panel cap">
      <h2>Agent wallet safety {sample && <span className="tag sm">sample</span>}</h2>
      <div className="kv"><span>Wallet</span><a className="mono" href={`${base}/address/${c.wallet}`} target="_blank" rel="noreferrer">{c.wallet}</a></div>
      <div className="kv"><span>Spending cap</span><b>{formatUsdc(c.capUsdc)}</b></div>
      <div className="pay ok">
        <span>✔ Allowed · {formatUsdc(c.allowed.amount)}</span>
        <a className="mono" href={`${base}/tx/${c.allowed.txHash}`} target="_blank" rel="noreferrer">tx {c.allowed.txHash.slice(0, 10)}…{c.allowed.txHash.slice(-6)}</a>
      </div>
      <div className="pay no">
        <span>✖ Refused · {formatUsdc(c.refused.amount)}</span>
        <span className="mono">{decodeReason(c)}</span>
      </div>
    </div>
  )
}
