"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const REMINDER_WINDOW_MINUTES = 6; // Notify when event starts in ~30 min; cron runs every 15 min
const MIN_MINUTES_FROM_NOW = 27;
const MAX_MINUTES_FROM_NOW = 33;

/**
 * Cron-triggered action: find events starting in ~30 min, send push reminders.
 * Calls Next.js API to actually send (web-push lives there with VAPID keys).
 */
export const sendEventReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const startAfter = new Date(now.getTime() + MIN_MINUTES_FROM_NOW * 60 * 1000).toISOString();
    const startBefore = new Date(now.getTime() + MAX_MINUTES_FROM_NOW * 60 * 1000).toISOString();

    const events = await ctx.runQuery(internal.events.listUpcomingForReminders, {
      startAfter,
      startBefore,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
    const secret = process.env.PUSH_SEND_SECRET || process.env.CRON_SECRET || "";
    if (!baseUrl || !secret) {
      console.warn("[reminders] NEXT_PUBLIC_APP_URL and PUSH_SEND_SECRET (or CRON_SECRET) must be set to send push.");
      return;
    }

    for (const event of events) {
      const subs = await ctx.runQuery(internal.pushSubscriptions.listByUserId, {
        userId: event.userId,
      });
      const timeStr = formatTime(event.start);
      const body = event.location ? `${timeStr} at ${event.location}` : timeStr;
      const payload = {
        title: event.title,
        body: `Starting soon: ${body}`,
        url: `${baseUrl.replace(/\/$/, "")}/calendar`,
      };

      for (const sub of subs) {
        try {
          const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/push/send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({
              subscription: sub.subscription,
              ...payload,
            }),
          });
          if (!res.ok) {
            console.warn("[reminders] push send failed", res.status, await res.text());
          }
        } catch (e) {
          console.warn("[reminders] push send error", e);
        }
      }

      await ctx.runMutation(internal.events.markReminderSent, { id: event.id });
    }
  },
});

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}
