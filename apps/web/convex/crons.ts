import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// All of these do nothing while the deployment is on sample data.

// Schedules are at most an hour old.
crons.interval("lichess broadcasts", { hours: 1 }, internal.lichess.sync, {});
crons.interval("pandascore", { hours: 1 }, internal.pandascore.syncAll, {});

// Finished League games that still lack what happened in them are filled in.
crons.interval("league detail", { minutes: 30 }, internal.lolesports.enrich, {});

// And the draft and every player's line of those games, once the wiki has them.
crons.interval("league lines", { hours: 6 }, internal.leaguepedia.enrich, {});

// A live match is at most thirty seconds behind: once a minute, if anything is on or due, the
// sources are asked now and again half a minute later.
crons.interval("live", { minutes: 1 }, internal.ingest.tick, {});

// League events that are over get their final places and what each paid, once each.
crons.interval("league places", { hours: 24 }, internal.leaguepedia.places, {});

// How two teams about to meet have done against each other before.
crons.interval("head to head", { hours: 3 }, internal.meetings.sync, {});

// Counter-Strike's world ranking, which Valve publishes about once a month.
crons.interval("valve ranking", { hours: 24 }, internal.valve.sync, {});

// Chess players new to the store are looked up for a picture, once each.
crons.interval("chess faces", { hours: 24 }, internal.lichess.faces, {});

// What is long over is removed once a day.
crons.interval("retention", { hours: 24 }, internal.retention.prune, {});

export default crons;
