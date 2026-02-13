import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const docs = await ctx.db
      .query("contacts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return docs
      .map((d) => ({ id: d._id, ...d }))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  },
});

export const get = query({
  args: { id: v.id("contacts") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) return null;
    return { id: doc._id, ...doc };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    company: v.optional(v.string()),
    role: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    stockTicker: v.optional(v.string()),
    notes: v.optional(v.string()),
    eventIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = new Date().toISOString();
    const id = await ctx.db.insert("contacts", {
      userId,
      name: args.name.trim(),
      company: args.company?.trim(),
      role: args.role?.trim(),
      phone: args.phone?.trim(),
      email: args.email?.trim(),
      stockTicker: args.stockTicker?.trim(),
      notes: args.notes?.trim(),
      eventIds: args.eventIds ?? [],
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return doc ? { id: doc._id, ...doc } : null;
  },
});

export const update = mutation({
  args: {
    id: v.id("contacts"),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    role: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    stockTicker: v.optional(v.string()),
    notes: v.optional(v.string()),
    eventIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const { id, ...rest } = args;
    const updates: Record<string, unknown> = { ...rest, updatedAt: new Date().toISOString() };
    if (updates.name !== undefined) updates.name = String(updates.name).trim();
    await ctx.db.patch(args.id, updates);
    const updated = await ctx.db.get(args.id);
    return updated ? { id: updated._id, ...updated } : null;
  },
});

export const remove = mutation({
  args: { id: v.id("contacts") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});
