import type { Match, Stage, Tournament } from "@bearing/domain";
import {
  clock,
  dayLabel,
  formatPoints,
  seriesScore,
  swissRecords,
  winnerOf,
} from "@bearing/domain";
import { Trophy } from "lucide-react";
import { useState } from "react";
import { CompetitorLink, MatchLink } from "../links";
import { Country, Mark } from "../mark";
import { MatchRow } from "../match-row";
import { Empty, LiveDot } from "../ui";
import { pendingSource } from "../../lib/view";
import { useAtlas, useMinute } from "../../lib/world";
import { Bracket } from "./bracket";
import { Crosstable } from "./crosstable";
import { SwissFlow } from "./swiss-flow";

/** The right visualisation for each stage format. */
export function StageView({ t, stage }: { t: Tournament; stage: Stage }) {
  const atlas = useAtlas();
  const [highlight, setHighlight] = useState<string | null>(null);
  if (!atlas.stageMatches(stage).length) {
    return (
      <Empty title={`${stage.name} hasn't been drawn yet`}>
        The field comes from the stage before. Pairings appear here as soon as they are known.
      </Empty>
    );
  }
  switch (stage.format) {
    case "single-elim":
    case "double-elim":
      return <BracketView stage={stage} highlight={highlight} onHighlight={setHighlight} />;
    case "cup":
      return <CupView stage={stage} />;
    case "swiss":
      return <SwissView t={t} stage={stage} highlight={highlight} onHighlight={setHighlight} />;
    case "round-robin":
      return (
        <RoundRobinView t={t} stage={stage} highlight={highlight} onHighlight={setHighlight} />
      );
  }
}

function roundDays(atlas: ReturnType<typeof useAtlas>, ids: string[], now: number) {
  const ms = ids.map((id) => atlas.match(id)).filter((m): m is Match => !!m);
  return [
    ...new Set(
      ms
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
        .map((m) => dayLabel(m.scheduledAt, now)),
    ),
  ].join(" · ");
}

function BracketView({
  stage,
  highlight,
  onHighlight,
}: {
  stage: Stage;
  highlight: string | null;
  onHighlight: (id: string | null) => void;
}) {
  const atlas = useAtlas();
  const now = useMinute();
  return (
    <div
      className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0"
      onPointerLeave={() => onHighlight(null)}
    >
      <Bracket
        stage={stage}
        highlight={highlight}
        geometry={{ matchWidth: 252, matchHeight: 96, columnGap: 64, rowGap: 28, headerHeight: 54 }}
        lineColor="var(--line)"
        activeLineColor="var(--accent)"
        lineWidth={1.5}
        radius={10}
        renderHeader={(round) => (
          <div>
            <div className="ui-h3">{round.name}</div>
            <div className="mt-1 text-[12px] text-muted">
              {roundDays(atlas, round.matchIds, now)}
            </div>
          </div>
        )}
        renderMatch={(m, { isFinal }) => (
          <BracketBox match={m} isFinal={isFinal} highlight={highlight} onHighlight={onHighlight} />
        )}
      />
    </div>
  );
}

