import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const docs = await ctx.db
      .query("tripNotes")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return docs.map((d) => ({ id: d._id, ...d }));
  },
});

export const create = mutation({
  args: {
    content: v.string(),
    contactIds: v.optional(v.array(v.string())),
    eventIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = new Date().toISOString();
    const id = await ctx.db.insert("tripNotes", {
      userId,
      content: args.content.trim(),
      contactIds: args.contactIds?.length ? args.contactIds : undefined,
      eventIds: args.eventIds?.length ? args.eventIds : undefined,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return doc ? { id: doc._id, ...doc } : null;
  },
});

export const update = mutation({
  args: {
    id: v.id("tripNotes"),
    content: v.optional(v.string()),
    contactIds: v.optional(v.array(v.string())),
    eventIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) return null;
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      updatedAt: now,
      ...(args.content !== undefined && { content: args.content.trim() }),
      ...(args.contactIds !== undefined && { contactIds: args.contactIds?.length ? args.contactIds : undefined }),
      ...(args.eventIds !== undefined && { eventIds: args.eventIds?.length ? args.eventIds : undefined }),
    };
    await ctx.db.patch(args.id, updates);
    return (await ctx.db.get(args.id))!;
  },
});

export const remove = mutation({
  args: { id: v.id("tripNotes") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) return null;
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});
