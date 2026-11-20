/**
 * Turning viem failures into one line an operator (or a projector audience) can act on.
 */

import {
  BaseError,
  ContractFunctionRevertedError,
  HttpRequestError,
  TimeoutError,
  WaitForTransactionReceiptTimeoutError,
  type Hash,
} from "viem";

/** Thrown for failures we have already explained; the CLI prints `message` as-is. */
export class SettleError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = "SettleError";
  }
}

/** A failure tagged with the step it happened in, for the ❌ line and --json. */
export class StepFailure extends Error {
  constructor(readonly step: string, override readonly cause: SettleError) {
    super(cause.message);
    this.name = "StepFailure";
  }
}

/** A tx that was broadcast but never mined within the patience window. */
export class NotMinedError extends SettleError {
  constructor(readonly hash: Hash, readonly link: string, seconds: number) {
    super(`tx ${hash} was not mined within ${seconds}s: ${link}`, "Arc silently drops txs under the 20 gwei base fee; check maxFeePerGas and the explorer.");
  }
}

/** "InvalidMatch()" / "WrongStatus(2, 1)" for a custom-error revert, else undefined. */
export function decodeRevert(error: unknown): string | undefined {
  if (!(error instanceof BaseError)) return undefined;
  const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
  if (!reverted) return undefined;
  if (reverted.data?.errorName) {
    const args = (reverted.data.args ?? []).map((a) => (typeof a === "bigint" ? a.toString() : String(a)));
    return `${reverted.data.errorName}(${args.join(", ")})`;
  }
  if (reverted.reason) return `Error("${reverted.reason}")`;
  if (reverted.signature) return `unknown custom error ${reverted.signature}`;
  return "revert without reason";
}

export function isRpcUnreachable(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false;
  return Boolean(error.walk((e) => e instanceof HttpRequestError || (e instanceof TimeoutError && !(e instanceof WaitForTransactionReceiptTimeoutError))));
}

/** Explain any failure from a step, given the RPC URL for the unreachable case. */
export function explain(error: unknown, rpcUrl: string, what: string): SettleError {
  if (error instanceof SettleError) return error;
  const revert = decodeRevert(error);
  if (revert) return new SettleError(`${what} reverted: ${revert}`);
  if (isRpcUnreachable(error)) {
    return new SettleError(`${what}: RPC ${rpcUrl} is unreachable.`, "Check ARC_RPC_URL (default https://rpc.testnet.arc.io) and your network; docs/arc.md lists fallback RPCs.");
  }
  const message = error instanceof BaseError ? error.shortMessage : error instanceof Error ? error.message : String(error);
  return new SettleError(`${what} failed: ${message}`);
}
