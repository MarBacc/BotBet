/**
 * A UCI engine over stdio. See interfaces.md section 3.
 *
 * One process per bot, so each player keeps its own search state. The transport is plain UCI on
 * stdin/stdout, which means the same driver speaks to a native Stockfish binary (STOCKFISH_PATH)
 * or to the WASM build bundled in node_modules — a `.js` engine is run through node, anything
 * else is executed directly.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);

/** How long we wait for a `bestmove` beyond the engine's own movetime before calling it hung. */
const BESTMOVE_GRACE_MS = 15_000;
const HANDSHAKE_TIMEOUT_MS = 30_000;

/**
 * STOCKFISH_PATH wins; otherwise the bundled single-threaded WASM build. Single-threaded on
 * purpose: with one thread the search depends only on the depth, so a game is reproducible.
 */
export function resolveEnginePath(): string {
  const fromEnv = process.env.STOCKFISH_PATH?.trim();
  if (fromEnv) return fromEnv;
  return require_.resolve("stockfish/bin/stockfish-19-lite-single.js");
}

interface Waiter {
  test: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class Engine {
  /** Engine name from the UCI `id name` line, for logging. */
  name = "unknown engine";

  private buffer = "";
  private waiters: Waiter[] = [];
  private dead: Error | null = null;

  private constructor(
    readonly path: string,
    private readonly child: ChildProcess,
  ) {
    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => this.onStdout(chunk));
    child.on("exit", (code, signal) => {
      this.fail(new Error(`engine exited (code ${code ?? "null"}, signal ${signal ?? "null"})`));
    });
    child.on("error", (error) => this.fail(error));
  }

  /** Spawn an engine and complete the UCI handshake. */
  static async start(enginePath: string = resolveEnginePath()): Promise<Engine> {
    const runWithNode = /\.(c?js|mjs)$/i.test(enginePath);
    const child = runWithNode
      ? spawn(process.execPath, [enginePath], { stdio: ["pipe", "pipe", "pipe"] })
      : spawn(enginePath, { stdio: ["pipe", "pipe", "pipe"] });

    const engine = new Engine(enginePath, child);
    const idLine = engine.waitFor((l) => l.startsWith("id name "), HANDSHAKE_TIMEOUT_MS).catch(() => null);
    engine.send("uci");
    await engine.waitFor((l) => l === "uciok", HANDSHAKE_TIMEOUT_MS);
    const id = await idLine;
    if (id) engine.name = id.slice("id name ".length).trim();
    await engine.isReady();
    return engine;
  }

  /** Tell the engine a fresh game is starting and wait until it is ready again. */
  async newGame(): Promise<void> {
    this.send("ucinewgame");
    await this.isReady();
  }

  /**
   * Search the position reached by `moves` from the start (or from `startFen`) and return the chosen move in UCI
   * notation. Stops at `depth` or `movetimeMs`, whichever comes first — Stockfish honours both
   * limits, so the shallow bot answers fast while the deep one stays inside the 3 s budget.
   */
  async bestMove(moves: readonly string[], depth: number, movetimeMs: number, startFen?: string): Promise<string> {
    const base = startFen ? `position fen ${startFen}` : "position startpos";
    this.send(moves.length === 0 ? base : `${base} moves ${moves.join(" ")}`);
    this.send(`go depth ${depth} movetime ${movetimeMs}`);

    const line = await this.waitFor((l) => l.startsWith("bestmove"), movetimeMs + BESTMOVE_GRACE_MS);
    const move = line.split(/\s+/)[1];
    if (!move || move === "(none)") throw new Error(`${this.name} returned no move: ${JSON.stringify(line)}`);
    return move;
  }

  async isReady(): Promise<void> {
    this.send("isready");
    await this.waitFor((l) => l === "readyok", HANDSHAKE_TIMEOUT_MS);
  }

  /** Ask the engine to quit, then make sure the process is gone. */
  async quit(): Promise<void> {
    if (!this.dead) {
      try {
        this.send("quit");
      } catch {
        // already gone
      }
    }
    this.child.kill();
    this.fail(new Error("engine stopped"));
  }

  private send(command: string): void {
    if (this.dead) throw this.dead;
    this.child.stdin!.write(`${command}\n`);
  }

  private waitFor(test: (line: string) => boolean, timeoutMs: number): Promise<string> {
    if (this.dead) return Promise.reject(this.dead);
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.timer !== timer);
        reject(new Error(`${this.name} timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.waiters.push({ test, resolve, reject, timer });
    });
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    let index: number;
    while ((index = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (line === "") continue;
      const waiter = this.waiters.find((w) => w.test(line));
      if (waiter) {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        clearTimeout(waiter.timer);
        waiter.resolve(line);
      }
    }
  }

  /** Mark the engine unusable and reject anything still waiting on it. */
  private fail(error: Error): void {
    if (this.dead) return;
    this.dead = error;
    const pending = this.waiters;
    this.waiters = [];
    for (const waiter of pending) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }
}
