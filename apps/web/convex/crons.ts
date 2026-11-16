import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Schedules are at most an hour old. The job does nothing while the deployment is on sample data.
crons.interval("lichess broadcasts", { hours: 1 }, internal.lichess.sync, {});

// What is long over is removed once a day. Does nothing on sample data.
crons.interval("retention", { hours: 24 }, internal.retention.prune, {});

export default crons;