function BracketBox({
  match,
  isFinal,
  highlight,
  onHighlight,
}: {
  match: Match;
  isFinal: boolean;
  highlight: string | null;
  onHighlight: (id: string | null) => void;
}) {
  const atlas = useAtlas();
  const now = useMinute();
  const score = seriesScore(match);
  const w = winnerOf(match);
  const live = match.status === "live";
  return (
    <MatchLink
      id={match.id}
      className={`ui-card relative flex h-full flex-col justify-center overflow-hidden !rounded-[var(--radius-sm)] transition-transform hover:-translate-y-0.5 ${live ? "!border-live/70" : isFinal ? "!border-accent/70" : ""}`}
    >
      {match.sides.map((s, i) => {
        const won = w === i;
        const lost = typeof w === "number" && w !== i;
        const dim = highlight && s.competitorId !== highlight;
        const pending = pendingSource(atlas, match, i);
        return (
          <div
            key={i}
            onPointerEnter={() => s.competitorId && onHighlight(s.competitorId)}
            className={`flex h-[34px] items-center gap-2.5 px-3 transition-opacity ${dim ? "opacity-35" : ""}`}
          >
            <Mark id={s.competitorId} size={22} />
            <span
              className={`flex-1 truncate text-[14px] ${won ? "font-semibold" : lost ? "text-muted" : "font-medium"}`}
            >
              {s.competitorId ? (
                atlas.name(s.competitorId)
              ) : pending ? (
                <span className="text-[12.5px] text-muted">
                  {pending.sides.map((x) => atlas.short(x.competitorId)).join(" or ")}
                </span>
              ) : (
                <span className="text-[12px] text-faint">{s.placeholder}</span>
              )}
            </span>
            <span
              className={`ui-num text-[16px] ${won ? "text-accent" : lost ? "text-faint" : ""}`}
            >
              {match.status === "scheduled" ? "" : score[i]}
            </span>
          </div>
        );
      })}
      <div className="flex items-center justify-between border-t border-line px-3 py-1 text-[10.5px] text-faint">
        <span className="flex items-center gap-1.5">
          {live ? (
            <>
              <LiveDot /> <span className="text-live">Live</span>
            </>
          ) : match.status === "finished" ? (
            "Final"
          ) : (
            `${dayLabel(match.scheduledAt, now)} ${clock(match.scheduledAt)}`
          )}
        </span>
        <span className="flex items-center gap-1">
          {isFinal && <Trophy className="size-3 text-accent" />}Bo{match.bestOf}
        </span>
      </div>
    </MatchLink>
  );
}

