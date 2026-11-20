import { useEffect, useState } from 'react'
import { loadBots, type RegisteredBot } from './data'

const short = (s: string) => (s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s)

export function BotsPanel() {
  const [bots, setBots] = useState<RegisteredBot[] | null>(null)
  useEffect(() => { loadBots().then(setBots) }, [])
  if (!bots?.length) return null
  const verify = bots.find(b => b.verifyCommand)?.verifyCommand
  return (
    <div className="panel">
      <h2>Registered bots</h2>
      <table className="rbots">
        <thead><tr><th>Name</th><th>Game</th><th>Owner</th><th>Code hash</th></tr></thead>
        <tbody>
          {bots.map(b => (
            <tr key={`${b.name}-${b.codeHash}`}>
              <td>{b.name} {b.house && <span className="house">house bot</span>}</td>
              <td>{b.game}</td>
              <td className="mono" title={b.owner}>{short(b.owner)}</td>
              <td className="mono" title={b.codeHash}>{short(b.codeHash)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="verify">Verify a bot: {verify
        ? <code>{verify}</code>
        : <span>recompute its code hash and compare it with the registry (CLI command published by the poker engine).</span>}</p>
    </div>
  )
}
