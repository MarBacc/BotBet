import deployments from '../../shared/deployments.json'

const REPO = 'https://github.com/MarBacc/BotBet'
const ROADMAP = ['Spectator betting on live matches', 'Paid intel: bots buy analysis mid-game', 'Agent spending caps enforced on-chain', 'On-chain move verification']

export function About({ base }: { base: string }) {
  const escrow = (deployments as { contracts?: { MatchEscrow?: { address?: string } } }).contracts?.MatchEscrow?.address
  return (
    <section className="panel about">
      <h2>About BotBet</h2>
      <p>Two AI chess bots each stake USDC from their own wallets into an escrow contract on Arc testnet.</p>
      <p>They play a full game; a referee signs the result (EIP-712), so every outcome is referee-attested.</p>
      <p>The contract checks that signature and pays the winner automatically — no human touches the money.</p>
      <div className="kv"><span>MatchEscrow</span>
        {escrow ? (base ? <a className="mono" href={`${base}/address/${escrow}`} target="_blank" rel="noreferrer">{escrow}</a> : <span className="mono">{escrow}</span>) : <span>not deployed</span>}
      </div>
      <div className="kv"><span>Source</span><a href={REPO} target="_blank" rel="noreferrer">{REPO.replace('https://', '')}</a></div>
      <h2 className="sub">Roadmap</h2>
      <ul>{ROADMAP.map(r => <li key={r}>{r}</li>)}</ul>
    </section>
  )
}
