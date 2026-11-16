import type { GameResult, Match } from "@bearing/domain";
import { clock, form, longDate } from "@bearing/domain";
import { useState } from "react";
import { PlayerLink, EventLink, CompetitorLink } from "../components/links";
import { Country, Mark } from "../components/mark";
import { MatchRow } from "../components/match-row";
import { RoundHistory, halves } from "../components/round-history";
import { Scoreboard, mergeLines } from "../components/scoreboard";
import { Empty, Form, Section, Tabs } from "../components/ui";
import { MatchHero } from "../directions/heroes";
import { useSetMood } from "../lib/mood";
import { headToHead, pathAhead, roundLabel } from "../lib/view";
import { useAtlas, useMinute } from "../lib/world";

export function MatchPage({ matchId }: { matchId: string }) {
  const atlas = useAtlas();
  const match = atlas.match(matchId);
  const t = match ? atlas.tournamentOf(match) : undefined;
  useSetMood({ discipline: t?.discipline });
  if (!match || !t) return <Empty title="Match not found" />;
  const played = match.games.some((g) => g.status !== "scheduled" && (g.scores || g.lines));
  return (
    <div className="space-y-12">
      <MatchHero match={match} mode="page" />
      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-12">
          {t.discipline === "cs2" && played && <Cs2Detail match={match} />}
          {t.discipline === "lol" && played && <LolDetail match={match} />}
          {t.discipline === "chess" && <RoundBoards match={match} />}
          {match.sides.length > 2 && <CupContext match={match} />}
          {match.status === "scheduled" && match.sides.length === 2 && t.discipline !== "chess" && (
            <Preview match={match} />
          )}
          {!played &&
            match.status !== "scheduled" &&
            t.discipline !== "chess" &&
            match.sides.length === 2 && <Empty title="No detail yet" />}
        </div>
        <Aside match={match} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function Cs2Detail({ match }: { match: Match }) {
  const atlas = useAtlas();
  const played = match.games.filter((g) => g.rounds?.length);
  const defaultMap = match.games.findIndex((g) => g.status === "live");
  const [tab, setTab] = useState<string>(
    defaultMap >= 0 ? String(defaultMap) : played.length > 1 ? "all" : "0",
  );
  const game: GameResult | undefined = tab === "all" ? undefined : match.games[Number(tab)];
  const lines = game ? (game.lines ?? []) : mergeLines(played);
  const tabs = [
    ...(played.length > 1 ? [{ id: "all", label: "All maps" }] : []),
    ...match.games
      .map((g, i) => ({ id: String(i), label: `${g.label}${g.status === "live" ? " ●" : ""}` }))
      .filter((_, i) => match.games[i]!.rounds?.length),
  ];
  return (
    <div className="space-y-10">
      {match.veto && (
        <Section kicker="Map veto" title="How the maps were chosen">
          <ol className="flex flex-wrap gap-2">
            {match.veto.map((v, i) => (
              <li
                key={i}
                className={`ui-card flex items-center gap-2.5 !rounded-[var(--radius-sm)] px-3 py-2 text-[13px] ${v.action === "ban" ? "opacity-60" : ""}`}
              >
                <span className="text-[11px] font-semibold text-faint">{i + 1}</span>
                {v.side !== undefined ? (
                  <Mark id={match.sides[v.side]?.competitorId} size={18} />
                ) : (
                  <span className="size-[18px] rounded-[5px] border border-dashed border-muted" />
                )}
                <span
                  className={
                    v.action === "ban" ? "line-through decoration-loss/70" : "font-semibold"
                  }
                >
                  {v.label}
                </span>
                <span className="text-[11.5px] text-muted">
                  {v.action === "decider" ? "decider" : v.action}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section kicker="Maps" title={game ? game.label : "Series"}>
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Map" />
        {game?.rounds && (
          <div className="ui-card mt-5 p-5">
            <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-4">
                <span className="ui-num text-[40px] leading-none">{game.scores?.[0]}</span>
                <span className="text-muted">–</span>
                <span className="ui-num text-[40px] leading-none">{game.scores?.[1]}</span>
              </div>
              <div className="flex gap-6 text-[13px]">
                {halves(game).map((h) => (
                  <div key={h.label}>
                    <div className="text-muted">{h.label}</div>
                    <div className="ui-num mt-0.5 text-[16px]">
                      {h.scores[0]}–{h.scores[1]}
                    </div>
                  </div>
                ))}
                {game.pickedBy !== undefined && (
                  <div>
                    <div className="text-muted">Picked by</div>
                    <div className="mt-0.5 font-semibold">
                      {atlas.short(match.sides[game.pickedBy]?.competitorId)}
                    </div>
                  </div>
                )}
                {game.detail && (
                  <div>
                    <div className="text-muted">Note</div>
                    <div className="mt-0.5 font-semibold">{game.detail}</div>
                  </div>
                )}
              </div>
            </div>
            <RoundHistory match={match} game={game} />
          </div>
        )}
        <div className="mt-5">
          {lines.length ? <Scoreboard match={match} lines={lines} kind="cs2" /> : null}
        </div>
      </Section>
    </div>
  );
}

function LolDetail({ match }: { match: Match }) {
  const atlas = useAtlas();
  const played = match.games.filter((g) => g.status === "finished");
  const [tab, setTab] = useState("0");
  const game = played[Number(tab)];
  if (!game) return null;
  const blue = game.firstSide ?? 0;
  const rows: { label: string; values: number[]; fmt?: (n: number) => string }[] = game.objectives
    ? [
        { label: "Kills", values: game.scores ?? [0, 0] },
        { label: "Towers", values: game.objectives.towers },
        { label: "Dragons", values: game.objectives.dragons },
        { label: "Barons", values: game.objectives.barons },
        { label: "Gold", values: game.objectives.gold, fmt: (n) => `${(n / 1000).toFixed(1)}k` },
      ]
    : [];
  return (
    <Section kicker="Games" title={`Game ${Number(tab) + 1}`}>
      <Tabs
        tabs={played.map((g, i) => ({ id: String(i), label: g.label }))}
        value={tab}
        onChange={setTab}
        label="Game"
      />
      <div className="ui-card mt-5 p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
          <span>
            <span className="font-semibold text-[#3d8bff]">
              {atlas.short(match.sides[blue]?.competitorId)}
            </span>{" "}
            on blue ·{" "}
            <span className="font-semibold text-[#ff5a5a]">
              {atlas.short(match.sides[1 - blue]?.competitorId)}
            </span>{" "}
            on red
          </span>
          <span>
            Duration {game.detail} · won by{" "}
            <span className="font-semibold text-ink">
              {atlas.name(match.sides[game.winner as number]?.competitorId)}
            </span>
          </span>
        </div>
        <div className="space-y-3">
          {rows.map((r) => {
            const total = (r.values[0] ?? 0) + (r.values[1] ?? 0) || 1;
            const c0 = atlas.colors(match.sides[0]?.competitorId).primary;
            const c1 = atlas.colors(match.sides[1]?.competitorId).primary;
            return (
              <div
                key={r.label}
                className="grid grid-cols-[56px_1fr_56px] items-center gap-3 text-[13.5px]"
              >
                <span className="ui-num text-[16px]">
                  {r.fmt ? r.fmt(r.values[0]!) : r.values[0]}
                </span>
                <div>
                  <div className="mb-1 text-center text-[11.5px] text-muted">{r.label}</div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-raised">
                    <span
                      style={{ width: `${((r.values[0] ?? 0) / total) * 100}%`, background: c0 }}
                    />
                    <span
                      className="ml-auto"
                      style={{ width: `${((r.values[1] ?? 0) / total) * 100}%`, background: c1 }}
                    />
                  </div>
                </div>
                <span className="ui-num text-right text-[16px]">
                  {r.fmt ? r.fmt(r.values[1]!) : r.values[1]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {game.lines && (
        <div className="mt-5">
          <Scoreboard match={match} lines={game.lines} kind="lol" />
        </div>
      )}
    </Section>
  );
}

function RoundBoards({ match }: { match: Match }) {
  const atlas = useAtlas();
  const round = atlas.roundOf(match);
  const others = (round?.matchIds ?? [])
    .filter((id) => id !== match.id)
    .map((id) => atlas.match(id)!);
  return (
    <Section kicker={round?.name ?? ""} title="The other boards">
      <div className="ui-card ui-divide overflow-hidden">
        {others.map((m) => (
          <MatchRow key={m.id} match={m} showEvent={false} />
        ))}
      </div>
    </Section>
  );
}

function CupContext({ match }: { match: Match }) {
  const atlas = useAtlas();
  const round = atlas.roundOf(match);
  const others = (round?.matchIds ?? [])
    .filter((id) => id !== match.id)
    .map((id) => atlas.match(id)!);
  return (
    <Section kicker={round?.name ?? ""} title="The other heats">
      <div className="ui-card ui-divide overflow-hidden">
        {others.map((m) => (
          <MatchRow key={m.id} match={m} showEvent={false} />
        ))}
      </div>
    </Section>
  );
}

function Preview({ match }: { match: Match }) {
  const atlas = useAtlas();
  const [a, b] = match.sides.map((s) => s.competitorId);
  const h2h = a && b ? headToHead(atlas, a, b) : [];
  return (
    <div className="space-y-10">
      <Section kicker="Preview" title="Form and lineups">
        <div className="grid gap-4 md:grid-cols-2">
          {match.sides.map((s, i) =>
            s.competitorId ? (
              <div key={i} className="ui-card p-5">
                <CompetitorLink
                  id={s.competitorId}
                  className="flex items-center gap-3 hover:text-accent"
                >
                  <Mark id={s.competitorId} size={36} />
                  <span className="ui-h3">{atlas.name(s.competitorId)}</span>
                </CompetitorLink>
                <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
                  Last five <Form results={form(atlas, s.competitorId, 5)} />
                </div>
                <ul className="mt-4 divide-y divide-line">
                  {atlas
                    .roster(s.competitorId)
                    .filter((r) => r.stint.role !== "Coach")
                    .map(({ player, stint }) => (
                      <li key={player.id}>
                        <PlayerLink
                          id={player.id}
                          className="flex items-center gap-2 py-2 text-[14px] hover:text-accent"
                        >
                          <span className="font-semibold">{player.handle}</span>
                          <Country code={player.country} className="text-faint" />
                          <span className="ml-auto text-[12.5px] text-muted">{stint.role}</span>
                        </PlayerLink>
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <div
                key={i}
                className="ui-card grid place-items-center p-5 text-center text-[14px] text-muted"
              >
                {s.placeholder}
              </div>
            ),
          )}
        </div>
      </Section>
      {a && b && (
        <Section
          kicker="Head to head"
          title={
            h2h.length
              ? `${h2h.length} previous ${h2h.length === 1 ? "meeting" : "meetings"}`
              : "First meeting this season"
          }
        >
          {h2h.length ? (
            <div className="ui-card ui-divide overflow-hidden">
              {h2h.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-muted">
              These two haven't met in any event Slate has data for.
            </p>
          )}
        </Section>
      )}
    </div>
  );
}

function Aside({ match }: { match: Match }) {
  const atlas = useAtlas();
  const now = useMinute();
  const t = atlas.tournamentOf(match);
  const ahead = pathAhead(atlas, match);
  const round = atlas.roundOf(match);
  const siblings = (round?.matchIds ?? [])
    .filter((id) => id !== match.id)
    .map((id) => atlas.match(id)!);
  return (
    <aside className="space-y-8">
      <div className="ui-card ui-card-pad">
        <div className="ui-kicker mb-3">Match info</div>
        <dl className="space-y-3 text-[14px]">
          <Info
            label="When"
            value={`${longDate(match.scheduledAt)}, ${clock(match.scheduledAt)}`}
          />
          <Info
            label="Event"
            value={
              <EventLink id={t.id} className="hover:text-accent">
                {t.name}
              </EventLink>
            }
          />
          <Info label="Stage" value={roundLabel(atlas, match)} />
          <Info
            label="Format"
            value={
              match.sides.length > 2 ? `${match.sides.length}-way race` : `Best of ${match.bestOf}`
            }
          />
          {t.location && (
            <Info
              label="Venue"
              value={`${t.location.venue ? `${t.location.venue}, ` : ""}${t.location.city}`}
            />
          )}
          {match.stream && <Info label="Stream" value={match.stream.label} />}
          <Info label="Source" value={<span className="text-muted">{t.provenance.source}</span>} />
        </dl>
      </div>
      {ahead && (
        <div>
          <div className="ui-kicker mb-3">What's at stake</div>
          <div className="ui-card ui-divide overflow-hidden">
            <div className="px-4 pt-3 pb-1 text-[12.5px] text-muted">The winner plays next</div>
            <MatchRow match={ahead.next} showEvent={false} />
          </div>
        </div>
      )}
      {siblings.length > 0 && t.discipline !== "chess" && match.sides.length === 2 && (
        <div>
          <div className="ui-kicker mb-3">Also in the {round?.name.toLowerCase()}</div>
          <div className="ui-card ui-divide overflow-hidden">
            {siblings.slice(0, 6).map((m) => (
              <MatchRow key={m.id} match={m} showEvent={false} dense />
            ))}
          </div>
        </div>
      )}
      <p className="text-[12px] text-faint">Updated {clock(new Date(now).toISOString())}.</p>
    </aside>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
