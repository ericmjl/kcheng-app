import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";
import { exaResearchGet, exaResearchOutputToString } from "@/lib/exa";
import { generateDisplaySummary } from "@/lib/generate-display-summary";

/**
 * GET /api/contacts/[id]/research/status
 * Poll this after starting research. If Exa task is completed, updates contact and returns { status, contact }.
 * If still running, returns { status: "running" }. If failed, returns { status: "failed" } and clears task on contact.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const contactId = (await params).id as string;
    const client = await getConvexClient(uid);
    const contact = await client.query(api.contacts.get, { id: contactId as any });
    if (!contact)
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const taskId = contact.researchTaskId;
    if (!taskId) {
      return NextResponse.json({ status: "idle", contact });
    }

    const task = await exaResearchGet(taskId);
    const statusLower = String(task.status ?? "").toLowerCase();

    if (statusLower === "completed") {
      const outputText = exaResearchOutputToString(task);
      if (!outputText) {
        console.warn("[research/status] Exa task completed but output empty. Raw task.output type:", typeof task.output);
      }
      await client.mutation(api.contacts.update, {
        id: contactId as any,
        ...(outputText ? { researchSummary: outputText } : {}),
        researchTaskId: "",
        researchTaskStatus: "",
      });
      let updated = await client.query(api.contacts.get, { id: contactId as any });
      if (updated?.name) {
        const displaySummary = await generateDisplaySummary(uid, {
          name: updated.name,
          company: updated.company,
          role: updated.role,
          notes: updated.notes,
          linkedInUrl: updated.linkedInUrl,
          researchSummary: updated.researchSummary,
        });
        if (displaySummary) {
          await client.mutation(api.contacts.update, {
            id: contactId as any,
            displaySummary,
          });
          updated = await client.query(api.contacts.get, { id: contactId as any });
        }
      }
      return NextResponse.json({ status: "completed", contact: updated });
    }

    if (statusLower === "failed" || statusLower === "canceled") {
      await client.mutation(api.contacts.update, {
        id: contactId as any,
        researchTaskId: "",
        researchTaskStatus: "",
      });
      return NextResponse.json({ status: "failed" });
    }

    return NextResponse.json({ status: "running" });
  } catch (e) {
    console.error("[contacts/research/status]", e);
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
