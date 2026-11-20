/**
 * One hand of heads-up fixed-limit Hold'em. Pure and deterministic given the deck and the bots.
 * Rules: README.md in this folder.
 */
import { type Card, cardStr, makeRng, type Rng, shuffledDeck } from "./cards.js";
import { evaluate } from "./evaluator.js";

export const SMALL_BLIND = 1;
export const BIG_BLIND = 2;
export const SMALL_BET = 2;
export const BIG_BET = 4;
export const MAX_BETS = 4;
export const STARTING_STACK = 100;

export type Street = "preflop" | "flop" | "turn" | "river";
export type ActionType = "fold" | "check" | "call" | "bet" | "raise";
export const STREETS: readonly Street[] = ["preflop", "flop", "turn", "river"];

export interface ActionRecord {
  seat: 0 | 1;
  street: Street;
  type: ActionType | "post";
  /** Chips put in by this action. */
  amount: number;
}

/** What a bot sees. No opponent hole cards. */
export interface DecisionState {
  seat: 0 | 1;
  hole: readonly [Card, Card];
  board: readonly Card[];
  street: Street;
  isButton: boolean;
  pot: number;
  toCall: number;
  betSize: number;
  betsThisStreet: number;
  myStack: number;
  oppStack: number;
  legal: readonly ActionType[];
  /** All actions so far in this hand. */
  history: readonly ActionRecord[];
}

export type Decide = (state: DecisionState, rng: Rng) => ActionType;

export interface HandResult {
  hole: [[Card, Card], [Card, Card]];
  board: Card[];
  actions: ActionRecord[];
  /** Winner seat, or null for a split pot. */
  winner: 0 | 1 | null;
  /** Total chips both players put in (after any unmatched refund). */
  pot: number;
  /** Net chip change per seat. */
  delta: [number, number];
  showdown: boolean;
}

export class IllegalAction extends Error {}

export function playHand(opts: {
  seed: string;
  handNo: number;
  button: 0 | 1;
  stacks: readonly [number, number];
  bots: readonly [Decide, Decide];
}): HandResult {
  const { seed, handNo, button, bots } = opts;
  const stacks: [number, number] = [opts.stacks[0], opts.stacks[1]];
  const deck = shuffledDeck(makeRng(seed, `deck:${handNo}`));
  const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0);
  const bb = other(button);
  // HU deal order: big blind first, then button, twice.
  const hole: [[Card, Card], [Card, Card]] = [[0, 0], [0, 0]];
  hole[bb] = [deck[0]!, deck[2]!];
  hole[button] = [deck[1]!, deck[3]!];
  const boardCards = deck.slice(5, 8).concat(deck[9]!, deck[11]!); // burn 4, flop 5-7, burn 8, turn 9, burn 10, river 11

  const contrib: [number, number] = [0, 0];
  const actions: ActionRecord[] = [];
  let board: Card[] = [];
  const put = (seat: 0 | 1, want: number): number => {
    const amt = Math.min(want, stacks[seat]);
    stacks[seat] -= amt;
    contrib[seat] += amt;
    return amt;
  };

  actions.push({ seat: button, street: "preflop", type: "post", amount: put(button, SMALL_BLIND) });
  actions.push({ seat: bb, street: "preflop", type: "post", amount: put(bb, BIG_BLIND) });

  let folded: 0 | 1 | null = null;
  const rng = makeRng(seed, `bots:${handNo}`);

  for (const street of STREETS) {
    if (street === "flop") board = boardCards.slice(0, 3);
    if (street === "turn") board = boardCards.slice(0, 4);
    if (street === "river") board = boardCards.slice(0, 5);
    const betSize = street === "preflop" || street === "flop" ? SMALL_BET : BIG_BET;
    const streetIn: [number, number] = street === "preflop" ? [contrib[0], contrib[1]] : [0, 0];
    let bets = street === "preflop" ? 1 : 0;
    let actor: 0 | 1 = street === "preflop" ? button : bb;
    let acted: [boolean, boolean] = [false, false];

    // Nobody can act once someone is all-in (stack 0) and the bets are matched.
    while (true) {
      const anyAllIn = stacks[0] === 0 || stacks[1] === 0;
      const matched = streetIn[0] === streetIn[1];
      if (matched && (acted[0] && acted[1])) break;
      if (anyAllIn && (matched || stacks[actor] === 0)) {
        // all-in: the other side may still need to call an outstanding amount
        if (stacks[actor] === 0 || matched) break;
      }
      const opp = other(actor);
      const toCall = Math.max(0, streetIn[opp] - streetIn[actor]);
      const canRaise = bets < MAX_BETS && stacks[actor] > toCall && stacks[opp] > 0;
      const legal: ActionType[] = toCall > 0
        ? ["fold", "call", ...(canRaise ? (["raise"] as const) : [])]
        : ["check", ...(canRaise ? (["bet"] as const) : [])];
      const state: DecisionState = {
        seat: actor, hole: hole[actor], board, street, isButton: actor === button,
        pot: contrib[0] + contrib[1], toCall, betSize, betsThisStreet: bets,
        myStack: stacks[actor], oppStack: stacks[opp], legal, history: actions.slice(),
      };
      const choice = bots[actor](state, rng);
      if (!legal.includes(choice)) {
        throw new IllegalAction(`hand ${handNo} seat ${actor} chose ${choice}; legal ${legal.join("/")}`);
      }
      let amount = 0;
      if (choice === "fold") {
        actions.push({ seat: actor, street, type: "fold", amount: 0 });
        folded = actor;
        break;
      } else if (choice === "call") {
        amount = put(actor, toCall);
      } else if (choice === "bet" || choice === "raise") {
        amount = put(actor, toCall + betSize);
        bets++;
        acted = [false, false];
      }
      streetIn[actor] += amount;
      actions.push({ seat: actor, street, type: choice, amount });
      acted[actor] = true;
      actor = opp;
    }
    if (folded !== null) break;
    if (stacks[0] === 0 || stacks[1] === 0) {
      board = boardCards.slice(0, 5); // run it out
      break;
    }
  }

  // Return any unmatched chips (an all-in for less).
  const matchedIn = Math.min(contrib[0], contrib[1]);
  for (const s of [0, 1] as const) {
    const extra = contrib[s] - matchedIn;
    stacks[s] += extra;
    contrib[s] -= extra;
  }
  const pot = contrib[0] + contrib[1];

  let winner: 0 | 1 | null;
  let showdown = false;
  if (folded !== null) {
    winner = other(folded);
  } else {
    showdown = true;
    board = boardCards.slice(0, 5);
    const s0 = evaluate([...hole[0], ...board]);
    const s1 = evaluate([...hole[1], ...board]);
    winner = s0 > s1 ? 0 : s1 > s0 ? 1 : null;
  }
  const delta: [number, number] = [-contrib[0], -contrib[1]];
  if (winner === null) {
    delta[0] += pot / 2; // pots are always even here: both sides matched
    delta[1] += pot / 2;
  } else {
    delta[winner] += pot;
  }
  return { hole, board, actions, winner, pot, delta, showdown };
}

export const handToJson = (h: HandResult, n: number, names: readonly [string, string]) => ({
  n,
  holeCards: { [names[0]]: h.hole[0].map(cardStr), [names[1]]: h.hole[1].map(cardStr) },
  board: h.board.map(cardStr),
  actions: h.actions.map((a) => ({ bot: names[a.seat], street: a.street, type: a.type, amount: a.amount })),
  winner: h.winner === null ? "split" : names[h.winner],
  pot: h.pot,
  showdown: h.showdown,
});