function CupView({ stage }: { stage: Stage }) {
  const atlas = useAtlas();
  const now = useMinute();
  const advance = stage.rules?.advancePerMatch ?? 2;
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      <Bracket
        stage={stage}
        geometry={{
          matchWidth: 240,
          matchHeight: 214,
          columnGap: 56,
          rowGap: 22,
          headerHeight: 54,
        }}
        lineColor="var(--line)"
        activeLineColor="var(--accent)"
        renderHeader={(round) => (
          <div>
            <div className="ui-h3">{round.name}</div>
            <div className="mt-1 text-[12px] text-muted">
              {roundDays(atlas, round.matchIds, now)}
            </div>
          </div>
        )}
        renderMatch={(m, { isFinal }) => {
          const g = m.games[0];
          const order = m.sides
            .map((s, i) => ({ s, i, pts: g?.scores?.[i] }))
            .sort((a, b) => (b.pts ?? -1) - (a.pts ?? -1));
          return (
            <MatchLink
              id={m.id}
              className={`ui-card flex h-full flex-col !rounded-[var(--radius-sm)] p-3 ${m.status === "live" ? "!border-live/70" : isFinal ? "!border-accent/70" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                <span className="truncate">{g?.label}</span>
                <span className="shrink-0">
                  {m.status === "live" ? (
                    <span className="text-live">● Live</span>
                  ) : (
                    clock(m.scheduledAt)
                  )}
                </span>
              </div>
              <div className="mt-2 flex-1">
                {order.map(({ s, i, pts }, rank) => (
                  <div key={i}>
                    {rank === advance && (
                      <div className="my-1 border-t border-dashed border-accent/50" />
                    )}
                    <div className="flex h-8 items-center gap-2 text-[14px]">
                      <span className="w-3 text-[11px] text-faint">{rank + 1}</span>
                      {s.competitorId ? (
                        <>
                          <span className="truncate font-semibold">
                            {atlas.short(s.competitorId)}
                          </span>
                          <Country
                            code={atlas.player(s.competitorId)?.country}
                            className="text-faint"
                          />
                        </>
                      ) : (
                        <span className="truncate text-[12px] text-faint">{s.placeholder}</span>
                      )}
                      {pts !== undefined && (
                        <span
                          className={`ui-num ml-auto text-[14px] ${g?.cup?.finalists.includes(i) ? "text-accent" : "text-muted"}`}
                        >
                          {pts}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10.5px] text-faint">Top {advance} advance</div>
            </MatchLink>
          );
        }}
      />
    </div>
  );
}

function SwissView({
  t,
  stage,
  highlight,
  onHighlight,
}: {
  t: Tournament;
  stage: Stage;
  highlight: string | null;
  onHighlight: (id: string | null) => void;
}) {
  const atlas = useAtlas();
  const records = swissRecords(atlas, stage, t.participantIds);
  const played = atlas.stageMatches(stage).some((m) => m.status === "finished");
  if (!played) {
    const first = stage.rounds.find((r) => r.matchIds.length);
    return (
      <div className="ui-card ui-divide overflow-hidden">
        {(first?.matchIds ?? []).map((id) => (
          <MatchRow key={id} match={atlas.match(id)!} showEvent={false} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 max-w-[640px] text-[13.5px] text-muted">
          Each column is a round; teams move up on a win and down on a loss. Hover a team to trace
          its run.
        </p>
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <SwissFlow
            stage={stage}
            seeds={t.participantIds}
            highlight={highlight}
            onHighlight={onHighlight}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2" onPointerLeave={() => onHighlight(null)}>
        {(["advanced", "eliminated"] as const).map((status) => (
          <div key={status} className="ui-card overflow-hidden">
            <div
              className="border-b border-line px-4 py-3 text-[13px] font-semibold"
              style={{ color: status === "advanced" ? "var(--win)" : "var(--loss)" }}
            >
              {status === "advanced" ? "Through to the playoffs" : "Eliminated"}
            </div>
            {records
              .filter((r) => r.status === status)
              .map((r) => (
                <CompetitorLink
                  key={r.competitorId}
                  id={r.competitorId}
                  className={`ui-row flex items-center gap-3 px-4 py-2.5 ${highlight === r.competitorId ? "bg-raised" : ""}`}
                >
                  <span
                    onPointerEnter={() => onHighlight(r.competitorId)}
                    className="flex flex-1 items-center gap-3"
                  >
                    <Mark id={r.competitorId} size={24} />
                    <span className="flex-1 truncate text-[14px] font-medium">
                      {atlas.name(r.competitorId)}
                    </span>
                    <span className="flex gap-1">
                      {r.path.map((o, i) => (
                        <span
                          key={i}
                          className={`size-2 rounded-full ${o === "W" ? "bg-win" : "bg-loss/70"}`}
                        />
                      ))}
                    </span>
                    <span className="ui-num w-9 text-right text-[14px]">
                      {r.wins}–{r.losses}
                    </span>
                  </span>
                </CompetitorLink>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundRobinView({
  t,
  stage,
  highlight,
  onHighlight,
}: {
  t: Tournament;
  stage: Stage;
  highlight: string | null;
  onHighlight: (id: string | null) => void;
}) {
  const atlas = useAtlas();
  const current =
    stage.rounds.find((r) => r.matchIds.some((id) => atlas.match(id)?.status !== "finished")) ??
    stage.rounds.at(-1)!;
  const [roundId, setRoundId] = useState(current.id);
  const round = stage.rounds.find((r) => r.id === roundId)!;
  return (
    <div className="space-y-8">
      <div className="ui-card no-scrollbar overflow-x-auto p-4 sm:p-6">
        <Crosstable tournament={t} stage={stage} highlight={highlight} onHighlight={onHighlight} />
      </div>
      <div className="ui-card p-4 sm:p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="ui-h3">Points after each round</div>
          <span className="text-[12px] text-muted">hover a line</span>
        </div>
        <PointsRace t={t} stage={stage} highlight={highlight} onHighlight={onHighlight} />
      </div>
      <div>
        <div
          className="no-scrollbar mb-3 flex gap-2 overflow-x-auto"
          role="group"
          aria-label="Round"
        >
          {stage.rounds.map((r) => {
            const live = r.matchIds.some((id) => atlas.match(id)?.status === "live");
            return (
              <button
                key={r.id}
                type="button"
                className="ui-chip"
                aria-pressed={r.id === roundId}
                onClick={() => setRoundId(r.id)}
              >
                <span className="flex items-center gap-1.5">
                  {live && <LiveDot />}
                  {r.name}
                </span>
              </button>
            );
          })}
        </div>
        <div className="ui-card ui-divide overflow-hidden">
          {round.matchIds.map((id) => (
            <MatchRow key={id} match={atlas.match(id)!} showEvent={false} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Cumulative points after each round, one line per player. */
export function PointsRace({
  t,
  stage,
  highlight,
  onHighlight,
}: {
  t: Tournament;
  stage: Stage;
  highlight: string | null;
  onHighlight: (id: string | null) => void;
}) {
  const atlas = useAtlas();
  const series = t.participantIds.map((id) => {
    let pts = 0;
    const points = [0];
    for (const r of stage.rounds) {
      const m = r.matchIds
        .map((x) => atlas.match(x)!)
        .find((x) => x.sides.some((s) => s.competitorId === id));
      if (!m || m.status !== "finished") break;
      pts += seriesScore(m)[m.sides.findIndex((s) => s.competitorId === id)]!;
      points.push(pts);
    }
    return { id, points };
  });
  const W = 760;
  const H = 240;
  const pad = { l: 28, r: 140, t: 12, b: 24 };
  const maxY = Math.max(4, Math.ceil(Math.max(...series.flatMap((s) => s.points))));
  const rounds = stage.rounds.length;
  const x = (i: number) => pad.l + (i / rounds) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / maxY) * (H - pad.t - pad.b);
  const focus = highlight ?? t.participantIds.find((id) => atlas.followsCompetitor(id)) ?? null;
  const ordered = [...series].sort((a, b) => (a.id === focus ? 1 : 0) - (b.id === focus ? 1 : 0));
  const labels = [...series]
    .sort((a, b) => b.points.at(-1)! - a.points.at(-1)!)
    .map((s, i) => ({
      ...s,
      ly: pad.t + 6 + i * ((H - pad.t - pad.b) / (series.length - 1 || 1)),
    }));
  return (
    <div className="no-scrollbar overflow-x-auto" onPointerLeave={() => onHighlight(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block"
        role="img"
        aria-label="Points after each round"
      >
        {Array.from({ length: maxY + 1 }, (_, v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text
              x={pad.l - 8}
              y={y(v) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--faint)"
              fontFamily="var(--mono)"
            >
              {v}
            </text>
          </g>
        ))}
        {Array.from({ length: rounds + 1 }, (_, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="var(--faint)"
            fontFamily="var(--mono)"
          >
            {i === 0 ? "start" : `R${i}`}
          </text>
        ))}
        {ordered.map((s) => {
          const on = s.id === focus;
          const d = s.points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p)}`).join(" ");
          return (
            <g key={s.id} onPointerEnter={() => onHighlight(s.id)} style={{ cursor: "pointer" }}>
              <path d={d} fill="none" stroke="transparent" strokeWidth={10} />
              <path
                d={d}
                fill="none"
                stroke={on ? "var(--accent)" : "var(--faint)"}
                strokeOpacity={on ? 1 : 0.6}
                strokeWidth={on ? 2.5 : 1.25}
                strokeLinejoin="round"
              />
              {s.points.map((p, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(p)}
                  r={on ? 3.2 : 1.8}
                  fill={on ? "var(--accent)" : "var(--faint)"}
                />
              ))}
            </g>
          );
        })}
        {labels.map((s) => {
          const on = s.id === focus;
          const ex = x(s.points.length - 1);
          const ey = y(s.points.at(-1)!);
          return (
            <g key={s.id} onPointerEnter={() => onHighlight(s.id)} style={{ cursor: "pointer" }}>
              <path
                d={`M${ex + 4},${ey} L${W - pad.r + 10},${s.ly}`}
                stroke={on ? "var(--accent)" : "var(--line)"}
                fill="none"
              />
              <text
                x={W - pad.r + 14}
                y={s.ly + 3.5}
                fontSize="11.5"
                fill={on ? "var(--ink)" : "var(--muted)"}
                fontFamily="var(--text)"
                fontWeight={on ? 650 : 450}
              >
                {atlas.short(s.id)}{" "}
                <tspan fill="var(--faint)" fontFamily="var(--mono)">
                  {formatPoints(s.points.at(-1)!)}
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
