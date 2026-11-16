import { isTeam } from "@bearing/domain/leaguepedia";
import {
  type ValveStanding,
  likelyStandings,
  readStandings,
  standingsUrl,
} from "@bearing/domain/valve";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { ranking } from "./validators";

/**
 * Counter-Strike's world ranking, from the repository Valve publishes it to about once a month.
 * It asks for no key. Looked at once a day: two small requests when nothing is new, four when a
 * new ranking is out.
 */

const AGENT = { "User-Agent": "Bearing (esports schedule viewer)" };
/** How far down the ranking is kept. */
const DEPTH = 60;

/** The Counter-Strike teams the store has, and the day of the ranking it holds. */
export const state = internalQuery({
  args: {},
  returns: v.object({
    title: v.optional(v.string()),
    teams: v.array(v.object({ id: v.string(), name: v.string(), short: v.string() })),
  }),
  handler: async (ctx) => {
    const rankings = await ctx.db.query("rankings").take(100);
    const teams = (await ctx.db.query("competitors").take(8000)).flatMap((row) =>
      row.doc.kind === "team" && row.doc.discipline === "cs2"
        ? [{ id: row.doc.id, name: row.doc.name, short: row.doc.short }]
        : [],
    );
    return { title: rankings.find((r) => r.doc.discipline === "cs2")?.doc.title, teams };
  },
});

export const put = internalMutation({
  args: { doc: ranking },
  returns: v.null(),
  handler: async (ctx, { doc }) => {
    const rows = await ctx.db.query("rankings").take(100);
    const row = rows.find((r) => r.doc.discipline === doc.discipline);
    // Written only when it says something new: every write wakes the screens that read it.
    if (row && JSON.stringify(row.doc) === JSON.stringify(doc)) return null;
    if (row) await ctx.db.replace("rankings", row._id, { doc });
    else await ctx.db.insert("rankings", { doc });
    return null;
  },
});

export const sync = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!(await ctx.runQuery(internal.ingest.enabled, {}))) return null;
    const table = async (year: number, file: string) =>
      readStandings(
        await fetch(standingsUrl(year, file), { headers: AGENT })
          .then((r) => (r.ok ? r.text() : ""))
          .catch(() => ""),
      );
    // The latest ranking that is there, and the one before it for who rose and who fell.
    const found: { date: string; rows: ValveStanding[] }[] = [];
    for (const likely of likelyStandings(Date.now())) {
      const rows = await table(likely.year, likely.file);
      if (rows.length) found.push({ date: likely.date, rows });
      if (found.length === 2) break;
    }
    const latest = found[0];
    if (!latest) return null;
    const title = `Valve world ranking · ${latest.date}`;
    const { teams } = await ctx.runQuery(internal.valve.state, {});
    const now = latest.rows;
    const was = new Map((found[1]?.rows ?? []).map((row) => [row.team, row.rank]));
    await ctx.runMutation(internal.valve.put, {
      doc: {
        discipline: "cs2",
        title,
        entries: now.slice(0, DEPTH).map((row) => ({
          competitorId: teams.find((t) => isTeam(row.team, t))?.id ?? "",
          name: row.team,
          rank: row.rank,
          points: row.points,
          // Places gained since the ranking before; a team new to it has gained none.
          change: (was.get(row.team) ?? row.rank) - row.rank,
        })),
      },
    });
    return null;
  },
});
