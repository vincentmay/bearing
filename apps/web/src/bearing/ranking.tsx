import type { Ranking } from "@bearing/domain";
import { type Board, useBoard } from "./board";
import { Back, Go } from "./links";
import { plainName, sideOf } from "./model";
import { Disc, Problem } from "./ui";

/** A ranking's name with its day written the way every day in Bearing is. */
export function rankingTitle(ranking: Ranking, board: Board): string {
  return ranking.title.replace(/\d{4}-\d{2}-\d{2}$/, (day) => {
    const at = `${day}T12:00:00Z`;
    return `${board.times.date(at)} ${day.slice(0, 4)}`;
  });
}

/** The places of a ranking, as many as asked for: the number, who, places gained, points. */
export function RankingRows({
  ranking,
  board,
  limit,
}: {
  ranking: Ranking;
  board: Board;
  limit?: number;
}) {
  const { atlas } = board;
  return (
    <div className="bx-list">
      {ranking.entries.slice(0, limit).map((e, i) => {
        const known = e.competitorId ? atlas.competitor(e.competitorId) : undefined;
        const body = (
          <>
            <span className="bx-rank-n bx-num">{e.rank ?? i + 1}</span>
            <span className="bx-who">
              {known ? (
                <Disc side={sideOf(atlas, known.id)} size={24} />
              ) : (
                <span className="bx-disc bx-disc-plain" style={{ "--s": "24px" } as never} />
              )}
              <b>{known ? plainName(atlas, known.id) : e.name}</b>
            </span>
            <span
              className="bx-rank-move bx-num"
              data-up={e.change > 0 ? "" : undefined}
              data-down={e.change < 0 ? "" : undefined}
            >
              {e.change > 0 ? `▲ ${e.change}` : e.change < 0 ? `▼ ${-e.change}` : ""}
            </span>
            <span className="bx-sub bx-mono bx-num">{e.points}</span>
          </>
        );
        const key = e.competitorId || e.name || i;
        return known ? (
          <Go key={key} to={{ kind: "team", id: known.id }} className="bx-line bx-rank">
            {body}
          </Go>
        ) : (
          <div key={key} className="bx-line bx-rank">
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** A game's whole ranking, as far down as the source is kept. */
export function RankingPage({ discipline }: { discipline: string }) {
  const board = useBoard();
  const ranking = board.atlas.world.rankings.find((r) => r.discipline === discipline);
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
  return (
    <>
      <Back />
      <header className="bx-entity">
        <div>
          <p className="bx-label">{board.atlas.discipline(ranking.discipline).name}</p>
          <h1 className="bx-display">World ranking</h1>
          <p className="bx-sub" style={{ margin: "8px 0 0", fontSize: 13 }}>
            {rankingTitle(ranking, board)} · {ranking.entries.length} teams
          </p>
        </div>
      </header>
      <div className="bx-page-narrow" style={{ margin: "22px 0 0" }}>
        <RankingRows ranking={ranking} board={board} />
      </div>
    </>
  );
}
