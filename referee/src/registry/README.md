# Bot registry design

This registry records a bot's public identity and a signature over the exact package bytes. The strategy stays private: registration encrypts the canonical package payload locally and writes the ciphertext and decryption key only under the already ignored `referee/node_modules/` tree. The key is never part of `web/public/bots.json` or a commit.

## Bot package

A package is a directory containing `bot.json`, its entry file, and any other strategy/support files:

```json
{
  "name": "Example Bot",
  "game": "chess",
  "strategySummary": "A short public description of the approach.",
  "entry": "strategy.ts"
}
```

The `game` value is `chess` or `poker`. For normal user packages, `entry` must resolve inside the package directory. Symlinks, `node_modules`, and `.git` are rejected or excluded; all other regular package files are included in the hash. Existing house bots may use an entry path into `referee/src/` only with `--ephemeral`; that exact source file is included under a stable `@entry/…` name in the canonical payload. This lets the registration point at existing code without copying or editing it.

## Canonical package hash

The registry sorts package files by normalized POSIX relative path. For every file it serializes a 4-byte big-endian path-byte length, UTF-8 path bytes, an 8-byte big-endian content length, then the raw file bytes. SHA-256 of that concatenation is `codeHash`. The manifest itself is included, so changing the name, game, summary, entry, or any package file changes the hash. The encrypted payload is this same canonical byte sequence.

## Register and verify

From `referee/`:

```bash
npm run register-bot -- --dir <botFolder> --owner-key-env OWNER_KEY
npm run register-bot -- --dir <botFolder> --ephemeral
npm run register-bot -- --verify <name> --dir <botFolder>
```

`--owner-key-env` names an environment variable containing a viem-compatible private key; the program reads it but never prints it. `--ephemeral` generates a throwaway signing identity and does not persist its private key. Do not use it for a bot that needs to sign future updates.

The owner signs exactly `BotBet registration: <name> <codeHash> <registeredAt>` as an EIP-191 message. Registration appends `{ name, game, strategySummary, owner, codeHash, encryptedHash, signature, registeredAt }` to the JSON array in `web/public/bots.json`.

Verification recomputes the package hash, checks it against the latest registration with that name, and recovers the EIP-191 signer. It prints `VERIFIED` only if both hash and signer match; a changed package or invalid/wrong signature prints `MISMATCH` and exits nonzero. This proves the owner address signed the recorded hash. It does not independently establish a real-world identity or prove who authored the code.

## Private encryption artifacts

The AES-256-GCM envelope contains a version marker, random 12-byte nonce, 16-byte authentication tag, and encrypted canonical payload. The random 32-byte key is written as hex to a separate `.key` file. Both files go under `referee/node_modules/.cache/bot-registry/`, which is already covered by the repository's `node_modules/` ignore rule. Never move either file into a tracked directory or commit the key.

## House registrations

Deep Thought and Hasty Hal are house bots. Their package manifests point to the existing, read-only `referee/src/bots.ts`; summaries distinguish depth 12 from depth 4. The package hash includes that source and each manifest. Poker registrations (Nit, Maniac, Theory) are deferred until `origin/feat/poker-engine` is available; no poker-engine branch or source was present when this design was written.
