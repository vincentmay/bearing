import type { Match } from "@bearing/domain";
import { clock, dayLabel, liveGame, relative, seriesScore, winnerOf } from "@bearing/domain";
import { ArrowUpRight, Play } from "lucide-react";
import type { CSSProperties } from "react";
import { Chessboard, EvalBar } from "../components/chessboard";
import { CompetitorLink, EventLink, MatchLink } from "../components/links";
import { Country, Mark, mix, readableOn } from "../components/mark";
import { FollowButton, LiveBadge, LiveDot } from "../components/ui";
import { useDir } from "../lib/dir";
import { matchStory, plain } from "../lib/story";
import { pathAhead, pendingSource, roundLabel } from "../lib/view";
import { estimatedMinutes, useAtlas, useMinute } from "../lib/world";

/**
 * The big scoreline for a match, in each direction's own voice. Used as the lead on Now
 * (`mode="feature"`, with a link through) and as the header of the match page.
 */
export function MatchHero({ match, mode }: { match: Match; mode: "feature" | "page" }) {
  const dir = useDir();
  const atlas = useAtlas();
  const t = atlas.tournamentOf(match);
  if (t.discipline === "chess") return <ChessHero match={match} mode={mode} />;
  if (match.sides.length > 2) return <CupHero match={match} mode={mode} />;
  switch (dir) {
    case "slate":
      return <SlateHero match={match} mode={mode} />;
    case "studio":
      return <StudioHero match={match} mode={mode} />;
    case "arena":
      return <ArenaHero match={match} mode={mode} />;
    case "broadcast":
      return <BroadcastHero match={match} mode={mode} />;
    case "almanac":
      return <AlmanacHero match={match} mode={mode} />;
    case "signal":
      return <SignalHero match={match} mode={mode} />;
  }
}

function useHero(match: Match) {
  const atlas = useAtlas();
  const now = useMinute();
  const t = atlas.tournamentOf(match);
  const score = seriesScore(match);
  const ahead = pathAhead(atlas, match);
  const story = matchStory(atlas, match, now);
  const names = match.sides.map((s, i) => {
    if (s.competitorId) return plain(atlas, s.competitorId);
    const pending = pendingSource(atlas, match, i);
    return pending
      ? pending.sides.map((x) => plain(atlas, x.competitorId)).join(" or ")
      : (s.placeholder ?? "TBD");
  });
  const colors = match.sides.map((s) => atlas.colors(s.competitorId));
  const status =
    match.status === "live"
      ? "Live"
      : match.status === "finished"
        ? "Final"
        : `${dayLabel(match.scheduledAt, now)} · ${clock(match.scheduledAt)}`;
  const aheadLine = ahead
    ? `Winner meets ${ahead.waiting ? plain(atlas, ahead.waiting) : "the other semifinal's winner"} in the ${ahead.round?.name.toLowerCase().replace(/finals$/, "final")}, ${dayLabel(ahead.next.scheduledAt, now).toLowerCase()} at ${clock(ahead.next.scheduledAt)}`
    : undefined;
  return { atlas, now, t, score, ahead, story, names, colors, status, aheadLine };
}

function lead(score: number[], i: number) {
  return score[i]! > score[1 - i]!;
}

