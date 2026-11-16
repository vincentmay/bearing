import type { Atlas, Match, Tournament } from "@bearing/domain";
import { clock, dayLabel, seriesScore, winnerOf } from "@bearing/domain";
import { pathAhead } from "./view";

/** Short display name: "Team Vitality" → "Vitality". */
export function plain(atlas: Atlas, id: string | null | undefined): string {
  return atlas.name(id).replace(/^Team /, "");
}

/** "in the semifinal", but "in round 7". */
export function inRound(atlas: Atlas, m: Match): string {
  const noun = roundNoun(atlas, m);
  return /^round \d/.test(noun) ? `in ${noun}` : `in the ${noun}`;
}

/** "Semifinals" → "semifinal", "Grand final" → "grand final". */
export function roundNoun(atlas: Atlas, m: Match): string {
  const name = atlas.roundOf(m)?.name ?? atlas.stageOf(m).name;
  return name.toLowerCase().replace(/finals$/, "final");
}

/**
 * A headline and standfirst written from match state only, so they stay true as the data
 * changes. No adjectives the data can't support.
 */
export function matchStory(
  atlas: Atlas,
  m: Match,
  now: number,
): { headline: string; deck: string } {
  const [a, b] = m.sides.map((s) => plain(atlas, s.competitorId)) as [string, string];
  const [sa, sb] = seriesScore(m) as [number, number];
  const round = roundNoun(atlas, m);
  const done = m.games.filter((g) => g.status === "finished" && g.scores);
  const live = m.games.find((g) => g.status === "live");
  const ahead = pathAhead(atlas, m);

  let headline: string;
  if (m.status === "finished") {
    const w = winnerOf(m);
    headline =
      w === "draw"
        ? `${a} and ${b} draw`
        : `${w === 0 ? a : b} beat ${w === 0 ? b : a} in the ${round}`;
  } else if (sa === sb) headline = `${a} and ${b} level in the ${round}`;
  else headline = `${sa > sb ? a : b} lead ${sa > sb ? b : a} in the ${round}`;

  const parts: string[] = [];
  for (const g of done) {
    const w = g.winner === 0 ? a : b;
    const [x, y] = g.scores!;
    parts.push(`${w} took ${g.label} ${Math.max(x!, y!)}–${Math.min(x!, y!)}`);
  }
  if (live?.scores) {
    const [x, y] = live.scores as [number, number];
    parts.push(
      x === y
        ? `${live.label} is level at ${x}–${y}`
        : `${live.label} is ${Math.max(x, y)}–${Math.min(x, y)} to ${x > y ? a : b}`,
    );
  }
  let deck = parts.length ? `${joinClauses(parts)}.` : "";
  if (ahead?.waiting) {
    deck += ` The winner plays ${plain(atlas, ahead.waiting)} in the ${roundNoun(atlas, ahead.next)}, ${dayLabel(ahead.next.scheduledAt, now).toLowerCase()} at ${clock(ahead.next.scheduledAt)}.`;
  }
  return { headline, deck: deck.trim() };
}

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  // Clauses start with names (teams, maps), so they keep their capitals.
  return `${parts.slice(0, -1).join("; ")}, and ${parts.at(-1)!}`;
}

/** One sentence on where an event stands. */
export function eventDeck(atlas: Atlas, t: Tournament, now: number): string {
  const ms = atlas.matchesOf(t.id);
  const live = ms.filter((m) => m.status === "live");
  const next = ms
    .filter((m) => m.status === "scheduled")
    .sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt))[0];
  const finished = ms.filter((m) => m.status === "finished");
  const d = atlas.discipline(t.discipline);
  if (!finished.length && !live.length && next) {
    return `${t.participantIds.length} ${d.competitor === "team" ? "teams" : "players"} start ${dayLabel(next.scheduledAt, now).toLowerCase()} at ${clock(next.scheduledAt)}.`;
  }
  const bits: string[] = [];
  if (live.length === 1 && live[0]!.sides.length === 2) {
    bits.push(matchStory(atlas, live[0]!, now).headline);
  } else if (live.length > 1) {
    bits.push(`${live.length} games are being played now`);
  }
  if (next && next.sides.every((s) => s.competitorId)) {
    bits.push(
      `next up: ${next.sides.map((s) => plain(atlas, s.competitorId)).join(" v ")} ${inRound(atlas, next)}, ${dayLabel(next.scheduledAt, now).toLowerCase()}`,
    );
  } else if (next) {
    const known = next.sides.find((s) => s.competitorId);
    if (known) bits.push(`${plain(atlas, known.competitorId)} wait ${inRound(atlas, next)}`);
  }
  if (!bits.length) return `${t.name} is complete.`;
  const s = bits.join("; ");
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}
