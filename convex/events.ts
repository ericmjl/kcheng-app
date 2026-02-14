import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const docs = await ctx.db
      .query("events")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    docs.sort((a, b) => a.start.localeCompare(b.start));
    return docs.map((d) => ({ id: d._id, ...d }));
  },
});

export const get = query({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) return null;
    return { id: doc._id, ...doc };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    start: v.string(),
    end: v.optional(v.string()),
    location: v.optional(v.string()),
    contactIds: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = new Date().toISOString();
    const id = await ctx.db.insert("events", {
      userId,
      title: args.title,
      start: args.start,
      ...(args.end && { end: args.end }),
      ...(args.location && { location: args.location }),
      ...(args.contactIds?.length && { contactIds: args.contactIds }),
      ...(args.notes && { notes: args.notes }),
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return doc ? { id: doc._id, ...doc } : null;
  },
});

export const update = mutation({
  args: {
    id: v.id("events"),
    title: v.optional(v.string()),
    start: v.optional(v.string()),
    end: v.optional(v.string()),
    location: v.optional(v.string()),
    contactIds: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const { id, ...rest } = args;
    await ctx.db.patch(args.id, { ...rest, updatedAt: new Date().toISOString() });
    const updated = await ctx.db.get(args.id);
    return updated ? { id: updated._id, ...updated } : null;
  },
});

export const remove = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

/** For reminders cron: events starting in [startAfter, startBefore] that haven't had a reminder sent. */
export const listUpcomingForReminders = internalQuery({
  args: {
    startAfter: v.string(),
    startBefore: v.string(),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("events")
      .withIndex("by_start", (q) =>
        q.gte("start", args.startAfter).lte("start", args.startBefore)
      )
      .collect();
    return docs
      .filter((d) => !d.reminderSentAt)
      .map((d) => ({ id: d._id, userId: d.userId, title: d.title, start: d.start, location: d.location }));
  },
});

/** Mark that we sent a push reminder for this event. */
export const markReminderSent = internalMutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    await ctx.db.patch(args.id, { reminderSentAt: now, updatedAt: now });
  },
});
