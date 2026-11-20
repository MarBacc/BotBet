import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { DEFAULT_ARTIFACTS_DIR, DEFAULT_REGISTRY_FILE, registerPackage, verifyPackage } from "./registry-core.js";

interface Args {
  dir: string;
  ephemeral: boolean;
  ownerKeyEnv?: string;
  verifyName?: string;
}

function parseArgs(argv: string[]): Args {
  const result: Partial<Args> = { ephemeral: false };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;
    if (argument === "--dir") result.dir = requireValue(argv[++index], "--dir");
    else if (argument === "--ephemeral") result.ephemeral = true;
    else if (argument === "--owner-key-env") result.ownerKeyEnv = requireValue(argv[++index], "--owner-key-env");
    else if (argument === "--verify") result.verifyName = requireValue(argv[++index], "--verify");
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!result.dir) throw new Error('Usage: npm run register-bot -- --dir <botFolder> (--owner-key-env ENV_NAME | --ephemeral) or --verify <name> --dir <botFolder>');
  if (result.verifyName) {
    if (result.ephemeral || result.ownerKeyEnv) throw new Error("Verification does not use a signing key.");
  } else if (result.ephemeral === Boolean(result.ownerKeyEnv)) {
    throw new Error("Choose exactly one of --ephemeral or --owner-key-env ENV_NAME.");
  }
  if (result.ownerKeyEnv && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(result.ownerKeyEnv)) {
    throw new Error("--owner-key-env must be an environment variable name.");
  }
  return result as Args;
}

function requireValue(value: string | undefined, flag: string): string {
  if (!value || value.startsWith("--")) throw new Error(`${flag} needs a value.`);
  return value;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.verifyName) {
    const result = await verifyPackage({ dir: args.dir, name: args.verifyName, registryFile: DEFAULT_REGISTRY_FILE });
    console.log(result.ok ? `VERIFIED ${args.verifyName} ${result.codeHash}` : `MISMATCH ${args.verifyName}: ${result.reason}`);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  let account;
  if (args.ephemeral) {
    account = privateKeyToAccount(generatePrivateKey());
  } else {
    const keyName = args.ownerKeyEnv!;
    const privateKey = process.env[keyName];
    if (!privateKey) throw new Error(`Environment variable ${keyName} is not set.`);
    try {
      account = privateKeyToAccount(privateKey as Hex);
    } catch {
      throw new Error(`Environment variable ${keyName} is not a valid signing key.`);
    }
  }

  const record = await registerPackage({
    dir: args.dir,
    registryFile: DEFAULT_REGISTRY_FILE,
    artifactsDir: DEFAULT_ARTIFACTS_DIR,
    signer: account,
    allowRepoEntry: args.ephemeral,
  });
  console.log(`Registered ${record.name} (${record.game})`);
  console.log(`owner         ${record.owner}`);
  console.log(`codeHash      ${record.codeHash}`);
  console.log(`encryptedHash ${record.encryptedHash}`);
  console.log(`registeredAt  ${record.registeredAt}`);
  console.log(`Encrypted payload and key are stored only under ${DEFAULT_ARTIFACTS_DIR}.`);
}

main().catch((error: unknown) => {
  console.error(`Registration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
