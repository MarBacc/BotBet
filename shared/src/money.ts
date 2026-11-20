/**
 * The only USDC conversion helpers in BotBet. See interfaces.md section 0.
 *
 * USDC on Arc is used through its ERC-20 interface: 6 decimals. Every amount that crosses a
 * boundary — Solidity, JSON, env, UI props — is an integer number of base units, carried as a
 * bigint in TypeScript and as a decimal string in JSON. Never a float, never 18 decimals.
 */

export const USDC_DECIMALS = 6;
export const USDC_UNIT = 1_000_000n;

/** Thrown instead of silently producing a wrong amount. */
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/**
 * Human amount -> base units. `toBaseUnits("5.5") === 5500000n`
 *
 * Accepts a decimal string, or a number for convenience (integers and short decimals only —
 * anything that stringifies to exponent notation is rejected rather than guessed at).
 */
export function toBaseUnits(human: string | number): bigint {
  const raw = typeof human === "number" ? numberToDecimalString(human) : human.trim();
  if (raw === "") throw new MoneyError("empty amount");

  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!match) throw new MoneyError(`not a decimal amount: ${JSON.stringify(human)}`);

  const [, sign, whole = "", fraction = ""] = match;
  if (whole === "" && fraction === "") throw new MoneyError(`not a decimal amount: ${JSON.stringify(human)}`);
  if (fraction.length > USDC_DECIMALS) {
    throw new MoneyError(
      `${raw} has ${fraction.length} decimal places; USDC has ${USDC_DECIMALS}. Round before converting.`,
    );
  }

  const padded = fraction.padEnd(USDC_DECIMALS, "0");
  const base = BigInt(whole === "" ? "0" : whole) * USDC_UNIT + BigInt(padded === "" ? "0" : padded);
  return sign === "-" ? -base : base;
}

/** Base units -> human amount, trailing zeros trimmed. `fromBaseUnits(5500000n) === "5.5"` */
export function fromBaseUnits(base: bigint | string): string {
  const value = typeof base === "bigint" ? base : parseBaseUnits(base);
  const negative = value < 0n;
  const abs = negative ? -value : value;

  const whole = abs / USDC_UNIT;
  const fraction = (abs % USDC_UNIT).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");

  return `${negative ? "-" : ""}${whole}${fraction === "" ? "" : `.${fraction}`}`;
}

/** Base units -> display string. `formatUsdc(5500000n) === "5.50 USDC"` */
export function formatUsdc(
  base: bigint | string,
  options: { decimals?: number; symbol?: boolean } = {},
): string {
  const { decimals = 2, symbol = true } = options;
  const value = typeof base === "bigint" ? base : parseBaseUnits(base);
  const negative = value < 0n;
  const abs = negative ? -value : value;

  const whole = (abs / USDC_UNIT).toString();
  const fraction = (abs % USDC_UNIT).toString().padStart(USDC_DECIMALS, "0").slice(0, decimals);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const amount = `${negative ? "-" : ""}${grouped}${decimals > 0 ? `.${fraction}` : ""}`;
  return symbol ? `${amount} USDC` : amount;
}

/** Parse a base-unit string from JSON or the chain. Rejects decimals — base units are integers. */
export function parseBaseUnits(base: string | bigint): bigint {
  if (typeof base === "bigint") return base;
  const raw = base.trim();
  if (!/^-?\d+$/.test(raw)) {
    throw new MoneyError(`base units must be an integer string, got ${JSON.stringify(base)}`);
  }
  return BigInt(raw);
}

function numberToDecimalString(value: number): string {
  if (!Number.isFinite(value)) throw new MoneyError(`not a finite amount: ${value}`);
  const raw = String(value);
  if (raw.includes("e") || raw.includes("E")) {
    throw new MoneyError(`${raw} is in exponent notation; pass it as a decimal string instead`);
  }
  return raw;
}
