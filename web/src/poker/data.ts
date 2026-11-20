export interface PokerBot { id: string; name: string; strategy: string; address: string; startChips: number; stakeTxHash?: string }
export interface PokerAction { street: string; botId: string; action: string; amount: number; pot: number }
export interface PokerHand { n: number; holeCards: Record<string, string[]>; board: string[]; actions: PokerAction[]; winnerId: string; chipsAfter: Record<string, number> }
export interface PokerResult {
  version: number; game: string; chainId: number; explorerBaseUrl: string; matchId: string
  stakeUsdc: string; potUsdc: string; bots: PokerBot[]; hands: PokerHand[]
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

/** Fill defaults; null when the file cannot be shown. */
export function validatePoker(raw: unknown): PokerResult | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Partial<PokerResult>
  if (!Array.isArray(d.bots) || d.bots.length < 2 || !Array.isArray(d.hands) || !isInt(d.potUsdc) || !isInt(d.stakeUsdc)) return null
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
    stakeUsdc: d.stakeUsdc as string, potUsdc: d.potUsdc as string,
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
