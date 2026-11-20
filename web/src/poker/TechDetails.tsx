import { useEffect, useState } from 'react'
import type { PokerResult } from './data'
import { loadBots, type RegisteredBot } from './data'

/** Everything technical (addresses, hashes, ids) lives here, collapsed by default. */
export function TechDetails({ d, referee }: { d: PokerResult; referee: string }) {
  const [bots, setBots] = useState<RegisteredBot[] | null>(null)
  useEffect(() => { loadBots().then(setBots) }, [])
  const base = d.explorerBaseUrl
  const tx = (h?: string) => h ? <a className="mono" href={`${base}/tx/${h}`} target="_blank" rel="noreferrer">{h}</a> : <span>—</span>
  const addr = (a?: string) => a ? <a className="mono" href={`${base}/address/${a}`} target="_blank" rel="noreferrer">{a}</a> : <span>—</span>
  return (
    <details className="tech">
      <summary>Technical details (for developers)</summary>
      <div className="kv"><span>Game format</span><span className="mono">{d.variant ?? d.game}</span></div>
      <div className="kv"><span>Chain ID</span><span className="mono">{d.chainId}</span></div>
      <div className="kv"><span>Match ID</span><span className="mono">{d.matchId}</span></div>
      <div className="kv"><span>Hand history hash (signed)</span><span className="mono">{d.handHistoryHash}</span></div>
      <div className="kv"><span>Referee signature</span><span className="mono">{d.signature}</span></div>
      <div className="kv"><span>Referee</span>{addr(d.referee || referee)}</div>
      {d.bots.map(b => <div className="kv" key={b.id}><span>{b.name} wallet</span>{addr(b.address)}</div>)}
      {d.bots.map(b => b.stakeTxHash && <div className="kv" key={`s-${b.id}`}><span>{b.name} stake tx</span>{tx(b.stakeTxHash)}</div>)}
      <div className="kv"><span>Create match tx</span>{tx(d.createMatchTxHash)}</div>
      <div className="kv"><span>Settle tx</span>{tx(d.settleTxHash)}</div>
      {bots?.map(b => <div className="kv" key={`r-${b.name}-${b.codeHash}`}><span>{b.name} owner / code hash</span><span className="mono">{b.owner} · {b.codeHash}</span></div>)}
      {bots?.find(b => b.verifyCommand) && <div className="kv"><span>Verify a bot</span><code>{bots.find(b => b.verifyCommand)!.verifyCommand}</code></div>}
    </details>
  )
}
