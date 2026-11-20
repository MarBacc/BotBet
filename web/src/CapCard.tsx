import { useEffect, useState } from 'react'
import { formatUsdc, toBaseUnits } from 'botbet-shared'
import { Proof } from './plain/plain'

export interface CapDemo {
  wallet: string
  capUsdc: string
  allowed: { amount: string; txHash: string | null }
  refused: { amount: string; reason: string; txHash?: string | null }
  /** live-runs 19ffa31: hash of the reverted (status 0) over-cap attempt, when it was sent on-chain */
  refusedTxHash?: string | null
}

const fmt = (v: string) => formatUsdc(v, { symbol: false })

/** cap-demo.json amounts are human strings ("0.02", interfaces.md §6); tolerate base units too. */
export function capUsdc(v: string): string {
  try {
    const t = String(v ?? '').trim()
    return formatUsdc(t.includes('.') ? toBaseUnits(t) : t)
  } catch {
    return `${v} USDC`
  }
}

/** Turn a raw revert like "CapExceeded(100000, 50000)" into "CapExceeded: 0.10 > cap 0.05". */
export function decodeReason(c: CapDemo): string {
  const m = /CapExceeded\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(c.refused.reason ?? '')
  if (m) return `CapExceeded: ${fmt(m[1])} > cap ${fmt(m[2])}`
  if (c.refused.reason) return c.refused.reason
  return `CapExceeded: ${c.refused.amount} > cap ${c.capUsdc}`
}

export async function loadCapDemo(): Promise<CapDemo | null> {
  try {
    // dev-only: ?cap=/some/path.json previews another cap-demo file (poll-loop checks)
    const q = import.meta.env.DEV ? new URLSearchParams(location.search).get('cap') : null
    const r = await fetch(q || `${import.meta.env.BASE_URL}cap-demo.json`, { cache: 'no-store' })
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null
    const c = (await r.json()) as CapDemo
    return c && typeof c === 'object' && c.allowed && c.refused && typeof c.wallet === 'string' ? c : null
  } catch {
    return null
  }
}

export function useCapDemo(): [CapDemo | null, boolean, () => void] {
  const [live, setLive] = useState<CapDemo | null>(null)
  const [preview, setPreview] = useState<CapDemo | null>(null)
  useEffect(() => {
    loadCapDemo().then(setLive)
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('sampleCap') === '1') {
      import('./dev/cap-demo.sample.json').then(m => setPreview(m.default as CapDemo))
    }
  }, [])
  const toggle = () => {
    if (!import.meta.env.DEV) return
    if (preview) { setPreview(null); return }
    import('./dev/cap-demo.sample.json').then(m => setPreview(m.default as CapDemo))
  }
  return [live ?? preview, !live && !!preview, toggle]
}

/** "0.05" (or base units) -> 5 */
function cents(v: string): number {
  const t = String(v ?? '').trim()
  const n = t.includes('.') ? Number(t) : Number(t) / 1_000_000
  return Math.round(n * 100)
}
const centWord = (n: number) => `${n} ${n === 1 ? 'cent' : 'cents'}`

function refusedTxOf(c: CapDemo): string | null {
  return typeof c.refusedTxHash === 'string' && c.refusedTxHash ? c.refusedTxHash
    : typeof c.refused.txHash === 'string' && c.refused.txHash ? c.refused.txHash : null
}

/** Plain-English spending-limit card: no addresses, hashes or error codes (those are in CapTech). */
export function CapCard({ c, base, sample }: { c: CapDemo; base: string; sample: boolean }) {
  const refusedTx = refusedTxOf(c)
  const link = (h: string | null) => (h && base ? `${base}/tx/${h}` : undefined)
  return (
    <div className="panel cap">
      <h2>Spending limit test {sample && <span className="tag sm">sample</span>}</h2>
      <p className="why">This bot's wallet has a built-in limit of {centWord(cents(c.capUsdc))} per payment.</p>
      <div className="pay ok">
        <span><span aria-hidden="true">✅ </span>A {cents(c.allowed.amount)}-cent payment went through.</span>
        <Proof href={link(c.allowed.txHash)} label="the payment that went through" />
      </div>
      <div className="pay no">
        <span><span aria-hidden="true">❌ </span>A {cents(c.refused.amount)}-cent payment was blocked by the wallet itself; no money moved.{refusedTx ? '' : ' (Tested without sending it.)'}</span>
        <Proof href={link(refusedTx)} label="the blocked payment" />
      </div>
    </div>
  )
}

/** Developer details for the spending-limit test (address, hashes, revert reason). */
export function CapTech({ c, base }: { c: CapDemo; base: string }) {
  const refusedTx = refusedTxOf(c)
  return (
    <>
      <h3>Agent wallet cap</h3>
      <div className="kv"><span>Wallet</span>{base ? <a className="mono" href={`${base}/address/${c.wallet}`} target="_blank" rel="noreferrer">{c.wallet}</a> : <span className="mono">{c.wallet}</span>}</div>
      <div className="kv"><span>Cap</span><span>{capUsdc(c.capUsdc)}</span></div>
      <div className="kv"><span>Allowed {capUsdc(c.allowed.amount)}</span><span className="mono">{c.allowed.txHash ?? 'tx pending'}</span></div>
      <div className="kv"><span>Refused {capUsdc(c.refused.amount)} {refusedTx ? '(on-chain, tx reverted)' : '(simulated)'}</span><span className="mono">{decodeReason(c)}{refusedTx ? ` · ${refusedTx}` : ''}</span></div>
    </>
  )
}
