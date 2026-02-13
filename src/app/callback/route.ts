import { WorkOS } from "@workos-inc/node";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  encryptSessionForCookie,
  getSessionCookieOptions,
  type SessionData,
} from "@/lib/workos-auth";

const REDIRECT_URI = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI || "http://localhost:3000/callback";

function parseReturnPathname(state: string | null): string {
  if (!state) return "/";
  if (state.includes(".")) {
    const [internal] = state.split(".");
    try {
      const decoded = Buffer.from(internal.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      const parsed = JSON.parse(decoded) as { returnPathname?: string };
      if (parsed.returnPathname) return parsed.returnPathname;
    } catch {
      // ignore
    }
  } else {
    try {
      const decoded = Buffer.from(state, "base64").toString("utf8");
      const parsed = JSON.parse(decoded) as { returnPathname?: string };
      if (parsed.returnPathname) return parsed.returnPathname;
    } catch {
      // ignore
    }
  }
  return "/";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.json(
      {
        error: {
          message: "Something went wrong",
          description: "No authorization code in callback URL.",
        },
      },
      { status: 400 }
    );
  }

  const password = process.env.WORKOS_COOKIE_PASSWORD;
  if (!password || password.length < 32) {
    console.error("[callback] WORKOS_COOKIE_PASSWORD missing or too short");
    return NextResponse.json(
      {
        error: {
          message: "Server misconfiguration",
          description: "WORKOS_COOKIE_PASSWORD is not set or is shorter than 32 characters. Add it to .env.local and restart.",
        },
      },
      { status: 500 }
    );
  }

  const clientId = process.env.WORKOS_CLIENT_ID;
  const apiKey = process.env.WORKOS_API_KEY;
  if (!clientId || !apiKey) {
    console.error("[callback] WORKOS_CLIENT_ID or WORKOS_API_KEY missing");
    return NextResponse.json(
      { error: { message: "Server misconfiguration", description: "Missing WorkOS credentials." } },
      { status: 500 }
    );
  }

  try {
    const workos = new WorkOS(apiKey);
    const { accessToken, refreshToken, user, impersonator } =
      await workos.userManagement.authenticateWithCode({
        clientId,
        code,
      });

    if (!accessToken || !refreshToken) {
      throw new Error("WorkOS response missing tokens");
    }

    const session: SessionData = {
      user,
      accessToken,
      refreshToken,
      ...(impersonator && { impersonator }),
    };
    const cookieValue = encryptSessionForCookie(session);
    const opts = getSessionCookieOptions(REDIRECT_URI);
    const cookieName = process.env.WORKOS_COOKIE_NAME || "wos-session";
    const sameSite = opts.sameSite.charAt(0).toUpperCase() + opts.sameSite.slice(1);
    const setCookie = [
      `${cookieName}=${cookieValue}`,
      "Path=/",
      "HttpOnly",
      `SameSite=${sameSite}`,
      `Max-Age=${opts.maxAge}`,
      ...(opts.secure ? ["Secure"] : []),
    ].join("; ");

    const returnPathname = parseReturnPathname(state);
    const url = new URL(returnPathname, request.nextUrl.origin);
    const response = NextResponse.redirect(url.toString());
    response.headers.set("Set-Cookie", setCookie);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Vary", "Cookie");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[callback error]", message);
    return NextResponse.json(
      {
        error: {
          message: "Something went wrong",
          description: "Couldn't sign in. If you are not sure what happened, please contact your organization admin.",
          detail: message,
        },
      },
      { status: 500 }
    );
  }
}
