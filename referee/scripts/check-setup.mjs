// Fresh-machine guard, run before every referee script. Plain Node, no dependencies, so it works even
// when `npm install` or the shared build has not happened yet. Prints the exact fix and exits 1.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const referee = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 12)) {
  problems.push(`Node ${process.versions.node} is too old (need ≥ 20.12 for process.loadEnvFile). Install Node 20.12+ or 24.`);
}
if (!existsSync(resolve(referee, "..", "shared", "dist", "index.js"))) {
  problems.push("shared/ is not built. Run:  cd shared && npm install && npm run build");
}
for (const dep of ["viem", "chess.js", "stockfish", "botbet-shared"]) {
  if (!existsSync(resolve(referee, "node_modules", dep))) {
    problems.push(`referee/node_modules/${dep} is missing. Run:  cd referee && npm install`);
    break;
  }
}

if (problems.length) {
  console.error("❌ referee setup is incomplete:");
  for (const p of problems) console.error(`   - ${p}`);
  process.exit(1);
}
