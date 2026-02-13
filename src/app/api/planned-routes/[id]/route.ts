import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getUid } from "@/lib/workos-auth";

function routeRef(uid: string, routeId: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("plannedRoutes").doc(routeId);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = routeRef(uid, (await params).id);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete route" }, { status: 500 });
  }
}
