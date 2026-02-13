import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const list = query({
  args: { contactId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    let docs = await ctx.db
      .query("dossiers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    if (args.contactId) docs = docs.filter((d) => d.contactId === args.contactId);
    docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return docs.map((d) => ({ id: d._id, ...d }));
  },
});

export const create = mutation({
  args: {
    contactId: v.string(),
    eventId: v.optional(v.string()),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    actionItems: v.optional(v.array(v.string())),
    recordingUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = new Date().toISOString();
    const id = await ctx.db.insert("dossiers", {
      userId,
      contactId: args.contactId.trim(),
      ...(args.eventId && { eventId: args.eventId }),
      ...(args.transcript && { transcript: args.transcript }),
      ...(args.summary && { summary: args.summary }),
      ...(args.actionItems && { actionItems: args.actionItems }),
      ...(args.recordingUrl && { recordingUrl: args.recordingUrl }),
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return doc ? { id: doc._id, ...doc } : null;
  },
});

export const update = mutation({
  args: {
    id: v.id("dossiers"),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    actionItems: v.optional(v.array(v.string())),
    recordingUrl: v.optional(v.string()),
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
