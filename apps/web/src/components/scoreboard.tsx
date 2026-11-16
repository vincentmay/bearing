import type { GameResult, Match, PlayerLine } from "@bearing/domain";
import { useAtlas } from "../lib/world";
import { PlayerLink } from "./links";
import { Country, Mark } from "./mark";

/** Combine lines for the same player across several games (the "all maps" view). */
export function mergeLines(games: GameResult[]): PlayerLine[] {
  const by = new Map<string, PlayerLine & { n: number }>();
  for (const g of games) {
    for (const l of g.lines ?? []) {
      const prev = by.get(l.playerId);
      if (!prev) by.set(l.playerId, { ...l, n: 1 });
      else {
        prev.kills += l.kills;
        prev.deaths += l.deaths;
        prev.assists += l.assists;
        if (l.adr !== undefined) prev.adr = ((prev.adr ?? 0) * prev.n + l.adr) / (prev.n + 1);
        if (l.rating !== undefined)
          prev.rating = ((prev.rating ?? 0) * prev.n + l.rating) / (prev.n + 1);
        if (l.gold !== undefined) prev.gold = (prev.gold ?? 0) + l.gold;
        prev.n++;
      }
    }
  }
  return [...by.values()];
}

/** Per-player table for one side, sorted by impact. CS2 shows ADR and rating; LoL shows role and gold. */
export function Scoreboard({
  match,
  lines,
  kind,
}: {
  match: Match;
  lines: PlayerLine[];
  kind: "cs2" | "lol";
}) {
  const atlas = useAtlas();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {match.sides.map((s, side) => {
        const rows = lines
          .filter((l) => l.side === side)
          .sort((a, b) =>
            kind === "cs2"
              ? (b.rating ?? 0) - (a.rating ?? 0)
              : roleOrder(a.role) - roleOrder(b.role),
          );
        if (!rows.length) return null;
        const best = Math.max(...rows.map((r) => r.rating ?? 0));
        return (
          <div key={side} className="ui-card overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
              <Mark id={s.competitorId} size={24} />
              <span className="ui-h3">{atlas.name(s.competitorId)}</span>
            </div>
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-[11px] text-faint">
                  <th className="px-4 py-2 text-left font-medium">Player</th>
                  {kind === "lol" && <th className="py-2 text-left font-medium">Role</th>}
                  <th className="py-2 text-right font-medium">K–D{kind === "lol" ? "–A" : ""}</th>
                  {kind === "cs2" && <th className="py-2 text-right font-medium">+/−</th>}
                  {kind === "cs2" && <th className="py-2 text-right font-medium">ADR</th>}
                  {kind === "lol" && <th className="py-2 text-right font-medium">KDA</th>}
                  <th className="px-4 py-2 text-right font-medium">
                    {kind === "cs2" ? "Rating" : "Gold"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const p = atlas.player(l.playerId);
                  const diff = l.kills - l.deaths;
                  return (
                    <tr key={l.playerId} className="border-t border-line">
                      <td className="px-4 py-2.5">
                        <PlayerLink
                          id={l.playerId}
                          className="flex items-center gap-2 hover:text-accent"
                        >
                          <span className="font-semibold">{p?.handle}</span>
                          <Country code={p?.country} className="text-faint" />
                        </PlayerLink>
                      </td>
                      {kind === "lol" && <td className="py-2.5 text-muted">{l.role}</td>}
                      <td className="ui-num py-2.5 text-right text-[14px]">
                        {l.kills}–{l.deaths}
                        {kind === "lol" ? `–${l.assists}` : ""}
                      </td>
                      {kind === "cs2" && (
                        <td
                          className={`ui-num py-2.5 text-right text-[14px] ${diff > 0 ? "text-win" : diff < 0 ? "text-loss" : "text-muted"}`}
                        >
                          {diff > 0 ? "+" : ""}
                          {diff}
                        </td>
                      )}
                      {kind === "cs2" && (
                        <td className="ui-num py-2.5 text-right text-[14px] text-muted">
                          {l.adr?.toFixed(0)}
                        </td>
                      )}
                      {kind === "lol" && (
                        <td className="ui-num py-2.5 text-right text-[14px] text-muted">
                          {((l.kills + l.assists) / Math.max(1, l.deaths)).toFixed(1)}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right">
                        {kind === "cs2" ? (
                          <span
                            className={`ui-num inline-block min-w-[46px] rounded-md px-1.5 py-0.5 text-center text-[14px] ${l.rating === best ? "bg-accent text-accent-ink" : (l.rating ?? 0) >= 1 ? "text-win" : "text-loss"}`}
                          >
                            {l.rating?.toFixed(2)}
                          </span>
                        ) : (
                          <span className="ui-num text-[14px] text-muted">
                            {((l.gold ?? 0) / 1000).toFixed(1)}k
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function roleOrder(r?: string) {
  return ["Top", "Jungle", "Mid", "Bot", "Support"].indexOf(r ?? "");
}
