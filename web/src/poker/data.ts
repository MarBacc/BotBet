export interface PokerBot { id: string; name: string; strategy: string; address: string; startChips: number; stakeTxHash?: string }
export interface PokerAction { street: string; botId: string; action: string; amount: number; pot: number }
export interface PokerHand { n: number; holeCards: Record<string, string[]>; board: string[]; actions: PokerAction[]; winnerId: string; chipsAfter: Record<string, number> }
export interface PokerResult {
  version: number; game: string; chainId: number; explorerBaseUrl: string; matchId: string
  stakeUsdc: string | null; potUsdc: string | null; bots: PokerBot[]; hands: PokerHand[]
  offline?: boolean; variant?: string
  winner: string; winnerId: string; handHistoryHash: string; signature: string; referee?: string
  createMatchTxHash?: string; settleTxHash?: string; finishedAt?: number
}
export interface RegisteredBot { name: string; game: string; owner: string; codeHash: string; house?: boolean; verifyCommand?: string }

const DEFAULT_EXPLORER = 'https://explorer.testnet.arc.io'
const base = () => import.meta.env.BASE_URL ?? '/'
const isInt = (v: unknown) => typeof v === 'string' && /^\d+$/.test(v)

async function getJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null
    return await r.json()
  } catch { return null }
}

const STACK = 100 // engine.ts: stacks 100

/* eslint-disable @typescript-eslint/no-explicit-any */
/** feat/poker-engine's poker-result.json (schemaVersion 1, match.ts pokerResultJson) -> page model. */
function fromEngine(e: any): Partial<PokerResult> {
  const bots: PokerBot[] = (e.bots ?? []).map((b: any) => ({ id: String(b.id), name: String(b.name), strategy: String(b.strategy ?? ''), address: String(b.address ?? ''), startChips: STACK }))
  const idOf = (name: string) => bots.find(b => b.name === name)?.id ?? name
  const txs = e.txs ?? {}
  bots.forEach(b => { b.stakeTxHash = txs[`${b.id}.stake`] })
  let chips: Record<string, number> = Object.fromEntries(bots.map(b => [b.id, STACK]))
  const hands: PokerHand[] = (e.hands ?? []).map((h: any, i: number) => {
    const put: Record<string, number> = Object.fromEntries(bots.map(b => [b.id, 0]))
    let pot = 0
    const actions: PokerAction[] = (h.actions ?? []).map((a: any) => {
      const id = idOf(String(a.bot)); const amt = Number(a.amount) || 0
      put[id] = (put[id] ?? 0) + amt; pot += amt
      return { street: String(a.street), botId: id, action: a.type === 'post' ? 'posts blind' : String(a.type), amount: amt, pot }
    })
    const final = Number(h.pot) || pot
    const winnerId = h.winner === 'split' ? '' : idOf(String(h.winner))
    // the unmatched part of an all-in is returned: take the excess back from the bigger contributor
    const excess = pot - final
    if (excess > 0) { const big = bots.reduce((m, b) => (put[b.id] > put[m.id] ? b : m), bots[0]); put[big.id] -= excess }
    const after = { ...chips }
    bots.forEach(b => { after[b.id] = chips[b.id] - put[b.id] + (winnerId ? (winnerId === b.id ? final : 0) : final / 2) })
    if (actions.length) actions[actions.length - 1].pot = final
    if (h.showdown) actions.push({ street: 'showdown', botId: winnerId || bots[0].id, action: winnerId ? 'wins at showdown' : 'split pot', amount: 0, pot: final })
    chips = after
    const hole: Record<string, string[]> = {}
    for (const [name, cards] of Object.entries(h.holeCards ?? {})) hole[idOf(name)] = cards as string[]
    return { n: Number(h.n) || i + 1, holeCards: hole, board: (h.board ?? []).map(String), actions, winnerId, chipsAfter: after }
  })
  const ref = e.referee ?? {}
  return {
    version: Number(e.schemaVersion) || 1, game: 'poker', variant: e.variant, offline: Boolean(e.offline), chainId: e.chainId,
    explorerBaseUrl: e.explorerBaseUrl, matchId: e.matchId, stakeUsdc: e.stakeUsdc ?? null, potUsdc: e.potUsdc ?? null,
    bots, hands, winner: ref.result?.winner ?? bots.find(b => b.id === e.winnerId)?.address ?? '', winnerId: e.winnerId,
    handHistoryHash: e.handHistoryHash, signature: ref.signature ?? '', referee: ref.address,
    createMatchTxHash: txs.createMatch, settleTxHash: txs.settle, finishedAt: ref.result?.finishedAt,
  }
}

