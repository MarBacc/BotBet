import { useEffect, useMemo, useRef, useState } from 'react'
import './backing.css'

type Game = 'chess' | 'poker'
type Bot = { id: string; name: string; personality: string; record: string }
type Context = { game: Game; bots: [Bot, Bot]; winnerId: string }
type Bet = { bot: Bot; amount: number; payout: number; id: number }
type RegistryBot = { name?: string; game?: Game; strategySummary?: string }

const DEFAULT_BOTS: Record<Game, [string, string]> = {
  chess: ['Deep Thought', 'Hasty Hal'],
  poker: ['Nit', 'Maniac'],
}
const DEFAULT_PERSONALITY: Record<string, string> = {
  'Deep Thought': 'Patient and precise; searches deeper before choosing a move.',
  'Hasty Hal': 'Quick and practical; chooses a move with a shorter search.',
  Nit: 'Careful and selective; plays premium hands strongly.',
  Maniac: 'Bold and unpredictable; raises often and mixes in bluffs.',
  Theory: 'By the book; uses a hand chart and estimates odds.',
}
const PRACTICE_BANNER = 'Practice mode: no real money. Real backing is coming soon.'

function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function shortSummary(summary: string | undefined, name: string): string {
  const clean = (summary ?? '').replace(/^HOUSE BOT\s*[—-]\s*/i, '').trim()
  const sentence = clean.split(/[.!?]/)[0]?.trim()
  return sentence || DEFAULT_PERSONALITY[name] || 'A house bot playing to win this match.'
}

