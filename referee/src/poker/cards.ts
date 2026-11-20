/** Cards are 0..51: rank = c >> 2 (0 = deuce .. 12 = ace), suit = c & 3. Strings look like "As", "Td". */
import { createHash } from "node:crypto";

export type Card = number;
export const RANKS = "23456789TJQKA";
export const SUITS = "cdhs";

export const rankOf = (c: Card): number => c >> 2;
export const suitOf = (c: Card): number => c & 3;

export function cardStr(c: Card): string {
  return RANKS[rankOf(c)]! + SUITS[suitOf(c)]!;
}

export function parseCard(s: string): Card {
  const r = RANKS.indexOf(s[0]!.toUpperCase());
  const u = SUITS.indexOf(s[1]!.toLowerCase());
  if (s.length !== 2 || r < 0 || u < 0) throw new Error(`bad card ${JSON.stringify(s)}`);
  return (r << 2) | u;
}

export const parseCards = (s: string): Card[] => s.trim().split(/\s+/).filter(Boolean).map(parseCard);

/** A seeded RNG: sfc32 keyed by sha256(seed | label). Same seed and label → same stream. */
export type Rng = () => number;

export function makeRng(seed: string, label: string): Rng {
  const h = createHash("sha256").update(`${seed}|${label}`).digest();
  let a = h.readUInt32LE(0), b = h.readUInt32LE(4), c = h.readUInt32LE(8), d = h.readUInt32LE(12);
  const next = (): number => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next(); // warm up
  return next;
}

/** Fisher-Yates over a fresh 52-card deck. */
export function shuffledDeck(rng: Rng): Card[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}
