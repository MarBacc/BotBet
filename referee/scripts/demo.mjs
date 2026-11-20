import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const referee = fileURLToPath(new URL("../", import.meta.url));
const resultFile = new URL("../../web/public/result.json", import.meta.url);
const fen = "8/8/8/4k3/8/8/8/3QK3 w - - 0 1";
const page = "Open the page: http://localhost:5173 (press P)";
const startedAt = performance.now();
const deadline = startedAt + 60_000;
const elapsed = () => `${((performance.now() - startedAt) / 1000).toFixed(1)} s`;
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

function run(command, args, { capture = false, timeout, label }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: referee,
      detached: true,
      stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
    });
    let output = "";
    let failure;
    const stop = (reason) => {
      failure = reason;
      if (child.pid === undefined) return;
      // npm and tsx can spawn descendants. Kill the whole group before replaying.
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    };
    const interrupt = () => stop("interrupted");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", interrupt);
    const timer = setTimeout(() => stop("timed out"), timeout);
    child.stdout?.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
    child.once("error", () => { failure = "could not start"; });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
      if (failure === "interrupted") process.exit(130);
      if (failure || code !== 0) {
        const error = new Error(`${label} ${failure ?? `exited (${signal ?? code})`}`);
        error.output = output;
        reject(error);
        return;
      }
      resolve(output);
    });
  });
}

function remaining() {
  const ms = deadline - performance.now();
  if (ms <= 0) throw new Error("the 60-second live budget expired");
  return ms;
}

function printSetupFailures(output) {
  for (const line of output.split("\n")) {
    if (!line.trimStart().startsWith("❌")) continue;
    // check-setup includes the configured RPC URL, which may contain credentials.
    console.error(line.includes("Arc RPC reachable")
      ? "  ❌ Arc RPC unreachable or on the wrong chain. Check network / ARC_RPC_URL."
      : line);
  }
}

async function preflight() {
  const report = await run(process.execPath, ["scripts/check-setup.mjs"], {
    capture: true,
    timeout: remaining(),
    label: "check-setup",
  }).catch((error) => {
    printSetupFailures(error.output ?? "");
    throw error;
  });
  // check-setup exits zero for REPLAY ONLY as long as its required tools are installed.
  if (!/^\s*✅ READY FOR THE LIVE DEMO:/m.test(report)) {
    printSetupFailures(report);
    throw new Error("check-setup did not report READY");
  }
  console.log("✅ READY FOR THE LIVE DEMO");
}

async function printSettlement() {
  let result;
  try {
    result = JSON.parse(await readFile(resultFile, "utf8"));
  } catch {
    throw new Error("could not read the settlement result");
  }
  if (result?.version !== 1 || !/^0x[\da-f]{64}$/i.test(result.settleTxHash)) {
    throw new Error("the settlement result has no valid transaction hash");
  }
  console.log(`\n${page}\n\n━━━━━━━━━━━━━━ SETTLE TRANSACTION ON ARC ━━━━━━━━━━━━━━`);
  console.log(`https://explorer.testnet.arc.io/tx/${result.settleTxHash}`);
}

async function main() {
  try {
    if (args.some((arg) => arg !== "--dry-run")) throw new Error("usage: npm run demo -- [--dry-run]");
    await preflight();
    await run("npm", ["run", "settle", "--", "--fen", fen, ...(dryRun ? ["--dry-run"] : [])], {
      timeout: remaining(),
      label: "settle",
    });
    if (dryRun) console.log("\n✅ DRY RUN COMPLETE. No transactions sent.");
    else await printSettlement();
    console.log(`Demo elapsed: ${elapsed()}`);
  } catch (error) {
    console.error(`\n❌ ${error.message}\n\n━━━━━━━━━━━━━━ FALLBACK: RECORDED ARC RUN ━━━━━━━━━━━━━━`);
    try {
      await run("npm", ["run", "replay-last"], { timeout: 15_000, label: "replay-last" });
      console.log(`\n${page}\nDemo elapsed (including fallback): ${elapsed()}`);
    } catch {
      console.error("\nOpen the backup video: ../docs/screenshots/demo.webm");
      process.exitCode = 1;
    }
  }
}

await main();
