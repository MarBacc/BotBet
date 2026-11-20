/**
 * `npm run rehearse:local` — the REAL settle loop (src/settle-core.ts, the same code `npm run settle`
 * runs) end to end against a local anvil chain. No real keys, no real money.
 *
 *   anvil (chain 5042002) → deploy MockUSDC (6 decimals) + a fresh MatchEscrow from contracts/out →
 *   mint USDC → runSettle() ×N → /tmp/rehearsal-result.json
 *
 * Accounts are anvil's well-known PUBLIC test keys (mnemonic "test test … junk"): never use them on
 * a real network. Requires `cd contracts && forge build` first (read-only use of contracts/).
 *
 * Flags: --runs <n> (default 2), --fen "<FEN>", --rpc <url> (default http://127.0.0.1:8545; anvil is
 * started on that port if nothing answers, and stopped afterwards).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, defineChain, http, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { formatUsdc, toBaseUnits } from "botbet-shared";
import { ARC_TESTNET_CHAIN_ID } from "../src/env.js";
import { SettleError } from "../src/errors.js";
import { StepFailure, runSettle } from "../src/settle-core.js";
import { AGENT_WALLET_ABI, runCapDemo } from "../src/cap-demo-core.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = resolve(REPO_ROOT, "contracts", "out");
const RESULT_PATH = "/tmp/rehearsal-result.json";
const CAP_DEMO_PATH = "/tmp/rehearsal-cap-demo.json";

/** anvil's default accounts 0–3. Public test keys, published in the Foundry docs. */
const ANVIL_KEYS: readonly Hex[] = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
];

function parseArgs(argv: string[]) {
  const args = { runs: 2, fen: undefined as string | undefined, rpc: "http://127.0.0.1:8545" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--runs") args.runs = Number(argv[++i]);
    else if (a === "--fen") args.fen = argv[++i];
    else if (a === "--rpc") args.rpc = argv[++i]!;
    else throw new Error(`unknown argument ${a}. Usage: npm run rehearse:local -- [--runs n] [--fen "<FEN>"] [--rpc url]`);
  }
  if (!Number.isInteger(args.runs) || args.runs < 1) throw new Error("--runs must be a positive integer");
  return args;
}

function artifact(file: string, name: string): { abi: Abi; bytecode: Hex } {
  const path = resolve(OUT, file, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(`${path} not found. Build first:  cd contracts && forge build  (on macOS, if forge cannot load libusb: export DYLD_FALLBACK_LIBRARY_PATH="$HOME/.foundry/lib")`);
  }
  const json = JSON.parse(readFileSync(path, "utf8")) as { abi: Abi; bytecode: { object: Hex } };
  return { abi: json.abi, bytecode: json.bytecode.object };
}

async function rpcAlive(url: string): Promise<number | undefined> {
  try {
    return await createPublicClient({ transport: http(url, { retryCount: 0, timeout: 1_500 }) }).getChainId();
  } catch {
    return undefined;
  }
}

