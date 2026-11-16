import type { Team } from "@bearing/domain";
import { countryName, form, playerTotals } from "@bearing/domain";
import { Trophy } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { EventLink, MatchLink, PlayerLink, CompetitorLink } from "../components/links";
import { LiveCard } from "../components/live-card";
import { Country, Mark, mix, readableOn } from "../components/mark";
import { MatchRow } from "../components/match-row";
import { Empty, FollowButton, Form, GameBadge, Meter, Section, Stat, Tabs } from "../components/ui";
import { useDir } from "../lib/dir";
import { useSetMood } from "../lib/mood";
import { achievements, didWin, followStatus, mapRecord } from "../lib/view";
import { useAtlas, useMinute } from "../lib/world";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "roster", label: "Roster" },
  { id: "matches", label: "Matches" },
  { id: "history", label: "History" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function TeamPage({ teamId }: { teamId: string }) {
  const atlas = useAtlas();
  const team = atlas.team(teamId);
  useSetMood({ discipline: team?.discipline, teamId: team?.id, tint: team?.colors.primary });
  const [tab, setTab] = useState<Tab>("overview");
  if (!team) return <Empty title="Team not found" />;
  return (
    <div className="space-y-10">
      <TeamHeader team={team} />
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Team sections" />
      {tab === "overview" && <Overview team={team} />}
      {tab === "roster" && <Roster team={team} />}
      {tab === "matches" && <Matches team={team} />}
      {tab === "history" && <History team={team} />}
    </div>
  );
}

function TeamHeader({ team }: { team: Team }) {
  const atlas = useAtlas();
  const dir = useDir();
  const now = useMinute();
  const d = atlas.discipline(team.discipline);
  const st = followStatus(atlas, { kind: "team", id: team.id }, now);
  const org = team.orgId ? atlas.world.organizations.find((o) => o.id === team.orgId) : undefined;
  const { primary, secondary } = team.colors;
  const onColor = dir === "studio" || dir === "broadcast" || dir === "slate";
  const ink = onColor ? readableOn(mix(primary, "#000000", 0.35)) : undefined;
  const box: Record<string, CSSProperties> = {
    studio: {
      background: `linear-gradient(120deg, ${mix(primary, "#000000", 0.2)} 0%, ${mix(primary, secondary, 0.55)} 60%, ${mix(secondary, "#000000", 0.2)} 100%)`,
      color: ink,
    },
    broadcast: {
      background: `linear-gradient(100deg, ${primary} 0%, ${mix(primary, "#000000", 0.45)} 70%)`,
      color: ink,
      clipPath: "polygon(0 0, 100% 0, calc(100% - 48px) 100%, 0 100%)",
    },
    almanac: { borderTop: `6px solid ${primary}` },
    signal: { boxShadow: `inset 4px 0 0 ${primary}` },
    arena: {},
    slate: { background: "#1e242c", color: "#f3f1ec", boxShadow: `inset 0 5px 0 ${primary}` },
  };
  return (
    <header
      className={`ui-hero rise-in ${dir === "studio" ? "ui-card p-6 sm:p-10" : dir === "broadcast" ? "p-6 pr-16 sm:p-10 sm:pr-24" : dir === "signal" ? "ui-card p-6 sm:p-8" : dir === "almanac" ? "pt-6" : dir === "slate" ? "overflow-hidden rounded-[var(--radius)] p-6 sm:p-10" : "py-6"}`}
      style={box[dir]}
    >
      <div className="flex flex-wrap items-center gap-5 sm:gap-7">
        <span
          className={`grid shrink-0 place-items-center ${onColor ? "size-24 rounded-[26px] bg-white/95 shadow-lg sm:size-28" : ""}`}
        >
          <Mark id={team.id} size={onColor ? 72 : 96} />
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={`flex flex-wrap items-center gap-3 text-[13px] ${onColor ? "opacity-85" : "text-muted"}`}
          >
            <GameBadge id={d.id} link />
            <span>{team.region}</span>
            {team.country && <span>{countryName(team.country)}</span>}
            {team.founded && <span>Est. {team.founded}</span>}
            {org && <span>Part of {org.name}</span>}
          </div>
          <h1 className="ui-h1 mt-2 break-words">{team.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {st.matchId ? (
              <MatchLink
                id={st.matchId}
                className={`text-[14px] font-semibold ${st.state === "live" ? (onColor ? "" : "text-live") : st.state === "out" ? (onColor ? "" : "text-loss") : ""} underline-offset-4 hover:underline`}
              >
                {st.state === "live" ? "● " : ""}
                {st.line}
              </MatchLink>
            ) : (
              <span className="text-[14px] opacity-80">{st.line}</span>
            )}
          </div>
        </div>
        <span
          className={
            dir === "slate"
              ? "[&_.ui-btn]:!border-white/15 [&_.ui-btn]:!bg-white/[0.06] [&_.ui-btn]:!text-[#f3f1ec] [&_.ui-btn-primary]:!border-transparent [&_.ui-btn-primary]:!bg-[#f3f1ec] [&_.ui-btn-primary]:!text-[#161a20]"
              : ""
          }
        >
          <FollowButton follow={{ kind: "team", id: team.id }} />
        </span>
      </div>
    </header>
  );
}

function useTeamNumbers(team: Team) {
  const atlas = useAtlas();
  const ms = atlas.matchesFor(team.id);
  const done = ms.filter((m) => m.status === "finished");
  const wins = done.filter((m) => didWin(m, team.id) === true).length;
  const maps = mapRecord(atlas, team.id);
  const mapsPlayed = maps.reduce((s, m) => s + m.played, 0);
  const mapsWon = maps.reduce((s, m) => s + m.won, 0);
  const diff = maps.reduce((s, m) => s + m.roundDiff, 0);
  const ranking = atlas.world.rankings.find((r) => r.discipline === team.discipline);
  const rank = ranking ? ranking.entries.findIndex((e) => e.competitorId === team.id) + 1 : 0;
  return { ms, done, wins, maps, mapsPlayed, mapsWon, diff, ranking, rank };
}

function Overview({ team }: { team: Team }) {
  const atlas = useAtlas();
  const d = atlas.discipline(team.discipline);
  const n = useTeamNumbers(team);
  const live = n.ms.find((m) => m.status === "live");
  const next = n.ms.find((m) => m.status === "scheduled");
  const roster = atlas.roster(team.id).filter((r) => r.stint.role !== "Coach");
  const unit = d.unit;
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-12">
        {(live || next) && (
          <Section kicker={live ? "Live now" : "Next up"} title={live ? "Playing" : "Next match"}>
            {live ? (
              <LiveCard match={live} />
            ) : (
              <div className="ui-card overflow-hidden">
                <MatchRow match={next!} />
              </div>
            )}
          </Section>
        )}
        <div className="ui-card grid grid-cols-2 gap-6 p-5 sm:grid-cols-4 sm:p-6">
          <div>
            <div className="ui-label">Form</div>
            <div className="mt-2.5">
              <Form results={form(atlas, team.id, 5)} />
            </div>
          </div>
          <Stat
            label="Series"
            value={`${n.wins}–${n.done.length - n.wins}`}
            sub="won–lost this season"
          />
          <Stat
            label={unit.many.charAt(0).toUpperCase() + unit.many.slice(1)}
            value={n.mapsPlayed ? `${n.mapsWon}–${n.mapsPlayed - n.mapsWon}` : "—"}
            sub={
              d.id === "cs2" && n.mapsPlayed
                ? `${n.diff > 0 ? "+" : ""}${n.diff} rounds`
                : undefined
            }
          />
          <Stat
            label={n.ranking?.title ?? "Ranking"}
            value={n.rank ? `#${n.rank}` : "—"}
            sub={n.rank ? `${n.ranking!.entries[n.rank - 1]!.points} pts` : undefined}
          />
        </div>
        <Section kicker="Roster" title="The lineup">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {roster.map(({ player, stint }) => {
              const tot = playerTotals(n.ms, player.id);
              return (
                <PlayerLink
                  key={player.id}
                  id={player.id}
                  className="ui-card flex flex-col p-4 transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between text-[11.5px] text-muted">
                    <span>{stint.role}</span>
                    <Country code={player.country} />
                  </div>
                  <div className="ui-h3 mt-6 truncate !text-[22px]">{player.handle}</div>
                  <div className="mt-0.5 truncate text-[12px] text-muted">{player.name ?? " "}</div>
                  <div className="mt-3 border-t border-line pt-3 text-[12px] text-muted">
                    {tot?.rating !== undefined ? (
                      <span>
                        Rating{" "}
                        <span className="ui-num text-[14px] text-ink">{tot.rating.toFixed(2)}</span>
                      </span>
                    ) : tot ? (
                      <span>
                        KDA{" "}
                        <span className="ui-num text-[14px] text-ink">
                          {((tot.kills + tot.assists) / Math.max(1, tot.deaths)).toFixed(1)}
                        </span>
                      </span>
                    ) : (
                      <span>Since {new Date(stint.from).getFullYear()}</span>
                    )}
                  </div>
                </PlayerLink>
              );
            })}
          </div>
        </Section>
        {d.id === "cs2" && n.maps.length > 0 && (
          <Section kicker="Map pool" title="Where they win">
            <div className="ui-card ui-divide overflow-hidden">
              {n.maps.map((m) => (
                <div
                  key={m.map}
                  className="grid grid-cols-[96px_1fr_120px] items-center gap-4 px-5 py-3"
                >
                  <span className="font-semibold">{m.map}</span>
                  <Meter value={m.won / m.played} color={team.colors.primary} />
                  <span className="ui-num text-right text-[13px] text-muted">
                    {m.won}/{m.played} · {m.roundDiff > 0 ? "+" : ""}
                    {m.roundDiff}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
        <Section kicker="Results" title="Recent series">
          {n.done.length ? (
            <div className="ui-card ui-divide overflow-hidden">
              {[...n.done]
                .reverse()
                .slice(0, 6)
                .map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
            </div>
          ) : (
            <p className="text-[14px] text-muted">No results yet this season.</p>
          )}
        </Section>
      </div>
      <aside className="space-y-10">
        <Achievements team={team} />
        <Siblings team={team} />
        {n.ranking && (
          <Section kicker={atlas.discipline(team.discipline).name} title={n.ranking.title}>
            <div className="ui-card ui-divide overflow-hidden">
              {n.ranking.entries.slice(0, 8).map((e, i) => (
                <CompetitorLink
                  key={e.competitorId}
                  id={e.competitorId}
                  className={`ui-row flex items-center gap-3 px-4 py-2.5 text-[14px] ${e.competitorId === team.id ? "bg-raised font-semibold" : ""}`}
                >
                  <span className="ui-num w-5 text-[13px] text-muted">{i + 1}</span>
                  <Mark id={e.competitorId} size={20} />
                  <span className="flex-1 truncate">{atlas.name(e.competitorId)}</span>
                  <span className="ui-num text-[13px] text-muted">{e.points}</span>
                </CompetitorLink>
              ))}
            </div>
          </Section>
        )}
      </aside>
    </div>
  );
}

function Achievements({ team }: { team: Team }) {
  const atlas = useAtlas();
  const list = achievements(atlas, team.id);
  if (!list.length) return null;
  return (
    <Section kicker="Achievements" title="Recent finishes">
      <div className="ui-card ui-divide overflow-hidden">
        {list.slice(0, 6).map(({ t, p }) => (
          <EventLink key={t.id} id={t.id} className="ui-row flex items-center gap-3 px-4 py-3">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-bold ${p.rank === 1 ? "bg-accent text-accent-ink" : "bg-raised"}`}
            >
              {p.rank === 1 ? (
                <Trophy className="size-4" />
              ) : (
                p.place.replace(/[a-z]+/g, "").split("–")[0]
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{t.name}</span>
              <span className="text-[12px] text-muted">
                {p.place}{" "}
                {p.prize && t.prize
                  ? `· ${new Intl.NumberFormat(undefined, { style: "currency", currency: t.prize.currency, maximumFractionDigits: 0 }).format(p.prize)}`
                  : ""}
              </span>
            </span>
          </EventLink>
        ))}
      </div>
    </Section>
  );
}

function Siblings({ team }: { team: Team }) {
  const atlas = useAtlas();
  if (!team.orgId) return null;
  const others = atlas.world.competitors.filter(
    (c): c is Team => c.kind === "team" && c.orgId === team.orgId && c.id !== team.id,
  );
  if (!others.length) return null;
  return (
    <Section kicker="Same organisation" title="Also fielding">
      <div className="space-y-2">
        {others.map((o) => (
          <CompetitorLink key={o.id} id={o.id} className="ui-card flex items-center gap-3 p-4">
            <Mark id={o.id} size={32} />
            <span className="flex-1">
              <span className="block font-semibold">{o.name}</span>
              <span className="text-[12.5px] text-muted">
                {atlas.discipline(o.discipline).name}
              </span>
            </span>
          </CompetitorLink>
        ))}
      </div>
    </Section>
  );
}

function Roster({ team }: { team: Team }) {
  const atlas = useAtlas();
  const now = useMinute();
  const ms = atlas.matchesFor(team.id);
  const current = atlas.roster(team.id);
  const stints = atlas.stints(team.id);
  const startYear = Number(stints[0]?.from.slice(0, 4) ?? new Date(now).getFullYear());
  const start = Date.parse(`${startYear}-01-01`);
  const x = (iso?: string) => (((iso ? Date.parse(iso) : now) - start) / (now - start)) * 100;
  const years = Array.from(
    { length: new Date(now).getFullYear() - startYear + 1 },
    (_, i) => startYear + i,
  );
  const monthYear = (iso: string) =>
    new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(Date.parse(iso));
  return (
    <div className="space-y-12">
      <div className="ui-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-[14px]">
          <thead>
            <tr className="text-left text-[12px] text-muted">
              <th className="px-5 py-3 font-medium">Player</th>
              <th className="py-3 font-medium">Role</th>
              <th className="py-3 font-medium">Joined</th>
              <th className="py-3 text-right font-medium">Maps</th>
              <th className="py-3 text-right font-medium">K–D</th>
              <th className="px-5 py-3 text-right font-medium">Rating</th>
            </tr>
          </thead>
          <tbody>
            {current.map(({ player, stint }) => {
              const tot = playerTotals(ms, player.id);
              return (
                <tr key={player.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <PlayerLink
                      id={player.id}
                      className="flex items-center gap-3 hover:text-accent"
                    >
                      <span className="ui-h3">{player.handle}</span>
                      <Country code={player.country} className="text-faint" />
                      <span className="hidden truncate text-[12.5px] text-muted md:inline">
                        {player.name}
                      </span>
                    </PlayerLink>
                  </td>
                  <td className="py-3 text-muted">{stint.role}</td>
                  <td className="py-3 text-muted">{monthYear(stint.from)}</td>
                  <td className="ui-num py-3 text-right">{tot?.games ?? "—"}</td>
                  <td className="ui-num py-3 text-right">
                    {tot ? `${tot.kills}–${tot.deaths}` : "—"}
                  </td>
                  <td className="ui-num px-5 py-3 text-right">
                    {tot?.rating !== undefined ? tot.rating.toFixed(2) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Section
        kicker="Roster history"
        title={`${stints.length} players since ${startYear}`}
        action={<span className="text-faint">Sample dates are approximate</span>}
      >
        <div className="ui-card no-scrollbar overflow-x-auto p-5">
          <div className="min-w-[720px]">
            <div className="relative ml-[130px] h-6">
              {years.map((y) => (
                <span
                  key={y}
                  className="absolute -translate-x-1/2 font-mono text-[10.5px] text-faint"
                  style={{ left: `${x(`${y}-01-01`)}%` }}
                >
                  {y}
                </span>
              ))}
            </div>
            {[...stints]
              .sort((a, b) => (a.to ? 1 : 0) - (b.to ? 1 : 0) || a.from.localeCompare(b.from))
              .map((s) => {
                const p = atlas.player(s.playerId);
                return (
                  <PlayerLink key={s.id} id={s.playerId} className="ui-row flex h-8 items-center">
                    <span
                      className={`w-[130px] shrink-0 truncate pr-3 text-[13px] ${s.to ? "text-muted" : "font-semibold"}`}
                    >
                      {p?.handle}
                      {s.role === "Coach" && (
                        <span className="ml-1.5 text-[10.5px] text-faint">coach</span>
                      )}
                    </span>
                    <span className="relative h-full flex-1">
                      <span
                        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
                        title={`${monthYear(s.from)} – ${s.to ? monthYear(s.to) : "now"}`}
                        style={{
                          left: `${x(s.from)}%`,
                          width: `${Math.max(0.6, x(s.to) - x(s.from))}%`,
                          background: s.to ? "var(--faint)" : team.colors.primary,
                          opacity: s.to ? 0.45 : 1,
                        }}
                      />
                    </span>
                  </PlayerLink>
                );
              })}
          </div>
        </div>
      </Section>
    </div>
  );
}

function Matches({ team }: { team: Team }) {
  const atlas = useAtlas();
  const ms = atlas.matchesFor(team.id);
  const upcoming = ms.filter((m) => m.status !== "finished");
  const done = ms.filter((m) => m.status === "finished").reverse();
  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <Section
        kicker="Upcoming"
        title={upcoming.length ? `${upcoming.length} scheduled` : "Nothing scheduled"}
      >
        {upcoming.length ? (
          <div className="ui-card ui-divide overflow-hidden">
            {upcoming.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-muted">
            When their next event is announced it appears here.
          </p>
        )}
      </Section>
      <Section kicker="Results" title={`${done.length} played`}>
        <div className="ui-card ui-divide overflow-hidden">
          {done.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </div>
      </Section>
    </div>
  );
}

function History({ team }: { team: Team }) {
  const atlas = useAtlas();
  const list = achievements(atlas, team.id);
  return (
    <Section kicker="History" title="Event finishes">
      {list.length ? (
        <div className="ui-card overflow-x-auto">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="px-5 py-3 font-medium">Event</th>
                <th className="py-3 font-medium">When</th>
                <th className="py-3 font-medium">Finish</th>
                <th className="px-5 py-3 text-right font-medium">Prize</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ t, p }) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <EventLink id={t.id} className="font-semibold hover:text-accent">
                      {t.name}
                    </EventLink>
                  </td>
                  <td className="py-3 text-muted">
                    {new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(
                      Date.parse(t.end),
                    )}
                  </td>
                  <td className={`py-3 font-semibold ${p.rank === 1 ? "text-accent" : ""}`}>
                    {p.place}
                  </td>
                  <td className="ui-num px-5 py-3 text-right text-muted">
                    {p.prize && t.prize
                      ? new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: t.prize.currency,
                          maximumFractionDigits: 0,
                        }).format(p.prize)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[14px] text-muted">No finishes recorded yet.</p>
      )}
    </Section>
  );
}
