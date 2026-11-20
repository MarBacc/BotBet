/** A framed summary for the projector. Width follows the longest line; emoji count as two columns. */
export function box(title: string, rawLines: readonly string[], maxWidth = 96): string {
  const lines = rawLines.flatMap((line) => wrap(line, maxWidth));
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

/** Split on spaces to fit `max` columns; a single long token (a URL, a hash) is kept whole. */
function wrap(line: string, max: number): string[] {
  if (line.length <= max) return [line];
  // A line carrying a URL or a hash reads better whole (and stays clickable in the terminal).
  if (line.split(" ").some((word) => word.length > max / 2)) return [line];
  const indent = line.match(/^(\S+\s+)/)?.[1]?.replace(/\S/g, " ") ?? "  ";
  const out: string[] = [];
  let current = "";
  for (const word of line.split(" ")) {
    if (current && `${current} ${word}`.length > max) {
      out.push(current);
      current = `${indent}${word}`;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(current);
  return out;
}
