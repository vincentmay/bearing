import type { GameResult, Match } from "@bearing/domain";
import { Bomb, Scissors, Skull, Timer } from "lucide-react";
import { useAtlas } from "../lib/world";

const ICON = { elimination: Skull, bomb: Bomb, defuse: Scissors, time: Timer } as const;
const LABEL = {
  elimination: "Elimination",
  bomb: "Bomb exploded",
  defuse: "Bomb defused",
  time: "Time ran out",
} as const;

/** Halves for a map: rounds won per side in each half (and overtime). */
export function halves(g: GameResult): { label: string; scores: number[] }[] {
  if (!g.rounds) return [];
  const out = [
    { label: "1st half", rounds: g.rounds.slice(0, 12) },
    { label: "2nd half", rounds: g.rounds.slice(12, 24) },
  ];
  if (g.rounds.length > 24) out.push({ label: "Overtime", rounds: g.rounds.slice(24) });
  return out.map((h) => ({
    label: h.label,
    scores: [0, 1].map((s) => h.rounds.filter((r) => r.winner === s).length),
  }));
}

/**
 * Every round of a map: winner's row, how it was won, the half-time break. Colours come from
 * the two teams.
 */
export function RoundHistory({ match, game }: { match: Match; game: GameResult }) {
  const atlas = useAtlas();
  if (!game.rounds?.length) return null;
  const colors = match.sides.map((s) => atlas.colors(s.competitorId).primary);
  const total = Math.max(24, game.rounds.length);
  return (
    <div className="no-scrollbar overflow-x-auto">
      <div className="min-w-[640px]">
        {[0, 1].map((side) => (
          <div key={side} className="flex items-center gap-[3px]">
            <span className="w-14 shrink-0 truncate text-[12px] font-semibold">
              {atlas.short(match.sides[side]!.competitorId)}
            </span>
            {Array.from({ length: total }, (_, i) => {
              const r = game.rounds![i];
              const won = r?.winner === side;
              const Icon = r ? ICON[r.how] : null;
              return (
                <span key={i} className={`flex items-center ${i === 12 || i === 24 ? "ml-2" : ""}`}>
                  <span
                    className="grid h-6 w-[22px] place-items-center rounded-[4px]"
                    style={{
                      background: won ? colors[side] : r ? "var(--raised)" : "transparent",
                      border: r ? undefined : "1px dashed var(--line)",
                      color: won ? readable(colors[side]!) : "transparent",
                    }}
                    title={
                      r
                        ? `Round ${i + 1}: ${atlas.short(match.sides[r.winner]!.competitorId)} · ${LABEL[r.how]} · ${atlas.short(match.sides[r.ct]!.competitorId)} on CT`
                        : `Round ${i + 1}`
                    }
                  >
                    {won && Icon && <Icon className="size-3" strokeWidth={2.5} />}
                  </span>
                </span>
              );
            })}
          </div>
        ))}
        <div className="mt-2 flex gap-4 pl-14 text-[11px] text-faint">
          {(Object.keys(ICON) as (keyof typeof ICON)[]).map((k) => {
            const Icon = ICON[k];
            return (
              <span key={k} className="flex items-center gap-1">
                <Icon className="size-3" /> {LABEL[k]}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function readable(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? "#0b0b0c" : "#ffffff";
}
