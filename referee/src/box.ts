/** A framed summary for the projector. Width follows the longest line; emoji count as two columns. */
export function box(title: string, lines: readonly string[]): string {
  const width = (s: string) => [...s].reduce((n, ch) => n + (/\p{Extended_Pictographic}/u.test(ch) ? 2 : ch === "️" ? 0 : 1), 0);
  const inner = Math.max(width(title), ...lines.map(width)) + 2;
  const pad = (s: string) => `${s}${" ".repeat(inner - width(s) - 1)}`;
  return [
    `╔${"═".repeat(inner)}╗`,
    `║ ${pad(title)}║`,
    `╠${"═".repeat(inner)}╣`,
    ...lines.map((l) => `║ ${pad(l)}║`),
    `╚${"═".repeat(inner)}╝`,
  ].join("\n");
}

export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
