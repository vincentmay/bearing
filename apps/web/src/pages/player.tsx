import type { Match, Player } from "@bearing/domain";
import {
  countryName,
  dayLabel,
  formatPoints,
  playerTotals,
  roundRobinStandings,
  seriesScore,
  winnerOf,
} from "@bearing/domain";
import { CompetitorLink, EventLink, MatchLink } from "../components/links";
import { Mark } from "../components/mark";
import { Empty, FollowButton, GameBadge, Section, Stat } from "../components/ui";
import { useSetMood } from "../lib/mood";
import { achievements, followStatus, ordinal } from "../lib/view";
import { useAtlas, useMinute } from "../lib/world";

export function PlayerPage({ playerId }: { playerId: string }) {
  const atlas = useAtlas();
  const p = atlas.player(playerId);
  const stint = p ? atlas.world.stints.find((s) => s.playerId === p.id && !s.to) : undefined;
  const team = stint ? atlas.team(stint.teamId) : undefined;
  useSetMood({ discipline: p?.discipline, teamId: team?.id, tint: team?.colors.primary });
  if (!p) return <Empty title="Player not found" />;
  return (
    <div className="space-y-12">
      <Header p={p} />
      {p.discipline === "chess" ? (
        <ChessPlayer p={p} />
      ) : p.discipline === "trackmania" ? (
        <DriverPlayer p={p} />
      ) : (
        <TeamPlayer p={p} />
      )}
    </div>
  );
}

