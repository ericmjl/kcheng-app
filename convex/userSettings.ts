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
    return doc ? { ...defaults, ...doc } : { ...defaults, userId };
  },
});

export const set = mutation({
  args: {
    tripStart: v.optional(v.string()),
    tripEnd: v.optional(v.string()),
    timezone: v.optional(v.string()),
    apiKeys: v.optional(
      v.object({
        anthropic: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    const updates = {
      ...(args.tripStart !== undefined && { tripStart: args.tripStart }),
      ...(args.tripEnd !== undefined && { tripEnd: args.tripEnd }),
      ...(args.timezone !== undefined && { timezone: args.timezone }),
      ...(args.apiKeys !== undefined && { apiKeys: args.apiKeys }),
      ...(args.savedPlaces !== undefined && { savedPlaces: args.savedPlaces }),
    };
    if (existing) {
      const merged = {
        tripStart: args.tripStart ?? existing.tripStart,
        tripEnd: args.tripEnd ?? existing.tripEnd,
        timezone: args.timezone ?? existing.timezone,
        apiKeys: args.apiKeys ?? existing.apiKeys,
        savedPlaces: args.savedPlaces ?? existing.savedPlaces,
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
    });
    return (await ctx.db.get(id))!;
  },
});
