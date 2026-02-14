import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

const defaults = {
  tripStart: "",
  tripEnd: "",
  timezone: "Asia/Shanghai",
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    return doc
      ? { ...defaults, ...doc }
      : { ...defaults, userId, apiKeys: undefined, savedPlaces: undefined };
  },
});

export const set = mutation({
  args: {
    tripStart: v.optional(v.string()),
    tripEnd: v.optional(v.string()),
    timezone: v.optional(v.string()),
    apiKeys: v.optional(
      v.object({
        openai: v.optional(v.string()),
        finnhub: v.optional(v.string()),
        elevenlabs: v.optional(v.string()),
      })
    ),
    savedPlaces: v.optional(
      v.array(
        v.object({
          id: v.string(),
          label: v.string(),
          address: v.string(),
          createdAt: v.string(),
          updatedAt: v.string(),
        })
      )
    ),
    tripSummary: v.optional(v.string()),
    tripSummaryUpdatedAt: v.optional(v.string()),
    tripKnowledgeGraph: v.optional(v.string()),
    tripKnowledgeGraphUpdatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      const merged = {
        tripStart: args.tripStart ?? existing.tripStart,
        tripEnd: args.tripEnd ?? existing.tripEnd,
        timezone: args.timezone ?? existing.timezone,
        apiKeys: args.apiKeys ?? existing.apiKeys,
        savedPlaces: args.savedPlaces ?? existing.savedPlaces,
        tripSummary: args.tripSummary !== undefined ? args.tripSummary : existing.tripSummary,
        tripSummaryUpdatedAt: args.tripSummaryUpdatedAt !== undefined ? args.tripSummaryUpdatedAt : existing.tripSummaryUpdatedAt,
        tripKnowledgeGraph: args.tripKnowledgeGraph !== undefined ? args.tripKnowledgeGraph : existing.tripKnowledgeGraph,
        tripKnowledgeGraphUpdatedAt: args.tripKnowledgeGraphUpdatedAt !== undefined ? args.tripKnowledgeGraphUpdatedAt : existing.tripKnowledgeGraphUpdatedAt,
      };
      await ctx.db.patch(existing._id, merged);
      return { ...existing, ...merged };
    }
    const id = await ctx.db.insert("userSettings", {
      userId,
      tripStart: args.tripStart ?? defaults.tripStart,
      tripEnd: args.tripEnd ?? defaults.tripEnd,
      timezone: args.timezone ?? defaults.timezone,
      ...(args.apiKeys && { apiKeys: args.apiKeys }),
      ...(args.savedPlaces && { savedPlaces: args.savedPlaces }),
      ...(args.tripSummary !== undefined && { tripSummary: args.tripSummary }),
      ...(args.tripSummaryUpdatedAt !== undefined && { tripSummaryUpdatedAt: args.tripSummaryUpdatedAt }),
      ...(args.tripKnowledgeGraph !== undefined && { tripKnowledgeGraph: args.tripKnowledgeGraph }),
      ...(args.tripKnowledgeGraphUpdatedAt !== undefined && { tripKnowledgeGraphUpdatedAt: args.tripKnowledgeGraphUpdatedAt }),
    });
    return (await ctx.db.get(id))!;
  },
});
