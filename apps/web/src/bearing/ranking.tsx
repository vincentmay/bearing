import "./pages-event.css";
import type { Ranking } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { CSSProperties } from "react";
import { type Board, useBoard } from "./board";
import { Back, Go } from "./links";
import { plainName, sideOf } from "./model";
import { CardSky } from "./sky";
import { Disc, Problem, TopCard } from "./ui";

/** A ranking's name with its day written the way every day in Bearing is. */
export function rankingTitle(ranking: Ranking, board: Board): string {
  return ranking.title.replace(/\d{4}-\d{2}-\d{2}$/, (day) => {
    const at = `${day}T12:00:00Z`;
    return `${board.times.date(at)} ${day.slice(0, 4)}`;
  });
}

type Entry = Ranking["entries"][number];

/** Places gained or lost since the last time: up in the accent, down quietly. */
function Move({ change }: { change: number }) {
  if (!change) return <span className="bx-mv" />;
  return (
    <span
      className="bx-mv"
      data-up={change > 0 ? "" : undefined}
      aria-label={change > 0 ? `up ${change}` : `down ${-change}`}
    >
      {change > 0 ? `▲ ${change}` : `▼ ${-change}`}
    </span>
  );
}

/** Who holds a place: their mark, or a plain disc for someone Kiming does not know. */
function Who({ entry, board, size }: { entry: Entry; board: Board; size: number }) {
  const known = entry.competitorId ? board.atlas.competitor(entry.competitorId) : undefined;
  return known ? (
    <Disc side={sideOf(board.atlas, known.id)} size={size} />
  ) : (
    <span className="bx-disc bx-disc-plain" style={{ "--s": `${size}px` } as CSSProperties} />
  );
}

/** The places of a ranking, as many as asked for: the number, who, places gained, points. */
export function RankingRows({
  ranking,
  board,
  limit,
  from = 0,
}: {
  ranking: Ranking;
  board: Board;
  limit?: number;
  /** Leave out the places before this one: they are shown another way. */
  from?: number;
}) {
  const { atlas } = board;
  return (
    <div className="bx-panel bx-rkl">
      {ranking.entries.slice(from, limit).map((e, at) => {
        const i = at + from;
        const known = e.competitorId ? atlas.competitor(e.competitorId) : undefined;
        const body = (
          <>
            <span className="bx-rkl-n">{e.rank ?? i + 1}</span>
            <Who entry={e} board={board} size={30} />
            <b>{known ? plainName(atlas, known.id) : e.name}</b>
            <Move change={e.change} />
            <span className="bx-rkl-pts">{e.points.toLocaleString("en")}</span>
          </>
        );
        const key = e.competitorId || e.name || i;
        return known ? (
          <Go key={key} to={{ kind: known.kind, id: known.id }} className="bx-rkl-row">
            {body}
          </Go>
        ) : (
          <div key={key} className="bx-rkl-row">
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** One of the first three: the place as a large figure, who, their points and their movement. */
function Podium({ entry, place, board }: { entry: Entry; place: number; board: Board }) {
  const { atlas } = board;
  const known = entry.competitorId ? atlas.competitor(entry.competitorId) : undefined;
  const body = (
    <>
      <span className="bx-pc-n">{entry.rank ?? place}</span>
      <span className="bx-pc-w">
        <Who entry={entry} board={board} size={36} />
        <b>{known ? plainName(atlas, known.id) : entry.name}</b>
        {known && atlas.followsCompetitor(known.id) ? (
          <Star size={16} className="bx-starred" aria-label="You follow this" />
        ) : null}
      </span>
      <span className="bx-pc-p">
        {entry.points.toLocaleString("en")} points
        <Move change={entry.change} />
      </span>
    </>
  );
  return known ? (
    <Go to={{ kind: known.kind, id: known.id }} className="bx-pc" data-n={place}>
      {body}
    </Go>
  ) : (
    <div className="bx-pc" data-n={place}>
      {body}
    </div>
  );
}

/** A game's whole ranking, as far down as the source is kept. */
export function RankingPage({ discipline }: { discipline: string }) {
  const board = useBoard();
  const { atlas } = board;
  const ranking = atlas.world.rankings.find((r) => r.discipline === discipline);
  if (!ranking?.entries.length) {
    return (
      <>
        <Back />
        <Problem title="There is no ranking for this game.">
          Kiming has a ranking only where the game's own makers publish one.
        </Problem>
      </>
    );
  }
  const d = atlas.discipline(ranking.discipline);
  const who = d.competitor === "team" ? "teams" : "players";
  const all = atlas.world.rankings.filter((r) => r.entries.length);
  const top = ranking.entries.slice(0, 3);
  const mine = ranking.entries
    .map((e, i) => ({ e, place: e.rank ?? i + 1 }))
    .filter(({ e }) => e.competitorId && atlas.followsCompetitor(e.competitorId));
  return (
    <>
      <Back />
      <TopCard className="bx-stage">
        <CardSky />
        <div className="bx-ent-in">
          <div className="bx-eh">
            <div>
              <h1>World ranking</h1>
              <p>
                {d.name} · {rankingTitle(ranking, board)}
              </p>
            </div>
          </div>
          {all.length > 1 ? (
            <nav className="bx-picks bx-e-picks" aria-label="Rankings">
              {all.map((r) => (
                <Link
                  key={r.discipline}
                  to="/ranking/$discipline"
                  params={{ discipline: r.discipline }}
                  replace
                  aria-current={r.discipline === ranking.discipline ? "page" : undefined}
                >
                  <small>{r.title.replace(/\s*\d{4}-\d{2}-\d{2}$/, "")}</small>
                  {atlas.discipline(r.discipline).name}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </TopCard>
      <div className="bx-e-cols">
        <div>
          <h2 className="bx-h2">The top three</h2>
          <div className="bx-pod">
            {top.map((e, i) => (
              <Podium key={e.competitorId || e.name || i} entry={e} place={i + 1} board={board} />
            ))}
          </div>
          {ranking.entries.length > 3 ? (
            <>
              <h2 className="bx-h2">
                4 to {ranking.entries.length}
                <small>
                  of {ranking.entries.length} {who}
                </small>
              </h2>
              <RankingRows ranking={ranking} board={board} from={3} />
            </>
          ) : null}
        </div>
        <div>
          {mine.length ? (
            <>
              <h2 className="bx-h2">Yours</h2>
              <div className="bx-panel">
                {mine.map(({ e, place }) => (
                  <Go
                    key={e.competitorId}
                    to={{
                      kind: atlas.competitor(e.competitorId)?.kind ?? "team",
                      id: e.competitorId,
                    }}
                    className="bx-e-lgo"
                  >
                    <div className="bx-e-li">
                      <Who entry={e} board={board} size={30} />
                      <div>
                        <b>{plainName(atlas, e.competitorId)}</b>
                        <span>
                          {e.points.toLocaleString("en")} points
                          {e.change > 0
                            ? ` · up ${e.change}`
                            : e.change < 0
                              ? ` · down ${-e.change}`
                              : ""}
                        </span>
                      </div>
                      <em>#{place}</em>
                    </div>
                  </Go>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
