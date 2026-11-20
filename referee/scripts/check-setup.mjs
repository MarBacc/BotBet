// Presenter's pre-flight: `npm run check-setup` prints one screen, READY / REPLAY ONLY / NOT READY.
// Plain Node, no dependencies, so it works before `npm install` or the shared build.
// `--quiet` (used as the prefix of every other referee script) prints only blocking problems.
// Keys are checked as set/MISSING only; no value is ever printed.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const quiet = process.argv.includes("--quiet");
const referee = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(referee, "..");
const KEYS = ["DEPLOYER_PRIVATE_KEY", "REFEREE_PRIVATE_KEY", "BOT_1_PRIVATE_KEY", "BOT_2_PRIVATE_KEY"];
const RPC = () => process.env.ARC_RPC_URL?.trim() || "https://rpc.testnet.arc.io";

/** [group, label, ok, detail, fix] */
const rows = [];
const add = (group, label, ok, detail = "", fix = "") => rows.push({ group, label, ok, detail, fix });

// ── REQUIRED: every script needs these ─────────────────────────────────────────────────────────
const [major, minor] = process.versions.node.split(".").map(Number);
add("required", "Node ≥ 20.12", major > 20 || (major === 20 && minor >= 12), `v${process.versions.node}`, "install Node 20.12+ or 24");
add("required", "shared/ built", existsSync(resolve(root, "shared", "dist", "index.js")), "", "cd shared && npm install && npm run build");
const missingDep = ["viem", "chess.js", "stockfish", "botbet-shared", "tsx"].find((d) => !existsSync(resolve(referee, "node_modules", d)));
add("required", "referee deps installed", !missingDep, missingDep ? `missing ${missingDep}` : "", "cd referee && npm install");
add("required", "shared/deployments.json", existsSync(resolve(root, "shared", "deployments.json")), "", "git pull (it is committed)");

if (quiet) {
  const bad = rows.filter((r) => !r.ok);
  if (bad.length) {
    console.error("❌ referee setup is incomplete:");
    for (const r of bad) console.error(`   - ${r.label}${r.detail ? ` (${r.detail})` : ""}. Run:  ${r.fix}`);
    process.exit(1);
  }
  process.exit(0);
}

// ── LIVE: needed for `npm run settle` / `npm run demo` ─────────────────────────────────────────
const envPath = process.env.BOTBET_ENV_FILE?.trim() ? resolve(process.env.BOTBET_ENV_FILE.trim()) : resolve(root, ".env");
const envExists = existsSync(envPath);
add("live", ".env present", envExists, envExists ? envPath : `not at ${envPath}`, "cp .env.example .env and fill in the 4 burner keys");
if (envExists) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    add("live", ".env parses", false, "", "check .env syntax: NAME=value, no `export`");
  }
}
const keyState = KEYS.map((k) => [k, /^0x[0-9a-fA-F]{64}$/.test(process.env[k]?.trim() || "")]);
for (const [k, ok] of keyState) add("live", k, ok, ok ? "set" : "MISSING", `${k}=0x<64 hex> in .env`);
let chainOk = false;
let chainDetail = "";
try {
  const res = await fetch(RPC(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    signal: AbortSignal.timeout(5000),
  });
  const id = Number.parseInt((await res.json()).result, 16);
  chainOk = id === 5042002;
  chainDetail = `${RPC()} → chain ${id}`;
} catch (error) {
  chainDetail = `${RPC()} unreachable (${error?.name ?? "error"})`;
}
add("live", "Arc RPC reachable, chain 5042002", chainOk, chainDetail, "check network / ARC_RPC_URL (docs/arc.md lists fallbacks)");
const wallet = process.env.AGENT_WALLET_ADDRESS?.trim();
add("optional", "AGENT_WALLET_ADDRESS (cap demo)", Boolean(wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet)), wallet ? "set" : "MISSING: demo skips the cap part", "AGENT_WALLET_ADDRESS=0x… in .env");

