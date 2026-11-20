import { USDC_DECIMALS, formatUsdc } from "botbet-shared";

// TODO (Person B): see CLAUDE.md and interfaces.md before writing anything here.
// Smoke check that the shared money helpers resolve — the ONLY place USDC amounts are converted.
export const MONEY = `USDC has ${USDC_DECIMALS} decimals, e.g. ${formatUsdc(5_500_000n)}`;
