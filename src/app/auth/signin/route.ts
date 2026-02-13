import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

export async function GET() {
  const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
  if (!redirectUri?.startsWith("https://")) {
    console.error(
      "[auth/signin] NEXT_PUBLIC_WORKOS_REDIRECT_URI must be set to your production callback URL (e.g. https://your-app.vercel.app/callback) and added in WorkOS Dashboard → Redirects"
    );
    return new NextResponse(
      "Sign-in is not configured. Set NEXT_PUBLIC_WORKOS_REDIRECT_URI and WorkOS env vars on Vercel, and add the callback URL in WorkOS Dashboard → Redirects.",
      { status: 503, headers: { "Content-Type": "text/plain" } }
    );
  }
  try {
    const url = await getSignInUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[auth/signin]", err);
    return new NextResponse(
      "Sign-in failed. Check Vercel env: WORKOS_CLIENT_ID, WORKOS_API_KEY, WORKOS_COOKIE_PASSWORD, NEXT_PUBLIC_WORKOS_REDIRECT_URI. Add callback URL in WorkOS Dashboard → Redirects.",
      { status: 503, headers: { "Content-Type": "text/plain" } }
    );
  }
}