/** Fill defaults; null when the file cannot be shown. Accepts the engine schema or the page's own. */
export function validatePoker(raw: unknown): PokerResult | null {
  if (!raw || typeof raw !== 'object') return null
  const d = ('schemaVersion' in (raw as object) ? fromEngine(raw) : raw) as Partial<PokerResult>
  if (!Array.isArray(d.bots) || d.bots.length < 2 || !Array.isArray(d.hands) || !d.hands.length) return null
  const bots = d.bots.slice(0, 2).map((b, i) => ({
    id: String(b?.id ?? `bot${i}`), name: String(b?.name ?? `Bot ${i + 1}`), strategy: String(b?.strategy ?? ''),
    address: String(b?.address ?? ''), startChips: Number(b?.startChips) || 0, stakeTxHash: b?.stakeTxHash ? String(b.stakeTxHash) : undefined,
  }))
  const hands = d.hands.filter(h => h && Array.isArray(h.actions)).map((h, i) => ({
    n: Number(h.n) || i + 1, holeCards: h.holeCards ?? {}, board: Array.isArray(h.board) ? h.board.map(String) : [],
    actions: h.actions.map(a => ({ street: String(a?.street ?? ''), botId: String(a?.botId ?? ''), action: String(a?.action ?? ''), amount: Number(a?.amount) || 0, pot: Number(a?.pot) || 0 })),
    winnerId: String(h.winnerId ?? ''), chipsAfter: h.chipsAfter ?? {},
  }))
  const b = String(d.explorerBaseUrl ?? '').trim().replace(/\/+$/, '')
  return {
    ...d, bots, hands, version: Number(d.version) || 1, game: String(d.game ?? 'poker'), chainId: Number(d.chainId) || 5042002,
    explorerBaseUrl: /^https?:\/\//.test(b) ? b : DEFAULT_EXPLORER, matchId: String(d.matchId ?? ''),
    stakeUsdc: isInt(d.stakeUsdc) ? d.stakeUsdc as string : null, potUsdc: isInt(d.potUsdc) ? d.potUsdc as string : null,
    winner: String(d.winner ?? ''), winnerId: bots.some(x => x.id === d.winnerId) ? String(d.winnerId) : bots[0].id,
    handHistoryHash: String(d.handHistoryHash ?? ''), signature: String(d.signature ?? ''),
  }
}

const devParam = (k: string) => (import.meta.env.DEV ? new URLSearchParams(location.search).get(k) : null)

/** Live poker-result.json, or (dev only, ?poker=sample) the bundled sample. null = no poker tab. */
export async function loadPoker(): Promise<{ data: PokerResult; sample: boolean } | null> {
  const q = devParam('poker')
  if (q === 'sample') {
    const m = await import('./sample.json')
    const data = validatePoker(m.default)
    return data ? { data, sample: true } : null
  }
  const data = validatePoker(await getJson(q || `${base()}poker-result.json`))
  return data ? { data, sample: false } : null
}

export async function loadBots(): Promise<RegisteredBot[] | null> {
  const q = devParam('bots')
  const raw = q === 'sample' ? (await import('./bots.sample.json')).default : await getJson(q || `${base()}bots.json`)
  if (!Array.isArray(raw)) return null
  return raw.filter(b => b && typeof b === 'object').map(b => ({
    name: String(b.name ?? '?'), game: String(b.game ?? '?'), owner: String(b.owner ?? ''), codeHash: String(b.codeHash ?? ''), house: Boolean(b.house),
    verifyCommand: typeof b.verifyCommand === 'string' ? b.verifyCommand : undefined,
  }))
}
