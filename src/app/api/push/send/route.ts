import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import webPush from "web-push";

const secret = process.env.PUSH_SEND_SECRET || process.env.CRON_SECRET;
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (vapidPublic && vapidPrivate) {
  webPush.setVapidDetails(
    "mailto:support@example.com",
    vapidPublic,
    vapidPrivate
  );
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 503 }
    );
  }

  let body: { subscription: webPush.PushSubscription; title?: string; body?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subscription, title = "Reminder", body: message = "", url = "/" } = body;
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
  }

  try {
    await webPush.sendNotification(
      subscription,
      JSON.stringify({ title, body: message, url }),
      { TTL: 60 * 60 }
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push/send]", e);
    return NextResponse.json(
      { error: "Failed to send push" },
      { status: 500 }
    );
  }
}