function Header({ p }: { p: Player }) {
  const atlas = useAtlas();
  const now = useMinute();
  const stint = atlas.world.stints.find((s) => s.playerId === p.id && !s.to);
  const team = stint ? atlas.team(stint.teamId) : undefined;
  const st = followStatus(atlas, { kind: "player", id: p.id }, now);
  return (
    <header className="ui-hero rise-in">
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
        <GameBadge id={p.discipline} link />
        {p.title && <span className="font-semibold text-ink">{p.title}</span>}
        <span>{countryName(p.country)}</span>
        {(stint?.role ?? p.role) && <span>{stint?.role ?? p.role}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="ui-h1 break-words">{p.handle}</h1>
          {p.name && p.name !== p.handle && (
            <div className="mt-2 text-[18px] text-muted">{p.name}</div>
          )}
        </div>
        <FollowButton follow={{ kind: "player", id: p.id }} />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {team && (
          <CompetitorLink
            id={team.id}
            className="ui-card flex items-center gap-3 !rounded-full py-1.5 pr-4 pl-1.5"
          >
            <Mark id={team.id} size={30} />
            <span className="text-[14px] font-semibold">{team.name}</span>
          </CompetitorLink>
        )}
        {p.rating && (
          <span className="ui-card flex items-center gap-2 !rounded-full px-4 py-2 text-[14px]">
            <span className="text-muted">{p.rating.system}</span>{" "}
            <span className="ui-num">{p.rating.value}</span>
          </span>
        )}
        {st.matchId && (
          <MatchLink
            id={st.matchId}
            className={`text-[14px] font-semibold ${st.state === "live" ? "text-live" : "text-muted"} hover:underline`}
          >
            {st.state === "live" ? "● " : ""}
            {st.line}
          </MatchLink>
        )}
      </div>
    </header>
  );
}

function TeamPlayer({ p }: { p: Player }) {
  const atlas = useAtlas();
  const now = useMinute();
  const stints = atlas.world.stints
    .filter((s) => s.playerId === p.id)
    .sort((a, b) => b.from.localeCompare(a.from));
  const current = stints.find((s) => !s.to);
  const ms = current
    ? atlas
        .matchesFor(current.teamId)
        .filter((m) => m.games.some((g) => g.lines?.some((l) => l.playerId === p.id)))
    : [];
  const tot = playerTotals(ms, p.id);
  const isCs = p.discipline === "cs2";
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-12">
        {tot ? (
          <div className="ui-card grid grid-cols-2 gap-6 p-5 sm:grid-cols-4 sm:p-6">
            {isCs ? (
              <>
                <Stat label="Rating" value={tot.rating?.toFixed(2) ?? "—"} sub="1.00 is average" />
                <Stat
                  label="K–D"
                  value={`${tot.kills}–${tot.deaths}`}
                  sub={`${tot.kills - tot.deaths > 0 ? "+" : ""}${tot.kills - tot.deaths}`}
                />
                <Stat label="ADR" value={tot.adr?.toFixed(1) ?? "—"} sub="damage per round" />
                <Stat label="Maps" value={tot.games} sub="this season" />
              </>
            ) : (
              <>
                <Stat
                  label="KDA"
                  value={((tot.kills + tot.assists) / Math.max(1, tot.deaths)).toFixed(2)}
                  sub="(kills + assists) / deaths"
                />
                <Stat label="K / D / A" value={`${tot.kills}/${tot.deaths}/${tot.assists}`} />
                <Stat label="Per game" value={(tot.kills / tot.games).toFixed(1)} sub="kills" />
                <Stat label="Games" value={tot.games} sub="this season" />
              </>
            )}
          </div>
        ) : (
          <p className="text-[14px] text-muted">
            No individual stats recorded for this player yet.
          </p>
        )}
        {ms.length > 0 && (
          <Section kicker="Match log" title="Series by series">
            <div className="ui-card overflow-x-auto">
              <table className="w-full min-w-[600px] text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] text-muted">
                    <th className="px-5 py-3 font-medium">When</th>
                    <th className="py-3 font-medium">Opponent</th>
                    <th className="py-3 font-medium">Result</th>
                    <th className="py-3 text-right font-medium">{isCs ? "K–D" : "K/D/A"}</th>
                    <th className="px-5 py-3 text-right font-medium">{isCs ? "Rating" : "KDA"}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...ms].reverse().map((m) => (
                    <LogRow key={m.id} m={m} p={p} teamId={current!.teamId} now={now} isCs={isCs} />
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>
      <aside className="space-y-10">
        <Section kicker="Career" title="Teams">
          <ol className="ui-card ui-divide overflow-hidden">
            {stints.map((s) => (
              <li key={s.id}>
                <CompetitorLink id={s.teamId} className="ui-row flex items-center gap-3 px-4 py-3">
                  <Mark id={s.teamId} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{atlas.name(s.teamId)}</span>
                    <span className="text-[12.5px] text-muted">
                      {s.role} · {my(s.from)} – {s.to ? my(s.to) : "now"}
                    </span>
                  </span>
                </CompetitorLink>
              </li>
            ))}
          </ol>
        </Section>
        <Trophies id={current?.teamId} />
      </aside>
    </div>
  );
}

function LogRow({
  m,
  p,
  teamId,
  now,
  isCs,
}: {
  m: Match;
  p: Player;
  teamId: string;
  now: number;
  isCs: boolean;
}) {
  const atlas = useAtlas();
  const idx = m.sides.findIndex((s) => s.competitorId === teamId);
  const s = seriesScore(m);
  const t = playerTotals([m], p.id);
  const w = winnerOf(m);
  return (
    <tr className="border-t border-line">
      <td className="px-5 py-3 text-muted">{dayLabel(m.scheduledAt, now)}</td>
      <td className="py-3">
        <MatchLink id={m.id} className="flex items-center gap-2 hover:text-accent">
          <Mark id={m.sides[1 - idx]!.competitorId} size={20} />
          <span className="font-medium">{atlas.name(m.sides[1 - idx]!.competitorId)}</span>
        </MatchLink>
      </td>
      <td
        className={`ui-num py-3 ${m.status === "live" ? "text-live" : w === idx ? "text-win" : "text-loss"}`}
      >
        {m.status === "live" ? "Live " : w === idx ? "W " : "L "}
        {s[idx]}–{s[1 - idx]}
      </td>
      <td className="ui-num py-3 text-right">
        {t ? (isCs ? `${t.kills}–${t.deaths}` : `${t.kills}/${t.deaths}/${t.assists}`) : "—"}
      </td>
      <td className="ui-num px-5 py-3 text-right">
        {t
          ? isCs
            ? t.rating?.toFixed(2)
            : ((t.kills + t.assists) / Math.max(1, t.deaths)).toFixed(1)
          : "—"}
      </td>
    </tr>
  );
}

function ChessPlayer({ p }: { p: Player }) {
  const atlas = useAtlas();
  const now = useMinute();
  const games = atlas.matchesFor(p.id);
  const t = games[0] ? atlas.tournamentOf(games[0]) : undefined;
  const stage = t?.stages.find((s) => s.format === "round-robin");
  const row =
    t && stage
      ? roundRobinStandings(atlas, stage, t.participantIds).find((r) => r.competitorId === p.id)
      : undefined;
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-12">
        {row && t && (
          <div className="ui-card grid grid-cols-2 gap-6 p-5 sm:grid-cols-4 sm:p-6">
            <Stat
              label={t.short}
              value={`${formatPoints(row.points)} / ${row.played}`}
              sub={`${ordinal(row.rank)} place`}
            />
            <Stat label="W–D–L" value={`${row.wins}–${row.draws}–${row.losses}`} />
            <Stat label="Rating" value={p.rating?.value ?? "—"} sub={p.rating?.system} />
            <Stat label="Tiebreak" value={row.tiebreak.toFixed(2)} sub="Sonneborn–Berger" />
          </div>
        )}
        <Section kicker={t?.name ?? "Games"} title="Game by game">
          <div className="ui-card overflow-x-auto">
            <table className="w-full min-w-[620px] text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="px-5 py-3 font-medium">Round</th>
                  <th className="py-3 font-medium">Colour</th>
                  <th className="py-3 font-medium">Opponent</th>
                  <th className="py-3 font-medium">Opening</th>
                  <th className="px-5 py-3 text-right font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {games.map((m) => {
                  const idx = m.sides.findIndex((s) => s.competitorId === p.id);
                  const opp = m.sides[1 - idx]!.competitorId;
                  const g = m.games[0]!;
                  const res =
                    m.status !== "finished"
                      ? m.status === "live"
                        ? "Live"
                        : dayLabel(m.scheduledAt, now)
                      : g.winner === "draw"
                        ? "½"
                        : g.winner === idx
                          ? "1"
                          : "0";
                  return (
                    <tr key={m.id} className="border-t border-line">
                      <td className="px-5 py-3 text-muted">{atlas.roundOf(m)?.short}</td>
                      <td className="py-3">
                        <span
                          className={`inline-block size-3 rounded-[3px] border border-ink/30 align-middle ${idx === 0 ? "bg-[#fbfaf6]" : "bg-[#16130f]"}`}
                        />
                      </td>
                      <td className="py-3">
                        <MatchLink id={m.id} className="font-medium hover:text-accent">
                          {atlas.player(opp ?? "")?.name ?? atlas.name(opp)}
                        </MatchLink>
                      </td>
                      <td className="max-w-[220px] truncate py-3 text-muted">
                        {g.detail?.split("·")[0]}
                      </td>
                      <td
                        className={`ui-num px-5 py-3 text-right text-[15px] ${res === "1" ? "text-win" : res === "0" ? "text-loss" : res === "Live" ? "text-live" : ""}`}
                      >
                        {res}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
      <aside>
        <Trophies id={p.id} />
      </aside>
    </div>
  );
}

function DriverPlayer({ p }: { p: Player }) {
  const atlas = useAtlas();
  const ms = atlas.matchesFor(p.id);
  const ranking = atlas.world.rankings.find((r) => r.discipline === p.discipline);
  const rank = ranking ? ranking.entries.findIndex((e) => e.competitorId === p.id) + 1 : 0;
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-12">
        <div className="ui-card grid grid-cols-2 gap-6 p-5 sm:grid-cols-3 sm:p-6">
          <Stat
            label={ranking?.title ?? "Ranking"}
            value={rank ? `#${rank}` : "—"}
            sub={rank ? `${ranking!.entries[rank - 1]!.points} pts` : "Outside the top eight"}
          />
          <Stat label="Heats" value={ms.length} sub="this season" />
          <Stat
            label="Next"
            value={
              ms.find((m) => m.status !== "finished")
                ? (atlas.roundOf(ms.find((m) => m.status !== "finished")!)?.short ?? "—")
                : "—"
            }
          />
        </div>
        <Section kicker="Heats" title="Races">
          <div className="ui-card ui-divide overflow-hidden">
            {ms.map((m) => (
              <MatchLink
                key={m.id}
                id={m.id}
                className="ui-row flex items-center justify-between gap-3 px-5 py-3 text-[14px]"
              >
                <span className="font-semibold">
                  {atlas.tournamentOf(m).short} · {atlas.roundOf(m)?.name}
                </span>
                <span className="text-muted">
                  {m.status === "live" ? "● Live" : m.games[0]?.label}
                </span>
              </MatchLink>
            ))}
          </div>
        </Section>
      </div>
      <aside>
        <Trophies id={p.id} />
      </aside>
    </div>
  );
}

function Trophies({ id }: { id?: string }) {
  const atlas = useAtlas();
  if (!id) return null;
  const list = achievements(atlas, id);
  if (!list.length) return null;
  return (
    <Section kicker="Achievements" title="Finishes">
      <div className="ui-card ui-divide overflow-hidden">
        {list.slice(0, 6).map(({ t, p }) => (
          <EventLink
            key={t.id}
            id={t.id}
            className="ui-row flex items-center justify-between gap-3 px-4 py-3 text-[14px]"
          >
            <span className="truncate font-semibold">{t.name}</span>
            <span className={p.rank === 1 ? "font-semibold text-accent" : "text-muted"}>
              {p.place}
            </span>
          </EventLink>
        ))}
      </div>
    </Section>
  );
}

function my(iso: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(
    Date.parse(iso),
  );
}
