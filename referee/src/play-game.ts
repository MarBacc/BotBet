/**
 * `npm run play-game` — one game offline, printed and signed. See interfaces.md section 3.
 *
 * Touches no chain: it reads shared/deployments.json for the EIP-712 domain, plays, and signs.
 * No RPC call, no transaction, no money moves. `npm run settle` is the one that goes on-chain.
 */

import { randomBytes } from "node:crypto";
import { toHex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BOTS, type BotConfig } from "./bots.js";
import { loadEnv, readArcDeployments, refereeAccount, requirePrivateKey } from "./env.js";
import { resolveEnginePath } from "./engine.js";
import { MAX_FULL_MOVES, MOVE_TIME_MS, playGame, sides } from "./game.js";
import { hashPgn, matchDomain, recoverMatchResultSigner, signMatchResult, type MatchResult } from "./result.js";

/** Public address only — the key itself never leaves env.ts. */
function botAddress(bot: BotConfig): Address {
  return privateKeyToAccount(requirePrivateKey(bot.envKey)).address;
}

async function main(): Promise<void> {
  loadEnv();

  const deployments = readArcDeployments();
  const escrow = deployments.contracts.MatchEscrow.address;
  const referee = refereeAccount(deployments); // throws unless the key matches the deployed referee
  const refereeKey = requirePrivateKey("REFEREE_PRIVATE_KEY");

  const { white, black } = sides();
  const addresses = new Map<string, Address>(BOTS.map((bot) => [bot.id, botAddress(bot)]));
  const matchId = toHex(randomBytes(32));

  console.log("BotBet — play-game (offline, no chain)");
  console.log(`  engine      ${resolveEnginePath()}`);
  console.log(`  limits      depth per bot, ${MOVE_TIME_MS / 1000}s per move, ${MAX_FULL_MOVES} full moves max`);
  console.log(`  escrow      ${escrow} (chain ${deployments.chainId})`);
  console.log(`  referee     ${referee.address}`);
  console.log(`  matchId     ${matchId}`);
  console.log(`  white       ${white.name} — depth ${white.depth} — ${addresses.get(white.id)}`);
  console.log(`  black       ${black.name} — depth ${black.depth} — ${addresses.get(black.id)}`);
  console.log();

  const startedAt = Date.now();
  const outcome = await playGame({
    onMove: ({ ply, san, uci, bot, elapsedMs }) => {
      const moveNumber = Math.ceil(ply / 2);
      const dots = ply % 2 === 1 ? "." : "...";
      const label = `${moveNumber}${dots}`.padEnd(7);
      console.log(`  ${label} ${san.padEnd(8)} ${uci.padEnd(6)} ${bot.name.padEnd(13)} ${(elapsedMs / 1000).toFixed(1)}s`);
    },
  });

  const winnerAddress = addresses.get(outcome.winner.id)!;
  const pgnHash = hashPgn(outcome.pgn);

  console.log();
  console.log(
    `Checkmate in ${outcome.fullMoves} moves (${outcome.moveCount} plies, the signed moveCount), ` +
      `${((Date.now() - startedAt) / 1000).toFixed(1)}s of play.`,
  );
  console.log(`Winner: ${outcome.winner.name} (depth ${outcome.winner.depth}) beats ${outcome.loser.name} (depth ${outcome.loser.depth}).`);
  console.log();
  console.log("PGN");
  console.log("---");
  console.log(outcome.pgn);
  console.log();

  const result: MatchResult = {
    matchId,
    winner: winnerAddress,
    moveCount: outcome.moveCount,
    pgnHash,
    finishedAt: BigInt(outcome.finishedAt),
  };

  const domain = matchDomain(deployments.chainId, escrow);
  const signature = await signMatchResult(refereeKey, domain, result);
  const recovered = await recoverMatchResultSigner(domain, result, signature);

  console.log("Signed MatchResult (EIP-712)");
  console.log("---------------------------");
  console.log(
    JSON.stringify(
      {
        domain: { ...domain, chainId: deployments.chainId },
        message: { ...result, finishedAt: result.finishedAt.toString() },
        signature,
      },
      null,
      2,
    ),
  );
  console.log();

  const signerMatches = recovered.toLowerCase() === referee.address.toLowerCase();
  const onChainReferee = deployments.referee;
  const deployedRefereeMatches = recovered.toLowerCase() === onChainReferee.toLowerCase();

  console.log(`Signature recovers to ${recovered}`);
  console.log(`  signing key        ${signerMatches ? "OK" : "MISMATCH"}`);
  console.log(`  deployed referee   ${deployedRefereeMatches ? "OK" : `MISMATCH — escrow expects ${onChainReferee}`}`);

  if (!signerMatches) {
    throw new Error("recovered signer does not match the signing key — the typed data is wrong.");
  }
  if (!deployedRefereeMatches) {
    throw new Error(
      `REFEREE_PRIVATE_KEY signs as ${recovered} but the deployed escrow trusts ${onChainReferee}; settle would revert with InvalidSignature.`,
    );
  }

  console.log();
  console.log("Nothing was sent to the chain.");
}

main().catch((error: unknown) => {
  console.error(`\nplay-game failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
