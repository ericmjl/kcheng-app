import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userSettings: defineTable({
    userId: v.string(),
    tripStart: v.string(),
    tripEnd: v.string(),
    timezone: v.string(),
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
  }).index("by_userId", ["userId"]),

  contacts: defineTable({
    userId: v.string(),
    name: v.string(),
    company: v.optional(v.string()),
    role: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    stockTicker: v.optional(v.string()),
    notes: v.optional(v.string()),
    pronouns: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    linkedInPhotoFetchedAt: v.optional(v.string()),
    linkedInUrl: v.optional(v.string()),
    researchSummary: v.optional(v.string()),
    displaySummary: v.optional(v.string()),
    researchTaskId: v.optional(v.string()),
    researchTaskStatus: v.optional(v.string()),
    eventIds: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),

  events: defineTable({
    userId: v.string(),
    title: v.string(),
    start: v.string(),
    end: v.optional(v.string()),
    location: v.optional(v.string()),
    contactIds: v.optional(v.array(v.string())),
    contactId: v.optional(v.string()), // legacy; prefer contactIds
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]).index("by_userId_start", ["userId", "start"]),

  todos: defineTable({
    userId: v.string(),
    text: v.string(),
    done: v.boolean(),
    dueDate: v.optional(v.string()),
    contactIds: v.optional(v.array(v.string())),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),

  dossiers: defineTable({
    userId: v.string(),
    contactId: v.string(),
    eventId: v.optional(v.string()),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    actionItems: v.optional(v.array(v.string())),
    recordingUrl: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]).index("by_userId_contactId", ["userId", "contactId"]),

  plannedRoutes: defineTable({
    userId: v.string(),
    from: v.string(),
    to: v.string(),
    date: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),

  pushSubscriptions: defineTable({
    userId: v.string(),
    endpoint: v.string(),
    subscription: v.any(),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]).index("by_endpoint", ["endpoint"]),
});
