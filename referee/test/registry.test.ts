import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { registerPackage, registrationMessage, verifyPackage, type BotRegistration } from "../src/registry/registry-core.js";

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "botbet-registry-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, "package");
  await mkdir(dir);
  await writeFile(join(dir, "bot.json"), JSON.stringify({
    name: "Test Bot",
    game: "chess",
    strategySummary: "Test strategy.",
    entry: "strategy.ts",
  }, null, 2) + "\n");
  await writeFile(join(dir, "strategy.ts"), "export const move = () => 'e2e4';\n");
  const signer = privateKeyToAccount(generatePrivateKey());
  const registryFile = join(root, "bots.json");
  const artifactsDir = join(root, "artifacts");
  return { root, dir, signer, registryFile, artifactsDir };
}

test("register then verify accepts the exact package and stores encrypted artifacts", async (t) => {
  const f = await fixture(t);
  const record = await registerPackage({ ...f, signer: f.signer });
  const result = await verifyPackage({ dir: f.dir, name: "Test Bot", registryFile: f.registryFile });

  assert.equal(result.ok, true);
  assert.equal(result.record?.owner.toLowerCase(), f.signer.address.toLowerCase());
  assert.equal(result.record?.codeHash, record.codeHash);
  const timestampFolder = join(f.artifactsDir, "Test Bot", record.registeredAt.replace(/[:.]/g, "-"));
  const artifactNames = await readdir(timestampFolder);
  assert.deepEqual(artifactNames.sort(), ["Test Bot.enc", "Test Bot.key"]);
  assert.equal((await readFile(join(timestampFolder, "Test Bot.key"), "utf8")).trim().length, 64);
});

test("modified strategy returns MISMATCH", async (t) => {
  const f = await fixture(t);
  await registerPackage({ ...f, signer: f.signer });
  await writeFile(join(f.dir, "strategy.ts"), "export const move = () => 'd2d4';\n");

  const result = await verifyPackage({ dir: f.dir, name: "Test Bot", registryFile: f.registryFile });
  assert.equal(result.ok, false);
  assert.match(result.reason, /hash differs/);
});

test("signature from the wrong signer returns MISMATCH", async (t) => {
  const f = await fixture(t);
  const record = await registerPackage({ ...f, signer: f.signer });
  const wrongSigner = privateKeyToAccount(generatePrivateKey());
  const message = registrationMessage(record.name, record.codeHash, record.registeredAt);
  const forgedRecord: BotRegistration = { ...record, signature: await wrongSigner.signMessage({ message }) };
  await writeFile(f.registryFile, `${JSON.stringify([forgedRecord], null, 2)}\n`);

  const result = await verifyPackage({ dir: f.dir, name: "Test Bot", registryFile: f.registryFile });
  assert.equal(result.ok, false);
  assert.match(result.reason, /registered owner/);
});
