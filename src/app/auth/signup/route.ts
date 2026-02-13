import { getSignUpUrl } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

export async function GET() {
  const url = await getSignUpUrl();
  return NextResponse.redirect(url);
}
