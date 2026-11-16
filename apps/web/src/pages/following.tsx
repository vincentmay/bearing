import type { Follow } from "@bearing/domain";
import { RotateCcw } from "lucide-react";
import { resetFollows } from "../lib/follows";
import { CompetitorLink, EventLink, GameLink, MatchLink } from "../components/links";
import { Mark } from "../components/mark";
import { FollowButton, Section } from "../components/ui";
import { followStatus, followTarget } from "../lib/view";
import { useAtlas, useMinute, useWorld } from "../lib/world";

export function FollowingPage() {
  const atlas = useAtlas();
  const world = useWorld();
  const now = useMinute();
  const follows = atlas.world.follows;
  const suggestions: Follow[] = [
    { kind: "team", id: "cs2-spirit" },
    { kind: "team", id: "cs2-mongolz" },
    { kind: "team", id: "lol-geng" },
    { kind: "player", id: "chess-gukesh" },
    { kind: "player", id: "tm-bren" },
    { kind: "team", id: "rl-kc" },
    { kind: "tournament", id: "cs2-copenhagen-masters-2026" },
    { kind: "discipline", id: "chess" },
  ].filter((s) => !follows.some((f) => f.kind === s.kind && f.id === s.id)) as Follow[];

  return (
    <div className="space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="ui-kicker">Following</div>
          <h1 className="ui-h1 mt-2 !text-[44px] sm:!text-[64px]">What you follow</h1>
          <p className="mt-3 max-w-[560px] text-[15px] text-muted">
            Everything here shapes your Now page and schedule. Following an organisation covers all
            its teams; following an event covers every match in it.
          </p>
        </div>
        <button type="button" className="ui-btn" onClick={() => resetFollows(world.follows)}>
          <RotateCcw className="size-4" /> Reset to sample
        </button>
      </header>
      <Section kicker={`${follows.length} followed`} title="Your list">
        {follows.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {follows.map((f) => (
              <Row key={`${f.kind}-${f.id}`} f={f} now={now} />
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-muted">Nothing yet. Pick something below.</p>
        )}
      </Section>
      <Section kicker="Suggestions" title="You might also follow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {suggestions.map((f) => (
            <Row key={`${f.kind}-${f.id}`} f={f} now={now} compact />
          ))}
        </div>
      </Section>
    </div>
  );
}

function Row({ f, now, compact = false }: { f: Follow; now: number; compact?: boolean }) {
  const atlas = useAtlas();
  const target = followTarget(atlas, f);
  const st = followStatus(atlas, f, now);
  const title =
    f.kind === "team" || f.kind === "player" ? (
      <CompetitorLink id={f.id} className="hover:text-accent">
        {target.name}
      </CompetitorLink>
    ) : f.kind === "tournament" ? (
      <EventLink id={f.id} className="hover:text-accent">
        {target.name}
      </EventLink>
    ) : f.kind === "discipline" ? (
      <GameLink id={f.id} className="hover:text-accent">
        {target.name}
      </GameLink>
    ) : (
      target.name
    );
  return (
    <div className={`ui-card flex gap-4 p-4 ${compact ? "flex-col" : "items-center"}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {f.kind === "team" || f.kind === "player" ? (
          <Mark id={f.id} size={44} />
        ) : (
          <span
            className="grid size-11 shrink-0 place-items-center rounded-[12px] text-[12px] font-bold"
            style={{ background: target.colors.primary, color: target.colors.secondary }}
          >
            {target.name
              .replace(/^Team /, "")
              .slice(0, 3)
              .toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="ui-h3 truncate">{title}</div>
          <div className="truncate text-[12.5px] text-muted">{target.sub}</div>
          {!compact &&
            (st.matchId ? (
              <MatchLink
                id={st.matchId}
                className={`mt-1 block truncate text-[12.5px] font-medium ${st.state === "live" ? "text-live" : st.state === "out" ? "text-loss" : "text-ink"} hover:underline`}
              >
                {st.state === "live" ? "● " : ""}
                {st.line}
              </MatchLink>
            ) : (
              <div className="mt-1 text-[12.5px] text-faint">{st.line}</div>
            ))}
        </div>
      </div>
      <FollowButton follow={f} compact />
    </div>
  );
}
