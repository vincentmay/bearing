import { type Atlas, type Match, clock, ms, relative } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { featuredLive, recentForYou, scoreLine } from "../lib/view";
import { useAtlas, useMinute } from "../lib/world";
import { type MatchView, summarize } from "./model";
import { Disc, Dots, Duo, Mark, Ping, Section } from "./ui";

const SIX_HOURS = 6 * 60 * 60 * 1000;

/** The one box on the screen: the live match, or the next one when nothing is live. */
export function LeadCard({ view, now }: { view: MatchView; now: number }) {
  const [a, b] = view.sides;
  const meta = `${view.discipline.short} · ${view.event}`;
  return (
    <Link to="/match/$matchId" params={{ matchId: view.match.id }} className="bx-card">
      <div className="bx-row bx-btw bx-meta">
        <span>
          {view.live ? <Ping /> : null}
          {view.status}
        </span>
        <span>{meta}</span>
      </div>
      {view.solo || !a || !b ? (
        <div className="bx-versus">
          <span>
            <b className="bx-name">{view.event}</b>
          </span>
          <span className="bx-score bx-num">{view.headline[0]}</span>
          <span />
        </div>
      ) : (
        <div className="bx-versus">
          <span>
            <Disc side={a} size={24} />
            <b className="bx-name">{a.name}</b>
          </span>
          <span className="bx-score bx-num">
            {view.match.status === "scheduled" ? (
              clock(view.match.scheduledAt, true)
            ) : (
              <>
                {view.headline[0]}
                <i />
                {view.headline[1]}
              </>
            )}
          </span>
          <span>
            <b className="bx-name">{b.name}</b>
            <Disc side={b} size={24} />
          </span>
        </div>
      )}
      <div className="bx-subs">
        {view.match.status === "scheduled" ? (
          <>
            <span />
            <span>{relative(view.match.scheduledAt, now)}</span>
            <span />
          </>
        ) : (
          view.subs.map((s, i) => <span key={i}>{s}</span>)
        )}
      </div>
      <Dots rows={view.rows} sides={view.sides} center />
    </Link>
  );
}

function title(view: MatchView): string {
  if (view.solo) return view.event;
  return view.sides.map((s) => s.name).join(" v ");
}

function NextRow({ view, now }: { view: MatchView; now: number }) {
  const wait = ms(view.match.scheduledAt) - now;
  return (
    <Link to="/match/$matchId" params={{ matchId: view.match.id }} className="bx-next">
      <Duo sides={view.sides} progress={1 - wait / SIX_HOURS} />
      <span className="bx-mono bx-num">{clock(view.match.scheduledAt, true)}</span>
      <span>
        <b>{title(view)}</b>
        <span className="bx-sub">
          {view.discipline.short} · {view.solo ? view.where : view.event}
        </span>
      </span>
      <span className="bx-sub bx-mono">
        {relative(view.match.scheduledAt, now).replace("in ", "")}
      </span>
    </Link>
  );
}

function ResultRow({ view }: { view: MatchView }) {
  return (
    <Link to="/match/$matchId" params={{ matchId: view.match.id }} className="bx-result">
      <span>
        <b>
          {view.solo
            ? `${view.event} · ${view.standings[0]?.side.name ?? ""} ${view.live ? "leads" : "won"}`
            : `${view.sides[0]?.name ?? ""} ${scoreLine(view.match)} ${view.sides[1]?.name ?? ""}`}
        </b>
        <span className="bx-sub">
          {view.discipline.short} · {view.event}
        </span>
      </span>
      <Dots rows={view.rows} sides={view.sides} size={11} />
    </Link>
  );
}

/** Followed results first, topped up with the latest others. */
function earlier(atlas: Atlas, limit: number): Match[] {
  const mine = recentForYou(atlas, limit);
  const rest = atlas.recent().filter((m) => !mine.includes(m));
  return [...mine, ...rest].slice(0, limit);
}

export function Today() {
  const atlas = useAtlas();
  const now = useMinute();
  const featured = featuredLive(atlas);
  const upcoming = atlas.upcoming().filter((m) => m.sides.every((s) => s.competitorId));
  const lead = featured ?? upcoming[0];
  const alsoLive = atlas.live().filter((m) => m.id !== lead?.id);
  const next = upcoming.filter((m) => m.id !== lead?.id).slice(0, 5);
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now);

  return (
    <>
      <header className="bx-head">
        <span>
          <Mark />
          <h1 className="bx-title">Today</h1>
        </span>
        <span className="bx-mono bx-sub" style={{ textTransform: "uppercase" }}>
          {date}
        </span>
      </header>

      {lead ? (
        <LeadCard view={summarize(atlas, lead, now)} now={now} />
      ) : (
        <p className="bx-empty">Nothing is scheduled for anything you follow.</p>
      )}

      {alsoLive.length ? (
        <Section label="Also live">
          <div className="bx-list">
            {alsoLive.map((m) => (
              <ResultRow key={m.id} view={summarize(atlas, m, now)} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section label="Next">
        <div className="bx-list">
          {next.map((m) => (
            <NextRow key={m.id} view={summarize(atlas, m, now)} now={now} />
          ))}
        </div>
      </Section>

      <Section label="Earlier">
        <div className="bx-list">
          {earlier(atlas, 5).map((m) => (
            <ResultRow key={m.id} view={summarize(atlas, m, now)} />
          ))}
        </div>
      </Section>
    </>
  );
}
