import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { recoverMessageAddress, type Address, type Hex } from "viem";

export type BotGame = "chess" | "poker";

export interface BotManifest {
  name: string;
  game: BotGame;
  strategySummary: string;
  entry: string;
}

export interface BotRegistration {
  name: string;
  game: BotGame;
  strategySummary: string;
  owner: Address;
  codeHash: Hex;
  encryptedHash: Hex;
  signature: Hex;
  registeredAt: string;
}

export interface RegistrationSigner {
  address: Address;
  signMessage(args: { message: string }): Promise<Hex>;
}

export interface RegisterPackageOptions {
  dir: string;
  registryFile: string;
  artifactsDir: string;
  signer: RegistrationSigner;
  /** Only the throwaway house-bot flow may hash an existing referee/src entry outside the package folder. */
  allowRepoEntry?: boolean;
}

export interface VerifyPackageOptions {
  dir: string;
  name: string;
  registryFile: string;
}

export interface VerifyResult {
  ok: boolean;
  reason: string;
  record?: BotRegistration;
  codeHash?: Hex;
}

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REFEREE_DIR = resolve(THIS_DIR, "../..");
const REFEREE_SRC_DIR = resolve(REFEREE_DIR, "src");
const REGISTRATION_DOMAIN = "BotBet registration";
const ENVELOPE_MAGIC = Buffer.from("BBREG1", "ascii");

export const DEFAULT_REGISTRY_FILE = resolve(REFEREE_DIR, "../web/public/bots.json");
export const DEFAULT_ARTIFACTS_DIR = resolve(REFEREE_DIR, "node_modules/.cache/bot-registry");

export function registrationMessage(name: string, codeHash: Hex, registeredAt: string): string {
  return `${REGISTRATION_DOMAIN}: ${name} ${codeHash} ${registeredAt}`;
}

export async function readBotManifest(dir: string): Promise<BotManifest> {
  const packageDir = await realpath(resolve(dir));
  const manifestPath = resolve(packageDir, "bot.json");
  const manifestStat = await lstat(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) throw new Error("bot.json must be a regular file.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    throw new Error("bot.json is missing or is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bot.json must be a JSON object.");
  const value = parsed as Partial<BotManifest>;
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 120 || /[\0/\\]/.test(value.name)) {
    throw new Error("bot.json name must be a non-empty display name without path separators.");
  }
  if (value.game !== "chess" && value.game !== "poker") throw new Error('bot.json game must be "chess" or "poker".');
  if (typeof value.strategySummary !== "string" || !value.strategySummary.trim() || value.strategySummary.length > 2000) {
    throw new Error("bot.json strategySummary must be a non-empty string of at most 2000 characters.");
  }
  if (typeof value.entry !== "string" || !value.entry.trim() || value.entry.includes("\0") || isAbsolute(value.entry)) {
    throw new Error("bot.json entry must be a relative file path.");
  }
  return {
    name: value.name.trim(),
    game: value.game,
    strategySummary: value.strategySummary.trim(),
    entry: value.entry,
  };
}

/**
 * Read a package file for hashing. Text files (no NUL byte) are normalized CRLF -> LF so a Windows
 * checkout (git core.autocrlf=true) hashes the same as the LF checkout the bot was registered from.
 */
async function readForHash(path: string): Promise<Buffer> {
  const bytes = await readFile(path);
  if (bytes.includes(0) || !bytes.includes(0x0d)) return bytes;
  return Buffer.from(bytes.toString("latin1").replace(/\r\n/g, "\n"), "latin1");
}