// Balances on the 6-decimal ERC-20 view, for the deployment's public addresses (no keys needed).
// Needs: bots stake (STAKE_USDC, default 2) + 0.05 gas; admin and referee 0.05 gas. Base-unit integers only.
if (chainOk) {
  const USDC = "0x3600000000000000000000000000000000000000";
  const GAS = 50_000n;
  const stakeText = (process.env.STAKE_USDC?.trim() || "2");
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(stakeText);
  const stake = m ? BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0") || "0") : 2_000_000n;
  const who = [
    ["admin", "0xEAb99118c98abbfA99aD55dd261c6fcEf8381f7F", GAS],
    ["referee", "0xE632a919CEE69FC9482a6A719D47878EEDA28345", GAS],
    ["deep (BOT_1)", "0xBAe2658a561A7A37e7CF4fDF336772dD23460E24", stake + GAS],
    ["hasty (BOT_2)", "0x016E0a0c6a153edFDd05947667Be12Be001Eb661", stake + GAS],
  ];
  const fmt = (b) => `${b / 1_000_000n}.${(b % 1_000_000n).toString().padStart(6, "0")} USDC`;
  for (const [name, address, need] of who) {
    try {
      const res = await fetch(RPC(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: USDC, data: `0x70a08231${address.slice(2).toLowerCase().padStart(64, "0")}` }, "latest"] }),
        signal: AbortSignal.timeout(5000),
      });
      const bal = BigInt((await res.json()).result);
      add("live", `balance ${name}`, bal >= need, `${fmt(bal)} (need ${fmt(need)})`, `fund ${address} at https://faucet.circle.com (Arc Testnet)`);
    } catch {
      add("live", `balance ${name}`, false, "could not read", "check the RPC");
    }
  }
}

// ── FALLBACK: what the page and `npm run replay-last` show without the chain ────────────────────
const resultPath = resolve(root, "web", "public", "result.json");
let resultOk = false;
let resultDetail = "missing";
if (existsSync(resultPath)) {
  try {
    const r = JSON.parse(readFileSync(resultPath, "utf8"));
    resultOk = r.version === 1 && /^0x[0-9a-fA-F]{64}$/.test(r.settleTxHash ?? "");
    resultDetail = resultOk ? `settle ${r.settleTxHash.slice(0, 10)}…` : "not a v1 live result";
  } catch {
    resultDetail = "unparseable";
  }
}
add("fallback", "web/public/result.json (replay-last)", resultOk, resultDetail, "merge LIVE-RUNNER's result.json (feat/live-runs)");
add("fallback", "web/public/cap-demo.json", existsSync(resolve(root, "web", "public", "cap-demo.json")), "", "merge LIVE-RUNNER's cap-demo.json");
add("optional", "web build (web/dist)", existsSync(resolve(root, "web", "dist", "index.html")), "", "cd web && npm run build (or use npm run dev)");
add("optional", "web/node_modules (page)", existsSync(resolve(root, "web", "node_modules")), "", "cd web && npm install");
add("optional", "contracts/out (rehearse:local)", existsSync(resolve(root, "contracts", "out", "MatchEscrow.sol")), "", "cd contracts && forge build");

// ── Render ─────────────────────────────────────────────────────────────────────────────────────
const titles = { required: "REQUIRED", live: "LIVE ON ARC", fallback: "FALLBACK (no chain)", optional: "OPTIONAL" };
console.log("BotBet presenter check (no key values are printed)\n");
for (const group of Object.keys(titles)) {
  console.log(titles[group]);
  for (const r of rows.filter((x) => x.group === group)) {
    const mark = r.ok ? "✅" : group === "optional" ? "⚠ " : "❌";
    console.log(`  ${mark} ${r.label.padEnd(36)} ${r.detail}${r.ok ? "" : `   → ${r.fix}`}`);
  }
}
const ok = (g) => rows.filter((r) => r.group === g).every((r) => r.ok);
let verdict;
if (!ok("required")) verdict = "❌ NOT READY: fix the REQUIRED lines first";
else if (ok("live")) verdict = "✅ READY FOR THE LIVE DEMO:  npm run demo   (fallback: npm run replay-last)";
else if (ok("fallback")) verdict = "⚠️  REPLAY ONLY (live is not ready):  npm run replay-last";
else verdict = "❌ NOT READY: neither live (keys/RPC) nor a recorded result.json for replay";
const bar = "═".repeat(Math.max(60, verdict.length + 2));
console.log(`\n${bar}\n ${verdict}\n${bar}`);
process.exit(ok("required") ? 0 : 1);
