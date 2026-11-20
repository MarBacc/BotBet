export interface DemoPosition {
  id: string;
  fen: string;
  sideToMove: "w" | "b";
  note: string;
}

/** Small, decisive queen-and-king mating puzzles for a short live demo. */
export const DEMO_POSITIONS: DemoPosition[] = [
  {
    id: "queen-net-g7",
    fen: "7k/8/5KQ1/8/8/8/8/8 w - - 0 1",
    sideToMove: "w",
    note: "White has a forced queen mate on g7, protected by the king.",
  },
  {
    id: "queen-net-b7",
    fen: "k7/8/1QK5/8/8/8/8/8 w - - 0 1",
    sideToMove: "w",
    note: "White has a forced queen mate on b7, protected by the king.",
  },
  {
    id: "queen-net-g2",
    fen: "8/8/8/8/8/5KQ1/8/7k w - - 0 1",
    sideToMove: "w",
    note: "White has a forced queen mate on g2, protected by the king.",
  },
  {
    id: "queen-net-b2",
    fen: "8/8/1QK5/8/8/8/8/k7 w - - 0 1",
    sideToMove: "w",
    note: "White has a forced queen mate on b2, protected by the king.",
  },
  {
    id: "queen-net-e7",
    fen: "4k3/8/3QK3/8/8/8/8/8 w - - 0 1",
    sideToMove: "w",
    note: "White has a forced queen mate on e7, protected by the king.",
  },
];

// Provisional default: the first candidate has a forced mate in one by construction.
// Run check-positions.ts three times before presenting it as verified.
export const DEMO_DEFAULT = DEMO_POSITIONS[0]!;