async function startAnvil(url: string): Promise<ChildProcess> {
  const port = new URL(url).port || "8545";
  const bin = resolve(homedir(), ".foundry", "bin", "anvil");
  const child = spawn(existsSync(bin) ? bin : "anvil", ["--chain-id", String(ARC_TESTNET_CHAIN_ID), "--port", port, "--silent"], {
    stdio: "ignore",
    // Foundry ships libusb next to its binaries; dyld falls back to it when Homebrew's copy is absent.
    env: { ...process.env, DYLD_FALLBACK_LIBRARY_PATH: [process.env.DYLD_FALLBACK_LIBRARY_PATH, resolve(homedir(), ".foundry", "lib")].filter(Boolean).join(":") },
  });
  for (let i = 0; i < 50; i++) {
    if ((await rpcAlive(url)) !== undefined) return child;
    if (child.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`anvil did not start on ${url}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  console.log("BotBet — LOCAL REHEARSAL (anvil, public test keys, mock USDC: nothing here is real money)");

  let anvil: ChildProcess | undefined;
  const existing = await rpcAlive(args.rpc);
  if (existing === undefined) {
    anvil = await startAnvil(args.rpc);
    console.log(`  started anvil (pid ${anvil.pid}) on ${args.rpc}, chain ${ARC_TESTNET_CHAIN_ID}`);
  } else if (existing !== ARC_TESTNET_CHAIN_ID) {
    throw new Error(`${args.rpc} is chain ${existing}; restart anvil with --chain-id ${ARC_TESTNET_CHAIN_ID}`);
  } else {
    console.log(`  using the anvil already on ${args.rpc}`);
  }

  try {
    const chain = defineChain({
      id: ARC_TESTNET_CHAIN_ID,
      name: "anvil-as-arc",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, // anvil gas only
      rpcUrls: { default: { http: [args.rpc] } },
    });
    const client = createPublicClient({ chain, transport: http(args.rpc) });
    const [admin, referee, deep, hasty] = ANVIL_KEYS.map((k) => privateKeyToAccount(k));
    const adminWallet = createWalletClient({ account: admin!, chain, transport: http(args.rpc) });

    const deploy = async (file: string, name: string, ctorArgs: readonly unknown[]): Promise<{ address: Address; abi: Abi }> => {
      const { abi, bytecode } = artifact(file, name);
      const hash = await adminWallet.deployContract({ abi, bytecode, args: ctorArgs });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error(`${name} deploy failed`);
      return { address: receipt.contractAddress, abi };
    };

    const usdc = await deploy("MockUSDC.sol", "MockUSDC", []);
    const escrow = await deploy("MatchEscrow.sol", "MatchEscrow", [referee!.address, usdc.address]);
    console.log(`  MockUSDC    ${usdc.address}\n  MatchEscrow ${escrow.address} (referee ${referee!.address})`);

    const grant = toBaseUnits("20");
    for (const account of [admin!, referee!, deep!, hasty!]) {
      const hash = await adminWallet.writeContract({ address: usdc.address, abi: usdc.abi, functionName: "mint", args: [account.address, grant] });
      await client.waitForTransactionReceipt({ hash });
    }
    console.log(`  minted ${formatUsdc(grant)} (mock) to admin, referee and both bots`);

    const settleTxs: string[] = [];
    for (let run = 1; run <= args.runs; run++) {
      console.log(`\n══════════ rehearsal run ${run}/${args.runs} ══════════`);
      const started = Date.now();
      const summary = await runSettle({
        rpcUrl: args.rpc,
        chainId: ARC_TESTNET_CHAIN_ID,
        escrow: escrow.address,
        escrowAbi: escrow.abi,
        usdc: usdc.address,
        explorerBaseUrl: "local-anvil",
        outPath: RESULT_PATH,
        adminKey: ANVIL_KEYS[0]!,
        refereeKey: ANVIL_KEYS[1]!,
        botKeys: { deep: ANVIL_KEYS[2]!, hasty: ANVIL_KEYS[3]! },
        stake: toBaseUnits("2"),
        startFen: args.fen,
      });
      settleTxs.push(summary.txs!.settle!.hash);
      console.log(`  run ${run} settled in ${((Date.now() - started) / 1000).toFixed(1)}s: ${summary.txs!.settle!.hash}`);
    }

    // AgentWallet cap demo against the real AgentWallet bytecode, if it has been built.
    let capLine = "cap demo skipped (no contracts/out/AgentWallet.sol; run forge build)";
    if (existsSync(resolve(OUT, "AgentWallet.sol", "AgentWallet.json"))) {
      console.log("\n══════════ cap demo (AgentWallet) ══════════");
      const built = artifact("AgentWallet.sol", "AgentWallet").abi;
      const names = (abi: readonly { type: string; name?: string }[]) =>
        abi.filter((x) => x.type !== "constructor").map((x) => `${x.type}:${x.name}`).sort().join(",");
      if (names(built as never) !== names(AGENT_WALLET_ABI)) {
        throw new Error(`AGENT_WALLET_ABI drifted from the forge artifact:\n  ours  ${names(AGENT_WALLET_ABI)}\n  forge ${names(built as never)}`);
      }
      console.log("  ✅ AGENT_WALLET_ABI matches contracts/out/AgentWallet.sol");
      const capWallet = await deploy("AgentWallet.sol", "AgentWallet", [usdc.address, admin!.address, toBaseUnits("0.05")]);
      const fund = await adminWallet.writeContract({ address: usdc.address, abi: usdc.abi, functionName: "mint", args: [capWallet.address, toBaseUnits("0.20")] });
      await client.waitForTransactionReceipt({ hash: fund });
      console.log(`  AgentWallet ${capWallet.address} (owner admin, cap 0.05, funded 0.20 mock USDC)`);
      const capCfg = {
        rpcUrl: args.rpc,
        chainId: ARC_TESTNET_CHAIN_ID,
        wallet: capWallet.address,
        usdc: usdc.address,
        recipient: referee!.address,
        ownerKey: ANVIL_KEYS[0]!,
        explorerBaseUrl: "local-anvil",
        outPath: CAP_DEMO_PATH,
      };
      await runCapDemo({ ...capCfg, dryRun: true });
      const cap = await runCapDemo(capCfg);
      capLine = `cap demo: allowed ${cap.allowed.amount} (tx ${cap.allowed.txHash}), refused ${cap.refused.amount} ${cap.refused.reason} → ${CAP_DEMO_PATH}`;
    }

    console.log(`\n✅ REHEARSAL PASSED: ${args.runs} settles on local anvil in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    settleTxs.forEach((h, i) => console.log(`   run ${i + 1} settle tx ${h}`));
    console.log(`   last result: ${RESULT_PATH}`);
    console.log(`   ${capLine}`);
  } finally {
    if (anvil) {
      anvil.kill();
      console.log(`  stopped anvil (pid ${anvil.pid})`);
    }
  }
}

main().catch((error: unknown) => {
  const cause = error instanceof StepFailure ? error.cause : error;
  const step = error instanceof StepFailure ? ` at "${error.step}"` : "";
  console.error(`\n❌ REHEARSAL FAILED${step}: ${cause instanceof Error ? cause.message : String(cause)}`);
  if (cause instanceof SettleError && cause.hint) console.error(`   → ${cause.hint}`);
  process.exitCode = 1;
});
