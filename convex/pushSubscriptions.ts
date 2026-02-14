import { v } from "convex/values";
import { internalQuery, mutation } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const set = mutation({
  args: {
    endpoint: v.string(),
    subscription: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { subscription: args.subscription, updatedAt: now });
      return { ok: true };
    }
    await ctx.db.insert("pushSubscriptions", {
      userId,
      endpoint: args.endpoint,
      subscription: args.subscription,
      updatedAt: now,
    });
    return { ok: true };
  },
});

/** For reminders: get all push subscriptions for a user. */
export const listByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});