async function readJson(path: string): Promise<unknown | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${path}`, { cache: 'no-store' })
    if (!response.ok) return null
    return await response.json() as unknown
  } catch { return null }
}

async function loadContext(): Promise<Context> {
  const game: Game = /poker/i.test(document.querySelector('h1')?.textContent ?? '') ? 'poker' : 'chess'
  const registryValue = await readJson('bots.json')
  const registry = Array.isArray(registryValue) ? registryValue as RegistryBot[] : []
  const matchValue = await readJson(game === 'poker' ? 'poker-result.json' : 'result.json')
    ?? await readJson(game === 'poker' ? 'poker/sample.json' : 'result.sample.json')
  const match = matchValue && typeof matchValue === 'object' ? matchValue as Record<string, unknown> : {}
  const sourceBots = Array.isArray(match.bots) ? match.bots as Array<Record<string, unknown>> : []
  const names = sourceBots.slice(0, 2).map(bot => text(bot.name)).filter(Boolean)
  const chosenNames = names.length === 2 ? names : DEFAULT_BOTS[game]
  const winnerId = text(match.winnerId)
  const winner = text(match.winner)
  const bots = chosenNames.map((name): Bot => {
    const source = sourceBots.find(bot => text(bot.name) === name)
    const id = text(source?.id) || name
    const won = winnerId ? id === winnerId : Boolean(winner && (winner === name || winner === text(source?.address)))
    const summary = registry.find(bot => bot.game === game && bot.name === name)?.strategySummary
    return {
      id,
      name,
      personality: shortSummary(summary, name),
      record: winner || winnerId ? `Record in this replay: ${won ? '1–0' : '0–1'}` : 'Record in this replay: pending',
    }
  })
  return { game, bots: bots as [Bot, Bot], winnerId }
}

function replayIsFinished(): boolean {
  const counters = [...document.querySelectorAll<HTMLElement>('.ctl .ply')]
  return counters.some(node => {
    const match = node.textContent?.match(/(?:ply|step)\s+(\d+)\s*\/\s*(\d+)/i)
    return Boolean(match && Number(match[1]) >= Number(match[2]))
  })
}

function money(value: number): string {
  return `$${value.toFixed(2)}`
}

export default function Backing() {
  const [open, setOpen] = useState(false)
  const [context, setContext] = useState<Context | null>(null)
  const [step, setStep] = useState<'pick' | 'amount' | 'confirm' | 'success'>('pick')
  const [selected, setSelected] = useState<Bot | null>(null)
  const [amountText, setAmountText] = useState('')
  const [balance, setBalance] = useState(50)
  const [pools, setPools] = useState<[number, number]>([20, 20])
  const [bet, setBet] = useState<Bet | null>(null)
  const [settlement, setSettlement] = useState('')
  const [tipOpen, setTipOpen] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const betId = useRef(0)
  const settledBetId = useRef(0)
  const amount = Number(amountText)
  const amountValid = Number.isFinite(amount) && amount >= 1 && amount <= balance && /^\d+(?:\.\d{1,2})?$/.test(amountText)
  const selectedIndex = context && selected ? context.bots.findIndex(bot => bot.id === selected.id) : -1
  const estimatedPayout = useMemo(() => {
    if (selectedIndex < 0 || !amountValid) return 0
    const poolTotalAfter = pools[0] + pools[1] + amount
    return poolTotalAfter * amount / (pools[selectedIndex] + amount)
  }, [amount, amountValid, pools, selectedIndex])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFirst = () => modalRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled])')?.focus()
    const timer = window.setTimeout(focusFirst, 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSheet()
      }
      if (event.key !== 'Tab' || !modalRef.current) return
      const focusable = [...modalRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
    // closeSheet is stable in behavior and only changes modal visibility.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step])

  useEffect(() => {
    if (!bet || settlement) return
    const settleIfFinished = () => {
      if (!replayIsFinished() || settledBetId.current === bet.id) return
      settledBetId.current = bet.id
      const won = Boolean(context?.winnerId && bet.bot.id === context.winnerId)
      if (won) setBalance(value => value + bet.payout)
      setSettlement(won ? `You won ${money(bet.payout)}!` : 'Not this time')
    }
    settleIfFinished()
    const observer = new MutationObserver(settleIfFinished)
    observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    return () => observer.disconnect()
  }, [bet, context, settlement])

  async function openSheet() {
    setContext(await loadContext())
    setSelected(null)
    setAmountText('')
    setStep('pick')
    setOpen(true)
  }

  function closeSheet() {
    setOpen(false)
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }

  function placeBet() {
    if (!selected || !context || selectedIndex < 0 || !amountValid) return
    const newBet = { bot: selected, amount, payout: estimatedPayout, id: ++betId.current }
    setBet(newBet)
    setBalance(value => value - amount)
    setPools(value => value.map((pool, index) => index === selectedIndex ? pool + amount : pool) as [number, number])
    setSettlement('')
    setStep('success')
  }

  const primaryText = step === 'pick' ? 'Choose this bot' : step === 'amount' ? 'Continue' : step === 'confirm' ? 'Confirm' : 'Watch now'
  const onPrimary = () => {
    if (step === 'pick' && selected) setStep('amount')
    else if (step === 'amount' && amountValid) setStep('confirm')
    else if (step === 'confirm') placeBet()
    else if (step === 'success') closeSheet()
  }

  return (
    <>
      {settlement && <div className="backing-outcome" role="status" aria-live="polite"><span>{settlement}</span><button type="button" onClick={() => setSettlement('')} aria-label="Dismiss practice result">Dismiss</button></div>}
      <button ref={triggerRef} type="button" className="backing-launch" onClick={openSheet}>Back a bot</button>
      {open && <div className="backing-scrim" onMouseDown={event => { if (event.target === event.currentTarget) closeSheet() }}>
        <section ref={modalRef} className="backing-sheet" role="dialog" aria-modal="true" aria-labelledby="backing-title" aria-describedby="backing-mode">
          <div className="backing-grabber" aria-hidden="true" />
          <header className="backing-header">
            <div><h2 id="backing-title">Back a bot</h2><p className="backing-balance">{money(balance)} practice money</p></div>
            <button className="backing-close" type="button" onClick={closeSheet} aria-label="Close backing sheet">×</button>
          </header>
          <p id="backing-mode" className="backing-practice">{PRACTICE_BANNER}</p>
          {step === 'pick' && <div className="backing-step">
            <p className="backing-stepno">Step 1 of 3</p><h3>Who do you think will win?</h3>
            <div className="backing-cards">
              {(context?.bots ?? []).map(bot => <button key={bot.id} type="button" className={`backing-card${selected?.id === bot.id ? ' selected' : ''}`} aria-pressed={selected?.id === bot.id} onClick={() => setSelected(bot)}>
                <span className="backing-botname">{bot.name}</span><span>{bot.personality}</span><span className="backing-record">{bot.record}</span>
              </button>)}
            </div>
            <button type="button" className="backing-tip-toggle" aria-expanded={tipOpen} onClick={() => setTipOpen(value => !value)}>ⓘ How could real backing work?</button>
            {tipOpen && <p className="backing-tip" role="tooltip">Later, real backing will use digital dollars (USDC) held in a smart contract that pays winners automatically.</p>}
          </div>}
          {step === 'amount' && <div className="backing-step">
            <p className="backing-stepno">Step 2 of 3</p><h3>How much?</h3>
            <p className="backing-selected">Backing <strong>{selected?.name}</strong></p>
            <div className="backing-picks" aria-label="Quick amounts">
              {[1, 5, 10, 25].map(value => <button type="button" key={value} aria-pressed={amountText === String(value)} className={amountText === String(value) ? 'active' : ''} onClick={() => setAmountText(String(value))}>${value}</button>)}
            </div>
            <label className="backing-custom">Custom amount
              <span><span aria-hidden="true">$</span><input type="number" min="1" max={balance} step="0.01" inputMode="decimal" value={amountText} onChange={event => setAmountText(event.target.value)} placeholder="Enter amount" /></span>
            </label>
            {amountText && !amountValid && <p className="backing-error" role="alert">Enter an amount from $1 up to your {money(balance)} practice balance.</p>}
            <p className="backing-estimate" aria-live="polite">{amountValid && selected ? `If ${selected.name} wins, you'd get about ${money(estimatedPayout)} back (estimate).` : 'Pick an amount to see an estimated payout.'}</p>
          </div>}
          {step === 'confirm' && <div className="backing-step">
            <p className="backing-stepno">Step 3 of 3</p><h3>Confirm</h3>
            <p className="backing-summary">You're backing {selected?.name} with {money(amount)}.</p>
            <p className="backing-estimate">Estimated return if they win: about {money(estimatedPayout)}.</p>
          </div>}
          {step === 'success' && <div className="backing-step backing-success">
            <p className="backing-stepno">Practice bet placed</p><h3>You're in! 🎉</h3>
            <p>Watch the match to see if {selected?.name} wins.</p>
            <p className="backing-estimate">Possible return: about {money(estimatedPayout)} (estimate).</p>
          </div>}
          <div className="backing-actions">
            {step === 'confirm' && <button type="button" className="backing-secondary" onClick={() => setStep('amount')}>Back</button>}
            {step === 'amount' && <button type="button" className="backing-secondary" onClick={() => setStep('pick')}>Back</button>}
            <button type="button" className="backing-primary" disabled={(step === 'pick' && !selected) || (step === 'amount' && !amountValid)} onClick={onPrimary}>{primaryText}</button>
          </div>
          <p className="backing-stephelp" aria-live="polite">{step === 'success' ? 'Your practice bet is only in this browser session.' : 'No countdowns. Take your time.'}</p>
        </section>
      </div>}
    </>
  )
}
