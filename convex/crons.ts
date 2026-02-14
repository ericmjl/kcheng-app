import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Event reminders: run every 15 minutes; sends push for events starting in ~30 min
crons.interval(
  "event-reminders",
  { minutes: 15 },
  internal.reminders.sendEventReminders
);

export default crons;
