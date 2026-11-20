// Cross-platform test runner: `npm test`.
// npm runs scripts through cmd.exe on Windows, which does not expand `test/*.test.ts`,
// and Node < 21 cannot expand the glob itself. List the files here instead.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = readdirSync(join(root, "test"))
  .filter((f) => f.endsWith(".test.ts"))
  .sort()
  .map((f) => join("test", f));

if (files.length === 0) {
  console.error("No test/*.test.ts files found.");
  process.exit(1);
}

const r = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  cwd: root,
  stdio: "inherit",
});
process.exit(r.status ?? 1);
