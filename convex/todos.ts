import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const docs = await ctx.db
      .query("todos")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return docs
      .map((d) => ({ id: d._id, ...d }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
});

export const get = query({
  args: { id: v.id("todos") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) return null;
    return { id: doc._id, ...doc };
  },
});

export const create = mutation({
  args: {
    text: v.string(),
    done: v.optional(v.boolean()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = new Date().toISOString();
    const id = await ctx.db.insert("todos", {
      userId,
      text: args.text.trim(),
      done: args.done ?? false,
      dueDate: args.dueDate,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return doc ? { id: doc._id, ...doc } : null;
  },
});

export const update = mutation({
  args: {
    id: v.id("todos"),
    text: v.optional(v.string()),
    done: v.optional(v.boolean()),
    dueDate: v.optional(v.string()),
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
  args: { id: v.id("todos") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});