export async function canonicalPackageBytes(dir: string, allowRepoEntry = false): Promise<Buffer> {
  const packageDir = await realpath(resolve(dir));
  const manifest = await readBotManifest(packageDir);
  const files = new Map<string, Buffer>();

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const absolute = resolve(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Package contains a symlink: ${relative(packageDir, absolute)}`);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) throw new Error(`Package contains a non-regular file: ${relative(packageDir, absolute)}`);
      const name = toPosix(relative(packageDir, absolute));
      files.set(name, await readForHash(absolute));
    }
  }

  await walk(packageDir);
  if (!files.has("bot.json")) throw new Error("Package must contain bot.json at its root.");

  const entryPath = resolve(packageDir, manifest.entry);
  const entryStat = await lstat(entryPath).catch(() => null);
  if (!entryStat || !entryStat.isFile() || entryStat.isSymbolicLink()) throw new Error("bot.json entry must point to a regular file.");

  if (isInside(packageDir, entryPath)) {
    const entryName = toPosix(relative(packageDir, entryPath));
    if (!files.has(entryName)) throw new Error("bot.json entry is not included in the package files.");
  } else {
    if (!allowRepoEntry) throw new Error("bot.json entry must stay inside the package for owner-key registrations.");
    const entryRealPath = await realpath(entryPath);
    const sourceRoot = await realpath(REFEREE_SRC_DIR);
    if (!isInside(sourceRoot, entryRealPath)) throw new Error("External entries are limited to existing files inside referee/src.");
    const entryAlias = `@entry/${toPosix(relative(sourceRoot, entryRealPath))}`;
    if (files.has(entryAlias)) throw new Error("External entry alias collides with a package file.");
    files.set(entryAlias, await readForHash(entryRealPath));
  }

  const ordered = [...files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const chunks: Buffer[] = [];
  for (const [name, content] of ordered) {
    const nameBytes = Buffer.from(name, "utf8");
    if (nameBytes.length > 0xffff_ffff) throw new Error("Package path is too long to canonicalize.");
    const pathLength = Buffer.alloc(4);
    pathLength.writeUInt32BE(nameBytes.length);
    const contentLength = Buffer.alloc(8);
    contentLength.writeBigUInt64BE(BigInt(content.length));
    chunks.push(pathLength, nameBytes, contentLength, content);
  }
  return Buffer.concat(chunks);
}

export function sha256(bytes: Uint8Array): Hex {
  return `0x${createHash("sha256").update(bytes).digest("hex")}` as Hex;
}

export function encryptPackage(payload: Uint8Array): { envelope: Buffer; keyHex: string } {
  const key = randomBytes(32);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const envelope = Buffer.concat([ENVELOPE_MAGIC, nonce, cipher.getAuthTag(), ciphertext]);
  return { envelope, keyHex: key.toString("hex") };
}

export async function readRegistrations(registryFile: string): Promise<BotRegistration[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(registryFile, "utf8"));
    if (!Array.isArray(parsed)) throw new Error("web/public/bots.json must contain a JSON array.");
    return parsed as BotRegistration[];
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }
}

export async function registerPackage(options: RegisterPackageOptions): Promise<BotRegistration> {
  const manifest = await readBotManifest(options.dir);
  const canonical = await canonicalPackageBytes(options.dir, options.allowRepoEntry ?? false);
  const codeHash = sha256(canonical);
  const registeredAt = new Date().toISOString();
  const signature = await options.signer.signMessage({ message: registrationMessage(manifest.name, codeHash, registeredAt) });
  const { envelope, keyHex } = encryptPackage(canonical);
  const encryptedHash = sha256(envelope);

  const artifactFolder = resolve(options.artifactsDir, artifactStem(manifest.name), registeredAt.replace(/[:.]/g, "-"));
  await mkdir(artifactFolder, { recursive: true });
  const encryptedPath = resolve(artifactFolder, `${artifactStem(manifest.name)}.enc`);
  const keyPath = resolve(artifactFolder, `${artifactStem(manifest.name)}.key`);
  await writeFile(encryptedPath, envelope, { mode: 0o600, flag: "wx" });
  await writeFile(keyPath, `${keyHex}\n`, { mode: 0o600, flag: "wx" });

  const record: BotRegistration = {
    name: manifest.name,
    game: manifest.game,
    strategySummary: manifest.strategySummary,
    owner: options.signer.address,
    codeHash,
    encryptedHash,
    signature,
    registeredAt,
  };
  const current = await readRegistrations(options.registryFile);
  await writeJsonAtomically(options.registryFile, [...current, record]);
  return record;
}

export async function verifyPackage(options: VerifyPackageOptions): Promise<VerifyResult> {
  let manifest: BotManifest;
  let codeHash: Hex;
  try {
    manifest = await readBotManifest(options.dir);
    if (manifest.name !== options.name) return { ok: false, reason: "package name does not match --verify name" };
    codeHash = sha256(await canonicalPackageBytes(options.dir, true));
  } catch (error) {
    return { ok: false, reason: errorMessage(error) };
  }

  const records = await readRegistrations(options.registryFile);
  const record = [...records].reverse().find((candidate) => candidate.name === options.name);
  if (!record) return { ok: false, reason: "no registration with that name", codeHash };
  if (record.codeHash.toLowerCase() !== codeHash.toLowerCase()) {
    return { ok: false, reason: "package hash differs from the registered hash", record, codeHash };
  }

  try {
    const recovered = await recoverMessageAddress({
      message: registrationMessage(record.name, record.codeHash, record.registeredAt),
      signature: record.signature,
    });
    if (recovered.toLowerCase() !== record.owner.toLowerCase()) {
      return { ok: false, reason: "signature does not recover to the registered owner", record, codeHash };
    }
  } catch {
    return { ok: false, reason: "signature could not be recovered", record, codeHash };
  }
  return { ok: true, reason: "package hash and owner signature match", record, codeHash };
}

function artifactStem(name: string): string {
  return name.replace(/[^A-Za-z0-9._ -]/g, "_").trim().replace(/[ .]+$/g, "") || "bot";
}

function toPosix(pathValue: string): string {
  return pathValue.split(sep).join("/");
}

function isInside(root: string, target: string): boolean {
  const relativePath = relative(root, target);
  return relativePath !== "" && relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath);
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function writeJsonAtomically(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