function Actions({
  match,
  mode,
  tone = "default",
}: {
  match: Match;
  mode: "feature" | "page";
  tone?: "default" | "onColor";
}) {
  const atlas = useAtlas();
  const followable =
    match.sides.find((s) => s.competitorId && atlas.followsCompetitor(s.competitorId)) ??
    match.sides[0];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {match.stream && match.status !== "finished" && (
        <a
          href="#"
          className={`ui-btn ui-btn-primary ${tone === "onColor" ? "!bg-white !text-black" : ""}`}
        >
          <Play className="size-4 fill-current" />{" "}
          {match.status === "live" ? "Watch live" : "Stream"}
        </a>
      )}
      {mode === "feature" ? (
        <MatchLink
          id={match.id}
          className={`ui-btn ${tone === "onColor" ? "!border-white/40 !bg-white/10 !text-white" : ""}`}
        >
          Match centre <ArrowUpRight className="size-4" />
        </MatchLink>
      ) : (
        followable?.competitorId && (
          // On a team-coloured hero the button takes a translucent white treatment.
          <span
            className={
              tone === "onColor"
                ? "[&_.ui-btn]:!border-white/40 [&_.ui-btn]:!bg-white/15 [&_.ui-btn]:!text-white [&_.ui-btn]:!shadow-none"
                : ""
            }
          >
            <FollowButton
              follow={{
                kind:
                  atlas.competitor(followable.competitorId)?.kind === "team" ? "team" : "player",
                id: followable.competitorId,
              }}
            />
          </span>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Slate: the match set in stone. A solid graphite slab in either theme; team colour is a thin edge.

const SLAB = {
  bg: "#1e242c",
  ink: "#f3f1ec",
  muted: "#9aa4af",
  faint: "#5d6670",
  line: "rgb(255 255 255 / 0.08)",
  flare: "#ff5a36",
};

function SlateHero({ match, mode }: { match: Match; mode: "feature" | "page" }) {
  const { atlas, t, score, names, colors, status, aheadLine } = useHero(match);
  return (
    <section
      className="rise-in relative overflow-hidden rounded-[var(--radius)]"
      style={{ background: SLAB.bg, color: SLAB.ink }}
    >
      {/* The stone's grain: three faint strata. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {[18, 46, 81].map((y) => (
          <span
            key={y}
            className="absolute inset-x-0 h-px"
            style={{ top: `${y}%`, background: "rgb(255 255 255 / 0.035)" }}
          />
        ))}
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-8 sm:pt-7">
        <EventLink
          id={t.id}
          className="flex items-center gap-2.5 text-[13.5px] font-medium hover:underline"
        >
          <span
            className="h-1 w-3.5"
            style={{
              background: SLAB.muted,
              clipPath: "polygon(0 0, 100% 0, calc(100% - 3px) 100%, 0 100%)",
            }}
          />
          <span style={{ color: SLAB.muted }}>
            {t.name} · {roundLabel(atlas, match)} · Bo{match.bestOf}
          </span>
        </EventLink>
        {match.status === "live" ? (
          <span
            className="flex items-center gap-2 text-[12.5px] font-semibold"
            style={{ color: SLAB.flare }}
          >
            <span className="live-dot size-2 rounded-full" style={{ background: SLAB.flare }} />{" "}
            Live
          </span>
        ) : (
          <span className="text-[13px] font-medium" style={{ color: SLAB.muted }}>
            {status}
          </span>
        )}
      </div>
      <div className="relative space-y-1 px-5 py-7 sm:px-8 sm:py-9">
        {match.sides.map((s, i) => {
          const lead = score[i]! > score[1 - i]!;
          const behind = score[i]! < score[1 - i]!;
          return (
            <CompetitorLink
              key={i}
              id={s.competitorId}
              className="group flex items-center gap-4 sm:gap-6"
            >
              <span
                className="h-12 w-1 shrink-0 rounded-full sm:h-16"
                style={{ background: colors[i]!.primary }}
              />
              <Mark id={s.competitorId} size={44} className="shrink-0 sm:size-[56px]" />
              <span
                className="min-w-0 flex-1 truncate text-[30px] font-[720] tracking-[-0.04em] group-hover:underline sm:text-[52px]"
                style={{ color: behind ? SLAB.muted : SLAB.ink }}
              >
                {names[i]}
              </span>
              <span
                className="text-[44px] leading-none font-[720] tracking-[-0.05em] tabular-nums sm:text-[76px]"
                style={{ color: lead ? SLAB.ink : SLAB.faint }}
              >
                {match.status === "scheduled" ? "" : score[i]}
              </span>
            </CompetitorLink>
          );
        })}
      </div>
      {match.games.length > 0 && (
        <div
          className="relative grid gap-px border-t sm:[grid-template-columns:repeat(var(--games),minmax(0,1fr))]"
          style={{
            borderColor: SLAB.line,
            background: SLAB.line,
            ["--games" as string]: match.games.length,
          }}
        >
          <div className="contents">
            {match.games.map((g, i) => {
              const picker =
                g.pickedBy !== undefined
                  ? atlas.short(match.sides[g.pickedBy]?.competitorId)
                  : null;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-8"
                  style={{ background: SLAB.bg }}
                >
                  <div>
                    <div className="text-[11.5px]" style={{ color: SLAB.faint }}>
                      {picker
                        ? `${picker} pick`
                        : t.discipline === "cs2"
                          ? "Decider"
                          : `Game ${i + 1}`}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[15px] font-semibold">
                      {g.status === "live" && (
                        <span
                          className="live-dot size-1.5 rounded-full"
                          style={{ background: SLAB.flare }}
                        />
                      )}
                      {g.label}
                    </div>
                  </div>
                  <span
                    className="font-mono text-[15px]"
                    style={{ color: g.status === "scheduled" ? SLAB.faint : SLAB.ink }}
                  >
                    {g.scores ? `${g.scores[0]}–${g.scores[1]}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div
        className="relative flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4 sm:px-8"
        style={{ borderColor: SLAB.line }}
      >
        <span className="text-[13.5px]" style={{ color: SLAB.muted }}>
          {aheadLine ? `${aheadLine}.` : t.blurb}
        </span>
        <span className="[&_.ui-btn]:!rounded-[8px] [&_.ui-btn]:!border-white/15 [&_.ui-btn]:!bg-white/[0.06] [&_.ui-btn]:!text-[#f3f1ec] [&_.ui-btn-primary]:!border-transparent [&_.ui-btn-primary]:!bg-[#f3f1ec] [&_.ui-btn-primary]:!text-[#161a20]">
          <Actions match={match} mode={mode} />
        </span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Studio: a team-coloured card, big numbers, calm everywhere else.

function StudioHero({ match, mode }: { match: Match; mode: "feature" | "page" }) {
  const { atlas, t, score, names, colors, status, aheadLine } = useHero(match);
  const a = colors[0]!.primary;
  const b = colors[1]!.primary;
  const bg: CSSProperties = {
    background: `linear-gradient(110deg, ${mix(a, "#000000", 0.42)} 0%, ${mix(a, "#000000", 0.66)} 42%, ${mix(b, "#000000", 0.66)} 58%, ${mix(b, "#000000", 0.42)} 100%)`,
    textShadow: "0 1px 12px rgb(0 0 0 / 0.25)",
  };
  return (
    <div className="ui-card relative overflow-hidden text-white" style={bg}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_50%_-20%,rgb(255_255_255/0.18),transparent_60%)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-8 sm:pt-7">
        <EventLink id={t.id} className="text-[13.5px] font-semibold text-white/85 hover:text-white">
          {t.name} · {roundLabel(atlas, match)} · Bo{match.bestOf}
        </EventLink>
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-bold ${match.status === "live" ? "bg-white text-[#ff3b30]" : "bg-white/15"}`}
        >
          {match.status === "live" ? "● LIVE" : status}
        </span>
      </div>
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-8 sm:px-8 sm:py-10">
        {[0, 1].map((i) => {
          const el = (
            <CompetitorLink
              id={match.sides[i]!.competitorId}
              className={`flex min-w-0 flex-col items-center gap-3 text-center ${!lead(score, i) && match.status !== "scheduled" ? "opacity-70" : ""}`}
            >
              <span className="grid size-[72px] place-items-center rounded-[22px] bg-white/95 shadow-lg sm:size-[92px]">
                <Mark id={match.sides[i]!.competitorId} size={56} className="sm:size-[70px]" />
              </span>
              <span className="w-full truncate text-[20px] font-[720] tracking-[-0.03em] sm:text-[30px]">
                {names[i]}
              </span>
            </CompetitorLink>
          );
          if (i === 1)
            return (
              <div key={i} className="contents">
                <div className="text-center">
                  <div className="flex items-center gap-3 font-[780] tracking-[-0.05em] sm:gap-5">
                    <span
                      className={`text-[56px] leading-none sm:text-[96px] ${lead(score, 0) ? "" : "opacity-60"}`}
                    >
                      {match.status === "scheduled" ? "" : score[0]}
                    </span>
                    <span className="text-[28px] opacity-50 sm:text-[44px]">
                      {match.status === "scheduled" ? "vs" : "–"}
                    </span>
                    <span
                      className={`text-[56px] leading-none sm:text-[96px] ${lead(score, 1) ? "" : "opacity-60"}`}
                    >
                      {match.status === "scheduled" ? "" : score[1]}
                    </span>
                  </div>
                  {match.status === "scheduled" && (
                    <div className="mt-2 text-[14px] font-semibold text-white/80">{status}</div>
                  )}
                </div>
                {el}
              </div>
            );
          return <div key={i}>{el}</div>;
        })}
      </div>
      {match.games.length > 0 && (
        <div className="relative flex flex-wrap justify-center gap-2 px-5 sm:px-8">
          {match.games.map((g, i) => (
            <span
              key={i}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${g.status === "live" ? "bg-white text-black" : g.status === "finished" ? "bg-white/18" : "bg-white/8 text-white/60"}`}
            >
              {g.status === "live" && <LiveDot />}
              {g.label}
              {g.scores && (
                <span className="tabular-nums opacity-80">
                  {g.scores[0]}–{g.scores[1]}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 px-5 py-4 sm:px-8">
        <span className="text-[13.5px] text-white/80">{aheadLine ?? t.blurb}</span>
        <Actions match={match} mode={mode} tone="onColor" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Arena: broadcast-scale type over the stage.

function ArenaHero({ match, mode }: { match: Match; mode: "feature" | "page" }) {
  const { atlas, t, score, names, status, aheadLine } = useHero(match);
  return (
    <section
      className={`flex flex-col justify-center ${mode === "feature" ? "min-h-[min(640px,calc(100svh-120px))]" : "min-h-[420px]"} rise-in py-6`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">
        {match.status === "live" ? (
          <span className="flex items-center gap-2 rounded-full bg-live/15 px-2.5 py-1 text-live">
            <LiveDot /> Live
          </span>
        ) : (
          <span className="text-ink">{status}</span>
        )}
        <EventLink id={t.id} className="text-ink hover:text-accent">
          {t.name}
        </EventLink>
        <span className="text-faint">/</span>
        <span>
          {roundLabel(atlas, match)} · Best of {match.bestOf}
        </span>
      </div>
      <div className="mt-6 max-w-[760px] space-y-1">
        {match.sides.map((s, i) => (
          <div key={i} className="flex items-center gap-4 sm:gap-6">
            <Mark id={s.competitorId} size={60} className="shrink-0 sm:size-[76px]" />
            <CompetitorLink
              id={s.competitorId}
              className={`ui-h1 min-w-0 flex-1 truncate !text-[56px] !leading-[0.95] sm:!text-[110px] ${lead(score, 1 - i) ? "text-ink/40" : ""} hover:text-accent`}
            >
              {names[i]}
            </CompetitorLink>
            {match.status !== "scheduled" && (
              <span
                className={`ui-num text-[56px] leading-[0.9] sm:text-[110px] ${lead(score, i) ? "text-accent" : "text-ink/40"}`}
              >
                {score[i]}
              </span>
            )}
          </div>
        ))}
      </div>
      {match.games.length > 0 && (
        <div
          className="mt-8 grid max-w-[760px] grid-cols-3 gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(5, match.games.length)}, minmax(0, 1fr))`,
          }}
        >
          {match.games.map((g, i) => {
            const picker =
              g.pickedBy !== undefined ? atlas.short(match.sides[g.pickedBy]?.competitorId) : null;
            return (
              <div
                key={i}
                className={`ui-card relative overflow-hidden px-3 py-3 sm:px-4 ${g.status === "live" ? "!border-live/60" : ""}`}
              >
                <div className="flex items-center justify-between text-[9.5px] font-semibold tracking-[0.18em] text-faint uppercase">
                  <span>
                    {picker
                      ? `${picker} pick`
                      : t.discipline === "cs2"
                        ? "Decider"
                        : `Game ${i + 1}`}
                  </span>
                  {g.status === "live" && <LiveDot />}
                </div>
                <div className="mt-1.5 truncate text-[16px] font-semibold">{g.label}</div>
                <div className="mt-1 font-mono text-[13px] text-muted">
                  {g.scores ? `${g.scores[0]} – ${g.scores[1]}` : "—"}
                </div>
                {g.status === "live" && (
                  <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-live to-transparent" />
                )}
              </div>
            );
          })}
        </div>
      )}
      {aheadLine && <p className="mt-6 text-[15px] text-muted">{aheadLine}.</p>}
      <div className="mt-8">
        <Actions match={match} mode={mode} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Broadcast: the split-screen scorebug.

function BroadcastHero({ match, mode }: { match: Match; mode: "feature" | "page" }) {
  const { atlas, t, score, names, colors, status, aheadLine } = useHero(match);
  const panel = (i: number): CSSProperties => ({
    background: `linear-gradient(${i === 0 ? "100deg" : "260deg"}, ${colors[i]!.primary} 0%, ${mix(colors[i]!.primary, "#000000", 0.35)} 100%)`,
    color: readableOn(colors[i]!.primary),
    clipPath:
      i === 0
        ? "polygon(0 0, 100% 0, calc(100% - 36px) 100%, 0 100%)"
        : "polygon(36px 0, 100% 0, 100% 100%, 0 100%)",
  });
  return (
    <section className="rise-in">
      <div className="flex flex-wrap items-center gap-2">
        <EventLink id={t.id} className="ui-kicker">
          {t.name}
        </EventLink>
        <span
          className="bg-white px-3 py-1 text-[13px] font-black text-black uppercase italic"
          style={{ fontFamily: "var(--display)", fontStretch: "75%" }}
        >
          {roundLabel(atlas, match)} · Bo{match.bestOf}
        </span>
        <span
          className={`px-3 py-1 text-[13px] font-black uppercase italic ${match.status === "live" ? "bg-live text-white" : "bg-raised text-muted"}`}
          style={{ fontFamily: "var(--display)", fontStretch: "75%" }}
        >
          {match.status === "live" ? "● Live" : status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch">
        {[0, 1].map((i) => {
          const team = (
            <CompetitorLink
              id={match.sides[i]!.competitorId}
              className={`flex min-h-[96px] min-w-0 items-center gap-3 px-3 sm:min-h-[180px] sm:gap-4 sm:px-8 ${i === 1 ? "flex-row-reverse text-right" : ""}`}
            >
              <span
                className="grid size-14 shrink-0 place-items-center bg-white sm:size-20"
                style={{ clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0 100%)" }}
              >
                <Mark id={match.sides[i]!.competitorId} size={44} className="sm:size-[60px]" />
              </span>
              {/* On phones the plate (which carries the team tag) stands alone beside the score. */}
              <span className="ui-h1 hidden min-w-0 truncate sm:block sm:!text-[76px]">
                {names[i]}
              </span>
            </CompetitorLink>
          );
          return i === 0 ? (
            <div key={i} className="contents">
              <div className="min-w-0" style={panel(0)}>
                {team}
              </div>
              <div className="flex items-center gap-1 bg-black px-3 sm:px-6">
                <span
                  className={`ui-num text-[54px] sm:text-[104px] ${lead(score, 0) ? "text-white" : "text-white/45"}`}
                >
                  {match.status === "scheduled" ? "" : score[0]}
                </span>
                <span className="mx-1 h-12 w-1.5 -skew-x-12 bg-accent sm:h-20" />
                <span
                  className={`ui-num text-[54px] sm:text-[104px] ${lead(score, 1) ? "text-white" : "text-white/45"}`}
                >
                  {match.status === "scheduled" ? "" : score[1]}
                </span>
              </div>
            </div>
          ) : (
            <div key={i} className="min-w-0" style={panel(1)}>
              {team}
            </div>
          );
        })}
      </div>
      {match.games.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {match.games.map((g, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2 ${g.status === "live" ? "bg-live text-white" : g.status === "finished" ? "bg-white text-black" : "bg-raised text-muted"}`}
              style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}
            >
              <span
                className="text-[14px] font-black uppercase italic"
                style={{ fontFamily: "var(--display)", fontStretch: "75%" }}
              >
                {g.label}
              </span>
              {g.scores && (
                <span className="text-[14px] font-bold tabular-nums">
                  {g.scores[0]}–{g.scores[1]}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        {aheadLine && <p className="text-[15px] text-muted">{aheadLine}.</p>}
        <Actions match={match} mode={mode} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Almanac: a headline written from the data, with a typeset scoreboard.

function AlmanacHero({ match, mode }: { match: Match; mode: "feature" | "page" }) {
  const { atlas, t, score, story, status } = useHero(match);
  return (
    <article className="rise-in max-w-[860px]">
      <div className="ui-kicker flex items-center gap-2">
        {match.status === "live" && <LiveDot />}
        {match.status === "live" ? "Live" : status} · {atlas.discipline(t.discipline).name} ·{" "}
        <EventLink id={t.id} className="hover:underline">
          {t.name}
        </EventLink>
      </div>
      <h1 className="ui-h1 mt-4">{story.headline}</h1>
      {story.deck && (
        <p
          className="mt-5 max-w-[680px] text-[19px] leading-[1.55] text-ink/80"
          style={{ fontFamily: "var(--display)", fontVariationSettings: '"opsz" 14' }}
        >
          {story.deck}
        </p>
      )}
      <table className="mt-8 w-full max-w-[720px] border-collapse text-[15px]">
        <thead>
          <tr className="text-[10.5px] font-semibold tracking-[0.12em] text-muted uppercase">
            <th className="border-b border-ink py-2 text-left">
              {roundLabel(atlas, match)} · Bo{match.bestOf}
            </th>
            {match.games.map((g) => (
              <th
                key={g.label}
                className="hidden w-20 border-b border-ink py-2 text-center sm:table-cell"
              >
                {g.label}
              </th>
            ))}
            <th className="w-16 border-b border-ink py-2 text-right">
              {atlas.discipline(t.discipline).unit.many}
            </th>
          </tr>
        </thead>
        <tbody>
          {match.sides.map((s, i) => (
            <tr key={i}>
              <td className="border-b border-line py-3">
                <CompetitorLink
                  id={s.competitorId}
                  className="flex items-center gap-3 hover:text-accent"
                >
                  <Mark id={s.competitorId} size={26} tone="ink" />
                  <span className={`text-[17px] ${lead(score, i) ? "font-semibold" : ""}`}>
                    {atlas.name(s.competitorId)}
                  </span>
                </CompetitorLink>
              </td>
              {match.games.map((g) => (
                <td
                  key={g.label}
                  className="hidden border-b border-line py-3 text-center font-mono text-[14px] sm:table-cell"
                >
                  {g.scores ? (
                    <span className={g.winner === i ? "font-semibold" : "text-muted"}>
                      {g.scores[i]}
                    </span>
                  ) : (
                    <span className="text-faint">·</span>
                  )}
                  {g.status === "live" && i === 0 && <LiveDot className="ml-1 align-middle" />}
                </td>
              ))}
              <td className="ui-num border-b border-line py-3 text-right text-[22px]">
                {match.status === "scheduled" ? "–" : score[i]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-5">
        <Actions match={match} mode={mode} />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------------------------
// Signal: the match as an instrument readout.

function SignalHero({ match, mode }: { match: Match; mode: "feature" | "page" }) {
  const { atlas, now, t, score, names, ahead } = useHero(match);
  const d = atlas.discipline(t.discipline);
  const end = Date.parse(match.scheduledAt) + estimatedMinutes(match, d.id) * 60_000;
  const lg = liveGame(match);
  return (
    <section className="ui-card grid md:grid-cols-[1fr_260px]">
      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
          <span
            className="border px-1.5 py-0.5"
            style={{ borderColor: d.palette.accent, color: d.palette.accent }}
          >
            {d.short}
          </span>
          {match.status === "live" ? (
            <span className="text-live">● LIVE</span>
          ) : (
            <span className="text-muted">
              {match.status === "finished"
                ? "FINAL"
                : `${dayLabel(match.scheduledAt, now).toUpperCase()} ${clock(match.scheduledAt, true)}`}
            </span>
          )}
          <EventLink id={t.id} className="text-muted hover:text-accent">
            {t.short.toLowerCase()} / {roundLabel(atlas, match).toLowerCase()} / bo{match.bestOf}
          </EventLink>
        </div>
        <div className="mt-5 space-y-2">
          {match.sides.map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <Mark id={s.competitorId} size={40} />
              <CompetitorLink
                id={s.competitorId}
                className={`min-w-0 flex-1 truncate text-[28px] font-semibold tracking-[-0.03em] sm:text-[38px] ${lead(score, 1 - i) ? "text-muted" : ""} hover:text-accent`}
              >
                {names[i]}
              </CompetitorLink>
              <span
                className={`font-mono text-[38px] sm:text-[48px] ${lead(score, i) ? "text-accent" : "text-muted"}`}
              >
                {match.status === "scheduled" ? "–" : score[i]}
              </span>
            </div>
          ))}
        </div>
        {match.games.length > 0 && (
          <table className="mt-6 w-full font-mono text-[12.5px]">
            <tbody>
              {match.games.map((g, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-2 pr-3 text-faint">{String(i + 1).padStart(2, "0")}</td>
                  <td className="py-2 pr-3">{g.label.toLowerCase()}</td>
                  <td className="py-2 pr-3 text-muted">
                    {g.pickedBy !== undefined
                      ? `${atlas.short(match.sides[g.pickedBy]?.competitorId).toLowerCase()} pick`
                      : ""}
                  </td>
                  <td className={`py-2 text-right ${g.status === "live" ? "text-live" : ""}`}>
                    {g.scores ? `${g.scores[0]}–${g.scores[1]}` : "—"}
                    {g.status === "live" ? " ●" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <dl className="divide-y divide-line border-t border-line font-mono text-[11.5px] md:border-t-0 md:border-l">
        <Meta
          label="start"
          value={`${clock(match.scheduledAt, true)} · ${relative(match.scheduledAt, now)}`}
        />
        <Meta
          label="ends ~"
          value={
            match.status === "finished" ? "done" : `${clock(new Date(end).toISOString(), true)}`
          }
        />
        {lg && (
          <Meta
            label="now"
            value={`${lg.label.toLowerCase()} ${lg.scores ? `${lg.scores[0]}–${lg.scores[1]}` : ""}`}
          />
        )}
        {ahead && (
          <Meta
            label="winner →"
            value={`${ahead.round?.short ?? ""} ${ahead.waiting ? `v ${atlas.short(ahead.waiting)}` : ""} · ${clock(ahead.next.scheduledAt, true)}`}
          />
        )}
        <div className="p-3">
          {mode === "feature" ? (
            <MatchLink id={match.id} className="ui-btn w-full">
              open match ↗
            </MatchLink>
          ) : (
            <Actions match={match} mode={mode} />
          )}
        </div>
      </dl>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2.5">
      <dt className="text-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-ink">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Chess and cup heroes are shared across directions; tokens give them each direction's look.

function ChessHero({ match, mode }: { match: Match; mode: "feature" | "page" }) {
  const { atlas, t, status } = useHero(match);
  const g = match.games[0]!;
  const w = winnerOf(match);
  return (
    <section className="ui-card grid gap-6 p-5 sm:p-8 md:grid-cols-[auto_1fr]">
      <div className="flex gap-3">
        {g.chess ? (
          <>
            <EvalBar value={g.chess.eval ?? 0} height={320} />
            <Chessboard fen={g.chess.fen} size={320} className="rounded-[6px]" />
          </>
        ) : (
          <div className="grid size-[200px] place-items-center rounded-[6px] bg-raised">
            <span className="ui-num text-[44px]">
              {g.winner === "draw" ? "½–½" : g.winner === 0 ? "1–0" : g.winner === 1 ? "0–1" : "vs"}
            </span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="ui-kicker flex items-center gap-2">
          {match.status === "live" ? <LiveBadge /> : status}
          <EventLink id={t.id} className="hover:underline">
            {t.name} · {roundLabel(atlas, match)} · {g.label}
          </EventLink>
        </div>
        <div className="mt-5 space-y-4">
          {[1, 0].map((i) => {
            const p = atlas.player(match.sides[i]!.competitorId ?? "");
            return (
              <CompetitorLink key={i} id={p?.id} className="flex items-center gap-4">
                <span
                  className={`size-5 shrink-0 rounded-[4px] border border-ink/30 ${i === 0 ? "bg-[#fbfaf6]" : "bg-[#16130f]"}`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`ui-h2 block truncate ${typeof w === "number" && w !== i ? "text-muted" : ""}`}
                  >
                    {p?.name ?? p?.handle}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-[13px] text-muted">
                    {p?.title} · {p?.rating?.value} <Country code={p?.country} />
                  </span>
                </span>
                {g.chess?.clocks && <span className="ui-num text-[26px]">{g.chess.clocks[i]}</span>}
                {match.status === "finished" && (
                  <span className="ui-num text-[28px]">
                    {g.winner === "draw" ? "½" : g.winner === i ? "1" : "0"}
                  </span>
                )}
              </CompetitorLink>
            );
          })}
        </div>
        <dl className="mt-auto grid grid-cols-2 gap-4 pt-6 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-muted">Opening</dt>
            <dd className="mt-0.5 font-medium">{g.detail?.split("·")[0]?.trim()}</dd>
          </div>
          {g.chess && (
            <>
              <div>
                <dt className="text-muted">Move</dt>
                <dd className="mt-0.5 font-medium">
                  {g.chess.move} · last {g.chess.lastMove}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Evaluation</dt>
                <dd className="mt-0.5 font-medium">
                  {g.chess.eval !== undefined
                    ? `${g.chess.eval > 0 ? "+" : ""}${g.chess.eval.toFixed(1)}`
                    : "—"}{" "}
                  <span className="text-faint">(illustrative)</span>
                </dd>
              </div>
            </>
          )}
        </dl>
        <div className="mt-5">
          <Actions match={match} mode={mode} />
        </div>
      </div>
    </section>
  );
}

function CupHero({ match, mode }: { match: Match; mode: "feature" | "page" }) {
  const { atlas, t, status } = useHero(match);
  const g = match.games[0]!;
  const limit = g.cup?.limit ?? 120;
  const order = match.sides
    .map((s, i) => ({ s, i, pts: g.scores?.[i] ?? 0 }))
    .sort((a, b) => b.pts - a.pts);
  return (
    <section className="ui-card p-5 sm:p-8">
      <div className="ui-kicker flex items-center gap-2">
        {match.status === "live" ? <LiveBadge /> : status}
        <EventLink id={t.id} className="hover:underline">
          {t.name} · {roundLabel(atlas, match)}
        </EventLink>
      </div>
      <h2 className="ui-h1 mt-4 !text-[44px] sm:!text-[64px]">{g.label}</h2>
      <p className="mt-2 text-[14px] text-muted">
        {match.status === "live"
          ? `${g.detail} · first to ${limit} points becomes a finalist; a finalist who then wins a round finishes first.`
          : t.stages[0]?.explainer}
      </p>
      <div className="mt-6 space-y-3">
        {order.map(({ s, i, pts }, rank) => {
          const p = atlas.player(s.competitorId ?? "");
          const finalist = g.cup?.finalists.includes(i);
          return (
            <CompetitorLink
              key={i}
              id={s.competitorId}
              className="grid grid-cols-[28px_140px_1fr_52px] items-center gap-3 sm:grid-cols-[28px_200px_1fr_60px]"
            >
              <span className="ui-num text-[18px] text-muted">
                {match.status === "scheduled" ? "·" : rank + 1}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="ui-h3 truncate">{p?.handle ?? s.placeholder}</span>
                <Country code={p?.country} className="text-faint" />
              </span>
              <span className="relative h-3 overflow-hidden rounded-full bg-raised">
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{
                    width: `${(pts / limit) * 100}%`,
                    background: finalist ? "var(--accent)" : "var(--muted)",
                  }}
                />
              </span>
              <span className={`ui-num text-right text-[20px] ${finalist ? "text-accent" : ""}`}>
                {match.status === "scheduled" ? "" : pts}
              </span>
            </CompetitorLink>
          );
        })}
      </div>
      <div className="mt-6">
        <Actions match={match} mode={mode} />
      </div>
    </section>
  );
}
