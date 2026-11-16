// Prints the narrative the sample world tells, for quick review.
import {
  Atlas,
  roundRobinStandings,
  seriesScore,
  swissRecords,
  formatPoints,
} from "../src/index.ts";
import { buildSampleWorld } from "../src/sample/index.ts";

const atlas = new Atlas(buildSampleWorld());
const cs = atlas.tournament("cs2-copenhagen-masters-2026")!;
console.log(
  "Swiss:",
  swissRecords(atlas, cs.stages[0]!, cs.participantIds)
    .map((r) => `${atlas.short(r.competitorId)} ${r.wins}-${r.losses}`)
    .join(", "),
);
for (const round of cs.stages[1]!.rounds)
  for (const id of round.matchIds) {
    const m = atlas.match(id)!;
    console.log(
      round.short,
      m.status,
      m.sides
        .map((s) => atlas.short(s.competitorId) + (s.placeholder ? `(${s.placeholder})` : ""))
        .join(" v "),
      seriesScore(m).join("-"),
      m.games.map((g) => `${g.label}:${g.scores?.join("-") ?? g.status}`).join(" "),
    );
  }
const lol = atlas.tournament("lol-rift-invitational-2026")!;
for (const m of atlas.matchesOf(lol.id))
  console.log(
    "LoL",
    m.roundId,
    m.sides.map((s) => atlas.short(s.competitorId)).join(" v "),
    seriesScore(m).join("-"),
  );
const ch = atlas.tournament("chess-fall-classic-2026")!;
console.log(
  "Chess:",
  roundRobinStandings(atlas, ch.stages[0]!, ch.participantIds)
    .map((s) => `${s.rank}. ${atlas.short(s.competitorId)} ${formatPoints(s.points)}`)
    .join(", "),
);
console.log(
  "Live:",
  atlas
    .live()
    .map((m) => m.id)
    .join(", "),
);
console.log(
  "Followed upcoming:",
  atlas
    .upcoming()
    .filter((m) => atlas.isFollowed(m))
    .map((m) => m.id)
    .join(", "),
);
