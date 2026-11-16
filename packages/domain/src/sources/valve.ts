/**
 * Counter-Strike's world ranking as Valve publishes it: a table of teams, points and rosters,
 * written about once a month to a public repository
 * (github.com/ValveSoftware/counter-strike_regional_standings). Nothing here fetches anything.
 */

export interface ValveStanding {
  rank: number;
  points: number;
  team: string;
  roster: string[];
}

const REPO = "ValveSoftware/counter-strike_regional_standings";

/** The folder that lists a year's standings, through GitHub's own interface. */
export function standingsListUrl(year: number): string {
  return `https://api.github.com/repos/${REPO}/contents/live/${year}`;
}

export function standingsUrl(year: number, file: string): string {
  return `https://raw.githubusercontent.com/${REPO}/main/live/${year}/${file}`;
}

/** The worldwide standings among a folder's files, oldest first, with the day each is of. */
export function globalStandings(listing: unknown): { file: string; date: string }[] {
  if (!Array.isArray(listing)) return [];
  return listing
    .flatMap((entry: { name?: string }) => {
      const found = /^standings_global_(\d{4})_(\d{2})_(\d{2})\.md$/.exec(entry.name ?? "");
      return found ? [{ file: entry.name!, date: `${found[1]}-${found[2]}-${found[3]}` }] : [];
    })
    .sort((x, y) => x.date.localeCompare(y.date));
}

/** The rows of a standings table. A line that is not a row of it is passed over. */
export function readStandings(markdown: string): ValveStanding[] {
  const out: ValveStanding[] = [];
  for (const line of markdown.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    const [, rank, points, team, roster] = cells;
    if (!rank || !/^\d+$/.test(rank) || !points || !/^\d+$/.test(points) || !team) continue;
    out.push({
      rank: Number(rank),
      points: Number(points),
      team,
      roster: (roster ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    });
  }
  return out;
}

/**
 * The days a ranking is likely to be of, latest first: Valve has published on the first Monday
 * of each month. Asking for these by name needs no listing of the folder, which GitHub rations.
 */
export function likelyStandings(
  now: number,
  months = 4,
): { year: number; file: string; date: string }[] {
  const out = [];
  const today = new Date(now);
  for (let back = 0; back < months; back++) {
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
    const monday = new Date(first);
    monday.setUTCDate(1 + ((8 - first.getUTCDay()) % 7));
    if (monday.getTime() > now) continue;
    const date = monday.toISOString().slice(0, 10);
    out.push({
      year: monday.getUTCFullYear(),
      file: `standings_global_${date.replaceAll("-", "_")}.md`,
      date,
    });
  }
  return out;
}
