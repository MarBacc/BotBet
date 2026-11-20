export interface DemoPosition {
  id: string;
  fen: string;
  sideToMove: "w" | "b";
  note: string;
}

/** The first position is the exact FEN used for the recorded live Arc settlement. */
export const DEMO_POSITIONS: DemoPosition[] = [
  {
    id: "arc-live-17-ply",
    fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1",
    sideToMove: "w",
    note: "Live Arc rehearsal: Deep Thought won by checkmate in 17 plies; settle 0x4f49823d648fc2512bd96c79622c17d04f4ce77d577ad87c6dd2f35c4d8755f3.",
  },
  {
    id: "arc-live-file-mirror",
    fen: "8/8/8/3k4/8/8/8/3KQ3 w - - 0 1",
    sideToMove: "w",
    note: "File-reflected candidate based on the live Arc position; not the live FEN.",
  },
  {
    id: "arc-live-rank-mirror",
    fen: "3QK3/8/8/8/4k3/8/8/8 w - - 0 1",
    sideToMove: "w",
    note: "Rank-reflected candidate based on the live Arc position; not the live FEN.",
  },
  {
    id: "arc-live-double-mirror",
    fen: "3KQ3/8/8/8/3k4/8/8/8 w - - 0 1",
    sideToMove: "w",
    note: "Rank-and-file-reflected candidate based on the live Arc position; not the live FEN.",
  },
  {
    id: "queen-c1-candidate",
    fen: "8/8/8/4k3/8/8/8/2Q1K3 w - - 0 1",
    sideToMove: "w",
    note: "Alternate queen placement for checker coverage; not the live FEN.",
  },
];

/** Default to the exact position played and settled live on Arc. */
export const DEMO_DEFAULT = DEMO_POSITIONS[0]!;
