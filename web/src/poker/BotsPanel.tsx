import { useEffect, useState } from 'react'
import { loadBots, type RegisteredBot } from './data'
import { personality } from './words'

/** Registered bots, plain English. Owners and code hashes live in "Technical details". */
export function BotsPanel() {
  const [bots, setBots] = useState<RegisteredBot[] | null>(null)
  useEffect(() => { loadBots().then(setBots) }, [])
  if (!bots?.length) return null
  return (
    <div className="panel">
      <h2>Registered bots</h2>
      <ul className="rbots">
        {bots.map(b => (
          <li key={`${b.name}-${b.codeHash}`}>
            <b>{b.name}</b> <span className="verified" title="The owner proved this bot's code is theirs">Verified ✓</span>
            {b.house && <span className="house" title="Built by the BotBet team">house bot</span>}
            <div className="sub">{b.game === 'poker' ? 'Poker' : b.game === 'chess' ? 'Chess' : b.game} · {personality({ id: b.name, name: b.name })}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
