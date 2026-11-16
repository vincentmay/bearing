import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Schedules are at most an hour old. The job does nothing while the deployment is on sample data.
crons.interval("lichess broadcasts", { hours: 1 }, internal.lichess.sync, {});

export default crons;
