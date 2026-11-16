import type { Stage, Tournament } from "@bearing/domain";
import { formatPoints, roundRobinStandings } from "@bearing/domain";
import { useAtlas } from "../../lib/world";
import { Country } from "../mark";

/** Round-robin crosstable: rows in standing order, one column per opponent. */
export function Crosstable({
  tournament,
  stage,
  highlight,
  onHighlight,
  dense = false,
}: {
  tournament: Tournament;
  stage: Stage;
  highlight: string | null;
  onHighlight: (id: string | null) => void;
  dense?: boolean;
}) {
  const atlas = useAtlas();
  const rows = roundRobinStandings(atlas, stage, tournament.participantIds);
  const order = rows.map((r) => r.competitorId);
  const live = new Set(
    atlas
      .stageMatches(stage)
      .filter((m) => m.status === "live")
      .map((m) =>
        m.sides
          .map((s) => s.competitorId ?? "")
          .sort((a, b) => a.localeCompare(b))
          .join("|"),
      ),
  );
  const cell = dense ? "h-8 w-8" : "h-10 w-10";

  return (
    <table
      className="border-separate border-spacing-0 text-sm"
      onPointerLeave={() => onHighlight(null)}
    >
      <thead>
        <tr className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
          <th className="pr-3 pb-2 text-left font-normal">#</th>
          <th className="pr-6 pb-2 text-left font-normal">Player</th>
          <th className="pr-4 pb-2 text-right font-normal">Rtg</th>
          {order.map((_, i) => (
            <th key={i} className={`pb-2 text-center font-normal ${cell}`}>
              {i + 1}
            </th>
          ))}
          <th className="pb-2 pl-4 text-right font-normal">Pts</th>
          <th className="pb-2 pl-4 text-right font-normal">SB</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => {
          const p = atlas.player(row.competitorId)!;
          const active = highlight === row.competitorId;
          return (
            <tr
              key={row.competitorId}
              onPointerEnter={() => onHighlight(row.competitorId)}
              className="transition-colors"
              style={{
                background: active
                  ? "color-mix(in oklab, var(--accent) 10%, transparent)"
                  : undefined,
              }}
            >
              <td className="border-t border-line py-0 pr-3 font-mono text-xs text-muted">
                {row.rank}
              </td>
              <td className="border-t border-line py-0 pr-6 whitespace-nowrap">
                <span className="mr-1.5 font-mono text-[10px] text-faint">{p.title}</span>
                <span className="font-medium">{p.handle}</span>{" "}
                <Country code={p.country} className="ml-1 align-[1px]" />
              </td>
              <td className="border-t border-line pr-4 text-right font-mono text-xs text-muted">
                {p.rating?.value}
              </td>
              {order.map((opp, ci) => {
                if (ci === ri)
                  return (
                    <td key={opp} className={`border-t border-line ${cell} text-center`}>
                      <span className="mx-auto block size-full bg-[repeating-linear-gradient(135deg,transparent_0_4px,var(--line)_4px_5px)]" />
                    </td>
                  );
                const res = row.versus.get(opp);
                const isLive = live.has(
                  [row.competitorId, opp].sort((a, b) => a.localeCompare(b)).join("|"),
                );
                const hl = highlight && (highlight === opp || highlight === row.competitorId);
                return (
                  <td
                    key={opp}
                    className={`border-t border-line ${cell} text-center font-mono text-[13px]`}
                    style={{
                      color:
                        res === 1
                          ? "var(--win)"
                          : res === 0
                            ? "var(--loss)"
                            : res === 0.5
                              ? "var(--ink)"
                              : "var(--faint)",
                      background: hl
                        ? "color-mix(in oklab, var(--accent) 7%, transparent)"
                        : undefined,
                    }}
                    title={`${p.handle} vs ${atlas.short(opp)}`}
                  >
                    {isLive ? (
                      <span className="live-dot mx-auto block size-1.5 rounded-full bg-live" />
                    ) : res === null || res === undefined ? (
                      "·"
                    ) : res === 0.5 ? (
                      "½"
                    ) : (
                      res
                    )}
                  </td>
                );
              })}
              <td className="border-t border-line pl-4 text-right font-mono text-sm font-semibold">
                {formatPoints(row.points)}
              </td>
              <td className="border-t border-line pl-4 text-right font-mono text-xs text-muted">
                {row.tiebreak.toFixed(2)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
