/**
 * `npm run settle-poker` — a poker match settled on the existing MatchEscrow, same flow as chess:
 * preflight → createMatch → approve + stake (both bots) → play (seed = matchId) → referee signs
 * the EIP-712 MatchResult → settle → web/public/poker-result.json.
 *
 *   npm run settle-poker -- --dry-run [--bots theory,maniac] [--hands 30]
 *
 * --dry-run only reads the chain (chain id, escrow config, balances) and prints the plan.
 * Bot A uses BOT_1_PRIVATE_KEY and bot B BOT_2_PRIVATE_KEY: the same addresses as chess.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  type Abi, type Address, type Hash, type Hex, createPublicClient, createWalletClient, defineChain, erc20Abi, http,
  isAddressEqual, parseEventLogs, toHex,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { formatUsdc, toBaseUnits } from "botbet-shared";
import { box } from "../box.js";
import { ARC_TESTNET_CHAIN_ID, assertPrivateKeys, loadEnv, readArcDeployments, refereeAccount, requirePrivateKey } from "../env.js";
import { matchDomain, recoverMatchResultSigner, signMatchResult, type MatchResult } from "../result.js";
import { DEFAULT_RPC_URL, EXPLORER_BASE_URL } from "../settle-constants.js";
import { playMatch, POKER_BOTS, pokerResultJson } from "./match.js";
import { parsePokerArgs } from "./play-poker.js";

const GAS_BUFFER = toBaseUnits("0.05");
const MIN_FEE = 40_000_000_000n; // 2× Arc's 20 gwei floor, as settle-core pins it
const usdc6 = (x: bigint) => formatUsdc(x, { decimals: 6 });

async function main(): Promise<void> {
  const args = parsePokerArgs(process.argv.slice(2));
  loadEnv();
  const deployments = readArcDeployments();
  assertPrivateKeys(["DEPLOYER_PRIVATE_KEY", "REFEREE_PRIVATE_KEY", "BOT_1_PRIVATE_KEY", "BOT_2_PRIVATE_KEY"]);
  refereeAccount(deployments); // the key must derive to the deployed referee

  const rpcUrl = process.env.ARC_RPC_URL?.trim() || DEFAULT_RPC_URL;
  const escrow = deployments.contracts.MatchEscrow.address;
  const abi = deployments.contracts.MatchEscrow.abi as Abi;
  const usdc = deployments.usdc;
  const stake = toBaseUnits(process.env.STAKE_USDC?.trim() || "2");
  const txUrl = (h: Hash) => `${EXPLORER_BASE_URL}/tx/${h}`;
  const admin = privateKeyToAccount(requirePrivateKey("DEPLOYER_PRIVATE_KEY"));
  const refereeKey = requirePrivateKey("REFEREE_PRIVATE_KEY");
  const referee = privateKeyToAccount(refereeKey);
  const botAccts = [privateKeyToAccount(requirePrivateKey("BOT_1_PRIVATE_KEY")), privateKeyToAccount(requirePrivateKey("BOT_2_PRIVATE_KEY"))] as const;
  const bots = [POKER_BOTS[args.bots[0]]!, POKER_BOTS[args.bots[1]]!] as const;

  console.log(`BotBet — settle-poker on Arc testnet${args.dryRun ? " (DRY RUN: nothing will be sent)" : " (real transactions)"}`);
  const chain = defineChain({ id: ARC_TESTNET_CHAIN_ID, name: "arc-testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
  const transport = http(rpcUrl, { retryCount: 2, timeout: 20_000 });
  const pub = createPublicClient({ chain, transport });
  const read = <T>(fn: string, a: readonly unknown[] = []) => pub.readContract({ address: escrow, abi, functionName: fn, args: a }) as Promise<T>;
  const balanceOf = (a: Address) => pub.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [a] });

  // 1. preflight
  const chainId = await pub.getChainId();
  const [onReferee, onAdmin, onUsdc] = await Promise.all([read<Address>("referee"), read<Address>("admin"), read<Address>("usdc")]);
  const checks: [string, boolean][] = [
    [`chain ${chainId} = ${ARC_TESTNET_CHAIN_ID}`, chainId === ARC_TESTNET_CHAIN_ID],
    [`referee() ${onReferee} = REFEREE key`, isAddressEqual(onReferee, referee.address)],
    [`admin() ${onAdmin} = DEPLOYER key`, isAddressEqual(onAdmin, admin.address)],
    [`usdc() ${onUsdc} = ${usdc}`, isAddressEqual(onUsdc, usdc)],
    ["bots distinct", !isAddressEqual(botAccts[0].address, botAccts[1].address)],
  ];
  const needs: [string, Address, bigint][] = [
    ["admin (gas)", admin.address, GAS_BUFFER], ["referee (gas)", referee.address, GAS_BUFFER],
    [`${bots[0].name} (stake + gas)`, botAccts[0].address, stake + GAS_BUFFER], [`${bots[1].name} (stake + gas)`, botAccts[1].address, stake + GAS_BUFFER],
  ];
  for (const [label, a, need] of needs) {
    const bal = await balanceOf(a);
    checks.push([`${label.padEnd(26)} ${a} ${usdc6(bal)} ≥ ${usdc6(need)}`, bal >= need]);
  }
  for (const [name, passed] of checks) console.log(`  ${passed ? "✅" : "❌"} ${name}`);
  const failed = checks.filter(([, p]) => !p);
  if (failed.length) throw new Error(`preflight failed: ${failed.map(([n]) => n).join("; ")}`);

  const matchId = toHex(randomBytes(32));
  console.log(`\nPlan: createMatch ${matchId} · ${bots[0].name} (${botAccts[0].address}) vs ${bots[1].name} (${botAccts[1].address}) · stake ${usdc6(stake)} each, pot ${usdc6(stake * 2n)} · ${args.hands} hands HU-LHE, seed = matchId`);
  if (args.dryRun) {
    console.log(`\n${box("🧪 POKER DRY RUN PASSED: nothing was sent", [`escrow ${escrow}`, `stake  ${usdc6(stake)} per bot`, `bots   ${bots[0].name} vs ${bots[1].name}`])}`);
    return;
  }

  // 2-4. on-chain: createMatch, approve + stake ×2
  const fees = await pub.estimateFeesPerGas();
  const maxFeePerGas = fees.maxFeePerGas < MIN_FEE ? MIN_FEE : fees.maxFeePerGas;
  const feeArgs = { maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas > maxFeePerGas ? maxFeePerGas : fees.maxPriorityFeePerGas };
  const txs: Record<string, string> = {};
  const send = async (key: string, account: PrivateKeyAccount, address: Address, cAbi: Abi, functionName: string, a: readonly unknown[]) => {
    const { request } = await pub.simulateContract({ account, address, abi: cAbi, functionName, args: a, ...feeArgs });
    const hash = await createWalletClient({ account, chain, transport }).writeContract(request);
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
    if (receipt.status !== "success") throw new Error(`${key} reverted: ${txUrl(hash)}`);
    console.log(`  ✅ ${key.padEnd(16)} ${txUrl(hash)}`);
    txs[key] = hash;
    return receipt;
  };
  await send("createMatch", admin, escrow, abi, "createMatch", [matchId, botAccts[0].address, botAccts[1].address, stake]);
  for (const [i, acct] of botAccts.entries()) {
    await send(`${bots[i]!.id}.approve`, acct, usdc, erc20Abi as Abi, "approve", [escrow, stake]);
    await send(`${bots[i]!.id}.stake`, acct, escrow, abi, "stake", [matchId]);
  }
  const m = await read<{ status: number }>("getMatch", [matchId]);
  if (m.status !== 2) throw new Error(`match status ${m.status} after both stakes; expected 2 (Funded)`);

  // 5-6. play and sign
  const o = playMatch({ seed: matchId, bots, hands: args.hands });
  const finishedAt = Math.floor(Date.now() / 1000);
  const result: MatchResult = { matchId, winner: botAccts[o.winnerSeat].address, moveCount: o.handsPlayed, pgnHash: o.handHistoryHash, finishedAt: BigInt(finishedAt) };
  const domain = matchDomain(ARC_TESTNET_CHAIN_ID, escrow);
  const signature: Hex = await signMatchResult(refereeKey, domain, result);
  if (!isAddressEqual(await recoverMatchResultSigner(domain, result, signature), onReferee)) throw new Error("signature does not recover to the on-chain referee");
  console.log(`  ✅ ${bots[o.winnerSeat].name} wins ${o.chips[o.winnerSeat]}–${o.chips[o.winnerSeat ? 0 : 1]} chips in ${o.handsPlayed} hands; signed`);

  // 7. settle
  const receipt = await send("settle", referee, escrow, abi, "settle", [matchId, result, signature]);
  const ev = parseEventLogs({ abi, eventName: "Settled", logs: receipt.logs }).find((l) => isAddressEqual(l.address, escrow));
  if (!ev) throw new Error(`settle mined but no Settled event: ${txUrl(txs.settle as Hash)}`);

  // 8. poker-result.json
  const json = pokerResultJson(o, { addresses: [botAccts[0].address, botAccts[1].address], matchId, chainId: ARC_TESTNET_CHAIN_ID, escrow, refereeAddress: referee.address, finishedAt, signature, offline: false, txs, stakeUsdc: stake });
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`\n${box("✅ POKER SETTLED", [`winner ${bots[o.winnerSeat].name} in ${o.handsPlayed} hands`, `settle ${txUrl(txs.settle as Hash)}`, `wrote  ${args.out}`])}`);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`\n${box("❌ SETTLE-POKER FAILED", msg.split("\n").map((l) => `error  ${l}`))}`);
  process.exitCode = 1;
});
