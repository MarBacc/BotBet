// shared/src/money.ts — the only USDC conversion in BotBet (6 decimals, base units as bigint).
import { test } from "node:test";
import assert from "node:assert/strict";
import { USDC_DECIMALS, USDC_UNIT, fromBaseUnits, formatUsdc, MoneyError, parseBaseUnits, toBaseUnits } from "botbet-shared";

test("constants are 6 decimals, never 18", () => {
  assert.equal(USDC_DECIMALS, 6);
  assert.equal(USDC_UNIT, 1_000_000n);
});

test("toBaseUnits: decimal strings", () => {
  assert.equal(toBaseUnits("5.5"), 5_500_000n);
  assert.equal(toBaseUnits("2"), 2_000_000n);
  assert.equal(toBaseUnits("0.000001"), 1n);
  assert.equal(toBaseUnits("0.05"), 50_000n);
  assert.equal(toBaseUnits(".5"), 500_000n);
  assert.equal(toBaseUnits("5."), 5_000_000n);
  assert.equal(toBaseUnits(" 1.25 "), 1_250_000n);
  assert.equal(toBaseUnits("-1.5"), -1_500_000n);
  assert.equal(toBaseUnits("1000000"), 1_000_000_000_000n); // MAX_STAKE
});

test("toBaseUnits: numbers, only when unambiguous", () => {
  assert.equal(toBaseUnits(0.1), 100_000n);
  assert.equal(toBaseUnits(2), 2_000_000n);
  assert.throws(() => toBaseUnits(1e21), MoneyError); // exponent notation
  assert.throws(() => toBaseUnits(Number.NaN), MoneyError);
  assert.throws(() => toBaseUnits(Number.POSITIVE_INFINITY), MoneyError);
});

test("toBaseUnits: refuses what it cannot represent exactly", () => {
  assert.throws(() => toBaseUnits("1.0000001"), /7 decimal places/); // 7th decimal: would need rounding
  assert.throws(() => toBaseUnits(""), MoneyError);
  assert.throws(() => toBaseUnits("."), MoneyError);
  assert.throws(() => toBaseUnits("abc"), MoneyError);
  assert.throws(() => toBaseUnits("1,000"), MoneyError);
  assert.throws(() => toBaseUnits("1e6"), MoneyError);
});

test("fromBaseUnits: trims trailing zeros, round-trips", () => {
  assert.equal(fromBaseUnits(5_500_000n), "5.5");
  assert.equal(fromBaseUnits(0n), "0");
  assert.equal(fromBaseUnits(1n), "0.000001");
  assert.equal(fromBaseUnits("2000000"), "2");
  assert.equal(fromBaseUnits(-1_500_000n), "-1.5");
  for (const s of ["0.02", "0.1", "19.957985", "1000000"]) assert.equal(fromBaseUnits(toBaseUnits(s)), s);
});

test("formatUsdc: truncates (never rounds up), groups thousands", () => {
  assert.equal(formatUsdc(5_500_000n), "5.50 USDC");
  assert.equal(formatUsdc(1_234_567_890n), "1,234.56 USDC"); // .567890 truncates to .56
  assert.equal(formatUsdc(999_999n), "0.99 USDC");
  assert.equal(formatUsdc("4000000", { decimals: 6 }), "4.000000 USDC");
  assert.equal(formatUsdc(50_000n, { decimals: 2, symbol: false }), "0.05"); // cap-demo.json capUsdc
  assert.equal(formatUsdc(100_000n, { decimals: 2, symbol: false }), "0.10");
  assert.equal(formatUsdc(2_000_000n, { decimals: 0 }), "2 USDC");
  assert.equal(formatUsdc(-3_124n, { decimals: 6 }), "-0.003124 USDC"); // a gas delta
  assert.equal(formatUsdc(1_000_000_000_000n, { decimals: 0 }), "1,000,000 USDC");
});

test("parseBaseUnits: integers only", () => {
  assert.equal(parseBaseUnits("42"), 42n);
  assert.equal(parseBaseUnits(" 42 "), 42n);
  assert.equal(parseBaseUnits("-7"), -7n);
  assert.equal(parseBaseUnits(9n), 9n);
  assert.throws(() => parseBaseUnits("1.5"), MoneyError);
  assert.throws(() => parseBaseUnits(""), MoneyError);
  assert.throws(() => parseBaseUnits("0x10"), MoneyError);
});
