import { type Competitor, type Follow, clock, dayKey, form } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { Search as SearchIcon, Star } from "lucide-react";
import { useState } from "react";
import { scoreLine } from "../lib/view";
import { useAtlas, useFollow, useMinute } from "../lib/world";
import { type SideView, inkOn, summarize } from "./model";
import { Disc, Dots, Duo, Section } from "./ui";

const DAY = 24 * 60 * 60 * 1000;

/** Five days from today; the selected one is a filled circle, the only shape on the screen besides the navigation. */
export function Schedule() {
  const atlas = useAtlas();
  const now = useMinute();
  const days = Array.from({ length: 5 }, (_, i) => now + i * DAY);
  const [selected, setSelected] = useState(0);
  const key = dayKey(days[selected] ?? now);
  const matches = atlas.world.matches
    .filter((m) => dayKey(m.scheduledAt) === key)
    .sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt));
  const month = new Intl.DateTimeFormat(undefined, { month: "long" }).format(days[selected] ?? now);

  return (
    <>
      <header className="bx-head">
        <h1 className="bx-title">Schedule</h1>
        <span className="bx-mono bx-sub" style={{ textTransform: "uppercase" }}>
          {month}
        </span>
      </header>
      <div className="bx-days">
        {days.map((day, i) => (
          <button
            key={day}
            type="button"
            className={i === selected ? "bx-on" : undefined}
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
          >
            {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day)}
            <b>{new Date(day).getDate()}</b>
          </button>
        ))}
      </div>
      <Section label={`${matches.length} ${matches.length === 1 ? "match" : "matches"}`}>
        <div className="bx-list">
          {matches.map((m) => {
            const view = summarize(atlas, m, now);
            return (
              <Link key={m.id} to="/match/$matchId" params={{ matchId: m.id }} className="bx-next">
                <Duo sides={view.sides} progress={m.status === "scheduled" ? 0 : 1} />
                <span className="bx-mono bx-num">{clock(m.scheduledAt, true)}</span>
                <span>
                  <b>{view.solo ? view.event : view.sides.map((s) => s.name).join(" v ")}</b>
                  <span className="bx-sub">
                    {view.discipline.short} · {view.solo ? view.where : view.event}
                  </span>
                </span>
                <span className="bx-sub bx-mono">
                  {m.status === "live"
                    ? "LIVE"
                    : m.status === "finished" && !view.solo
                      ? scoreLine(m)
                      : ""}
                </span>
              </Link>
            );
          })}
        </div>
        {matches.length ? null : <p className="bx-empty">Nothing on this day.</p>}
      </Section>
    </>
  );
}

function FollowStar({ follow, name }: { follow: Follow; name: string }) {
  const atlas = useAtlas();
  const [direct, toggle] = useFollow(follow);
  // Followed through something wider, such as the organisation: shown as followed, changed there.
  const inherited = !direct && atlas.followsCompetitor(follow.id);
  const on = direct || inherited;
  return (
    <button
      type="button"
      className="bx-star"
      aria-pressed={on}
      aria-label={on ? `Stop following ${name}` : `Follow ${name}`}
      title={inherited ? "Followed through its organisation" : undefined}
      disabled={inherited}
      onClick={toggle}
    >
      <Star size={17} />
    </button>
  );
}

function CompetitorRow({ competitor }: { competitor: Competitor }) {
  const atlas = useAtlas();
  const name = atlas.name(competitor.id);
  const color =
    competitor.discipline === "chess" ? "var(--ink)" : atlas.colors(competitor.id).primary;
  const side: SideView = { id: competitor.id, name, short: "", color, ink: inkOn(color) };
  // Last five: a filled dot is a win, an open one a loss, a shared one a draw.
  const last = form(atlas, competitor.id).map((r) =>
    r === "W"
      ? ({ k: "won", side: 0, label: "Won" } as const)
      : r === "D"
        ? ({ k: "shared", label: "Draw" } as const)
        : ({ k: "open" } as const),
  );
  return (
    <div className="bx-result">
      <span className="bx-row" style={{ gap: 10, minWidth: 0 }}>
        <Disc side={side} size={26} />
        <span style={{ minWidth: 0 }}>
          <b>{name}</b>
          <span className="bx-sub">{atlas.discipline(competitor.discipline).name}</span>
        </span>
      </span>
      <span className="bx-row" style={{ gap: 8 }}>
        <Dots rows={[last]} sides={[side, { ...side, color: "var(--surface)" }]} size={9} />
        <FollowStar follow={{ kind: competitor.kind, id: competitor.id }} name={name} />
      </span>
    </div>
  );
}

export function Following() {
  const atlas = useAtlas();
  const followed = atlas.world.competitors.filter((c) => atlas.followsCompetitor(c.id));
  return (
    <>
      <header className="bx-head">
        <h1 className="bx-title">Following</h1>
        <span className="bx-mono bx-sub">LAST FIVE</span>
      </header>
      <Section label={`${followed.length} teams and players`}>
        <div className="bx-list">
          {followed.map((c) => (
            <CompetitorRow key={c.id} competitor={c} />
          ))}
        </div>
        {followed.length ? null : (
          <p className="bx-empty">
            You are not following anyone yet. Use search to find a team or player.
          </p>
        )}
      </Section>
    </>
  );
}

export function Search() {
  const atlas = useAtlas();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const hits = atlas.world.competitors
    .filter((c) => {
      if (!q) return atlas.followsCompetitor(c.id);
      const text = `${atlas.name(c.id)} ${atlas.discipline(c.discipline).name}`.toLowerCase();
      return text.includes(q);
    })
    .slice(0, 8);
  return (
    <>
      <header className="bx-head">
        <h1 className="bx-title">Search</h1>
      </header>
      <label className="bx-field">
        <SearchIcon size={16} />
        <input
          type="text"
          placeholder="Team or player"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <Section
        label={q ? `${hits.length} ${hits.length === 1 ? "result" : "results"}` : "Following"}
      >
        <div className="bx-list">
          {hits.map((c) => (
            <CompetitorRow key={c.id} competitor={c} />
          ))}
        </div>
        {hits.length ? null : <p className="bx-empty">Nothing found for "{query}".</p>}
      </Section>
    </>
  );
}
