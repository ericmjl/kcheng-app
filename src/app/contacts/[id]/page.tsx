"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { format, parseISO } from "date-fns";
import type { Contact, MeetingDossier, Event } from "@/lib/types";
import { MeetingRecorder } from "@/app/components/MeetingRecorder";

const PencilIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

type TrendsData = {
  profile: { name?: string; country?: string; industry?: string; description?: string } | null;
  news: Array<{ headline?: string; summary?: string }>;
};

export default function ContactDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [dossiers, setDossiers] = useState<MeetingDossier[]>([]);
  const [scheduledEvents, setScheduledEvents] = useState<Event[]>([]);
  const [researchReportOpen, setResearchReportOpen] = useState(false);
  const researchSummaryRef = useRef<HTMLElement>(null);
  type EditField = "name" | "company" | "role" | "pronouns" | "phone" | "email" | "linkedInUrl" | "notes";
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPronouns, setEditPronouns] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLinkedInUrl, setEditLinkedInUrl] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchContact = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/contacts/${id}`, { credentials: "include" });
      if (res.ok) setContact(await res.json());
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/contacts/${id}`, { credentials: "include" });
        if (res.ok && !cancelled) setContact(await res.json());
      } catch {
        // ignore
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Refetch contact when tab gains focus (e.g. research completed in background)
  useEffect(() => {
    const onFocus = () => fetchContact();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchContact]);

  async function loadDossiers() {
    if (!id) return;
    try {
      const res = await fetch(`/api/dossiers?contactId=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setDossiers(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.warn(e);
    }
  }

  useEffect(() => {
    if (id) loadDossiers();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/events", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const list = (await res.json()) as Event[];
        if (!cancelled) setScheduledEvents(list.filter((e) => (e.contactIds && e.contactIds.includes(id)) || e.contactId === id));
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function fetchTrends() {
    if (!contact?.stockTicker && !contact?.company) return;
    setTrendsLoading(true);
    setTrends(null);
    try {
      const params = new URLSearchParams();
      if (contact.stockTicker) params.set("ticker", contact.stockTicker);
      if (contact.company) params.set("name", contact.company);
      const res = await fetch(`/api/company/trends?${params}`, {
        credentials: "include",
      });
      if (res.ok) setTrends(await res.json());
    } catch (e) {
      console.warn(e);
    } finally {
      setTrendsLoading(false);
    }
  }

  async function generateQuestions() {
    setQuestionsLoading(true);
    setQuestions([]);
    try {
      const trendsSummary =
        trends != null
          ? JSON.stringify({ profile: trends.profile, newsHeadlines: trends.news?.map((n) => n.headline) })
          : "";
      const res = await fetch("/api/conversation-starters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contactName: contact?.name,
          company: contact?.company,
          contactId: contact?.id,
          trendsSummary,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions ?? []);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setQuestionsLoading(false);
    }
  }

  async function runResearch() {
    if (!contact?.id || contact.researchTaskId) return;
    try {
      const res = await fetch(`/api/contacts/${contact.id}/research`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      setContact(data);
    } catch (e) {
      console.warn(e);
    }
  }

  function startEditField(field: EditField) {
    if (!contact) return;
    setSaveError(null);
    setEditingField(field);
    setEditName(contact.name);
    setEditCompany(contact.company ?? "");
    setEditRole(contact.role ?? "");
    setEditPronouns(contact.pronouns ?? "");
    setEditPhone(contact.phone ?? "");
    setEditEmail(contact.email ?? "");
    setEditLinkedInUrl(contact.linkedInUrl ?? "");
    setEditNotes(contact.notes ?? "");
  }

  async function saveField() {
    if (!contact?.id || !editingField || saving) return;
    setSaving(true);
    try {
      const body: Record<string, string | undefined> = {};
      if (editingField === "name") body.name = editName.trim() || contact.name;
      if (editingField === "company" || editingField === "role") {
        body.company = editCompany.trim() || undefined;
        body.role = editRole.trim() || undefined;
      }
      if (editingField === "pronouns") body.pronouns = editPronouns.trim() || undefined;
      if (editingField === "phone") body.phone = editPhone.trim() || undefined;
      if (editingField === "email") body.email = editEmail.trim() || undefined;
      if (editingField === "linkedInUrl") body.linkedInUrl = editLinkedInUrl.trim() || undefined;
      if (editingField === "notes") body.notes = editNotes.trim() || undefined;
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setContact(data);
        setEditingField(null);
        setSaveError(null);
      } else {
        setSaveError((data as { error?: string }).error ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleBlur() {
    if (editingField && !saving) saveField();
  }

  // Poll research status when this contact has an in-flight task
  useEffect(() => {
    if (!id || !contact?.researchTaskId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/contacts/${id}/research/status`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "completed" && data.contact) {
          setContact(data.contact);
          setTimeout(() => researchSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        }
        if (data.status === "failed") setContact((c) => c ? { ...c, researchTaskId: undefined, researchTaskStatus: undefined } : c);
      } catch {
        // ignore
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [id, contact?.researchTaskId]);

  if (loading) return <main className="p-6"><p className="text-[var(--text-muted)]">Loading…</p></main>;
  if (!contact) return <main className="p-6"><p className="text-[var(--text-muted)]">Contact not found.</p><Link href="/contacts" className="text-[var(--text-muted)]">Back to contacts</Link></main>;

  const hasCompanyInfo = contact.stockTicker || contact.company;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/contacts" className="text-sm text-[var(--text-muted)] hover:underline">← Contacts</Link>
        <button
          type="button"
          onClick={runResearch}
          disabled={!!contact.researchTaskId}
          className="rounded-lg border border-[var(--sky)] bg-[var(--sky-soft)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--sky)] disabled:opacity-60"
        >
          {contact.researchTaskId ? "Researching…" : "Deep research"}
        </button>
      </div>
      {saveError && (
        <p className="mb-3 rounded-lg bg-[var(--peach)]/30 px-3 py-2 text-sm text-[var(--coral)]" role="alert">
          {saveError}
        </p>
      )}
      {/* Name — inline edit */}
      <div className="group flex items-baseline gap-2">
        {editingField === "name" ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveField(); } }}
              autoFocus
              className="min-w-0 flex-1 rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1 text-2xl font-semibold text-[var(--text)]"
            />
            <button type="button" onClick={() => saveField()} disabled={saving} className="shrink-0 rounded bg-[var(--mint)] px-2.5 py-1 text-sm font-medium text-[var(--text)] hover:opacity-90 disabled:opacity-60">
              {saving ? "…" : "Done"}
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-[var(--text)]">{contact.name}</h1>
            <button type="button" onClick={() => startEditField("name")} disabled={saving} className="inline-flex shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70" aria-label="Edit name">
              <PencilIcon />
            </button>
          </>
        )}
      </div>
      {/* Company · Role — inline edit */}
      <div className="mt-1 group flex items-baseline gap-2">
        {editingField === "company" || editingField === "role" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Company"
              value={editCompany}
              onChange={(e) => setEditCompany(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveField(); } }}
              className="rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1 text-[var(--text)] placeholder-[var(--text-muted)]"
            />
            <input
              type="text"
              placeholder="Role"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveField(); } }}
              className="rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1 text-[var(--text)] placeholder-[var(--text-muted)]"
            />
            <button type="button" onClick={() => saveField()} disabled={saving} className="rounded bg-[var(--mint)] px-2.5 py-1 text-sm font-medium text-[var(--text)] hover:opacity-90 disabled:opacity-60">
              {saving ? "…" : "Done"}
            </button>
          </div>
        ) : (
          <>
            <span className="text-[var(--text-muted)]">{[contact.company, contact.role].filter(Boolean).join(" · ") || "—"}</span>
            <button type="button" onClick={() => startEditField("company")} disabled={saving} className="inline-flex shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70" aria-label="Edit company and role">
              <PencilIcon />
            </button>
          </>
        )}
      </div>
      {/* Pronouns — inline edit */}
      <div className="mt-0.5 group flex items-baseline gap-2 text-sm text-[var(--text-muted)]">
        {editingField === "pronouns" ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Pronouns"
              value={editPronouns}
              onChange={(e) => setEditPronouns(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveField(); } }}
              className="rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1 text-[var(--text)] placeholder-[var(--text-muted)]"
            />
            <button type="button" onClick={() => saveField()} disabled={saving} className="rounded bg-[var(--mint)] px-2.5 py-1 text-sm font-medium text-[var(--text)] hover:opacity-90 disabled:opacity-60">
              {saving ? "…" : "Done"}
            </button>
          </div>
        ) : (
          <>
            <span>{contact.pronouns ? `Pronouns: ${contact.pronouns}` : "—"}</span>
            <button type="button" onClick={() => startEditField("pronouns")} disabled={saving} className="inline-flex shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70" aria-label="Edit pronouns">
              <PencilIcon />
            </button>
          </>
        )}
      </div>

      {/* AI-generated display card (summary); regenerated when contact or research changes */}
      {(contact.displaySummary || contact.researchTaskId) ? (
        <section
          ref={researchSummaryRef}
          id="research-summary"
          className="mt-6 rounded-xl border border-[var(--sky)] bg-[var(--sky-soft)]/50 p-4"
        >
          <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Summary</h2>
          {contact.researchTaskId ? (
            <p className="text-sm text-[var(--text-muted)]">Research in progress… Summary will update when ready.</p>
          ) : contact.displaySummary ? (
            <div className="research-report text-sm leading-relaxed text-[var(--text)] [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>h2]:mt-3 [&>h2]:mb-1 [&>h2]:font-semibold [&>h3]:mt-2 [&>h3]:mb-1 [&>h3]:font-medium [&>a]:text-[var(--sky)] [&>a]:underline hover:[&>a]:no-underline">
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {contact.displaySummary}
              </ReactMarkdown>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Full deep research report (Exa output) – collapsible */}
      {contact.researchSummary && (
        <section className="mt-6 rounded-xl border border-[var(--mint-soft)] bg-[var(--cream)] overflow-hidden">
          <button
            type="button"
            onClick={() => setResearchReportOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-[var(--mint-soft)]/30 transition-colors"
            aria-expanded={researchReportOpen}
          >
            <h2 className="text-base font-semibold text-[var(--text)]">Deep research report</h2>
            <span className="shrink-0 text-[var(--text-muted)] transition-transform" style={{ transform: researchReportOpen ? "rotate(180deg)" : "rotate(0deg)" }} aria-hidden>▼</span>
          </button>
          {researchReportOpen && (
            <div className="border-t border-[var(--mint-soft)] p-4">
              <p className="mb-3 text-xs text-[var(--text-muted)]">Full report from deep research. The summary above is an AI-generated digest of this and your contact info.</p>
              <div className="research-report text-sm leading-relaxed text-[var(--text)] [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>h2]:mt-3 [&>h2]:mb-1 [&>h2]:font-semibold [&>h3]:mt-2 [&>h3]:mb-1 [&>h3]:font-medium [&>a]:text-[var(--sky)] [&>a]:underline hover:[&>a]:no-underline">
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {contact.researchSummary}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </section>
      )}

      <dl className="mt-6 space-y-3 text-sm">
        <div>
          <dt className="text-[var(--text-muted)]">Phone</dt>
          <dd className="mt-0.5 group">
            {editingField === "phone" ? (
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveField(); } }}
                  placeholder="Phone"
                  autoFocus
                  className="min-w-0 flex-1 rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1.5 text-[var(--text)] placeholder-[var(--text-muted)]"
                />
                <button type="button" onClick={() => saveField()} disabled={saving} className="shrink-0 rounded bg-[var(--mint)] px-2.5 py-1 text-sm font-medium text-[var(--text)] hover:opacity-90 disabled:opacity-60">
                  {saving ? "…" : "Done"}
                </button>
              </div>
            ) : (
              <>
                <span className="text-[var(--text)]">{contact.phone || "—"}</span>
                <button type="button" onClick={() => startEditField("phone")} disabled={saving} className="ml-1.5 inline-flex shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70" aria-label="Edit phone">
                  <PencilIcon />
                </button>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Email</dt>
          <dd className="mt-0.5 group">
            {editingField === "email" ? (
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveField(); } }}
                  placeholder="Email"
                  autoFocus
                  className="min-w-0 flex-1 rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1.5 text-[var(--text)] placeholder-[var(--text-muted)]"
                />
                <button type="button" onClick={() => saveField()} disabled={saving} className="shrink-0 rounded bg-[var(--mint)] px-2.5 py-1 text-sm font-medium text-[var(--text)] hover:opacity-90 disabled:opacity-60">
                  {saving ? "…" : "Done"}
                </button>
              </div>
            ) : (
              <>
                <span className="text-[var(--text)]">{contact.email || "—"}</span>
                <button type="button" onClick={() => startEditField("email")} disabled={saving} className="ml-1.5 inline-flex shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70" aria-label="Edit email">
                  <PencilIcon />
                </button>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">LinkedIn</dt>
          <dd className="mt-0.5 group">
            {editingField === "linkedInUrl" ? (
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={editLinkedInUrl}
                  onChange={(e) => setEditLinkedInUrl(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveField(); } }}
                  placeholder="https://linkedin.com/in/..."
                  autoFocus
                  className="min-w-0 flex-1 rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1.5 text-[var(--text)] placeholder-[var(--text-muted)]"
                />
                <button type="button" onClick={() => saveField()} disabled={saving} className="shrink-0 rounded bg-[var(--mint)] px-2.5 py-1 text-sm font-medium text-[var(--text)] hover:opacity-90 disabled:opacity-60">
                  {saving ? "…" : "Done"}
                </button>
              </div>
            ) : (
              <>
                {contact.linkedInUrl ? (
                  <a
                    href={contact.linkedInUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mint-soft)] bg-[var(--cream)] px-2.5 py-1 text-sm font-medium text-[var(--text)] shadow-sm transition-colors hover:border-[var(--mint)] hover:bg-[var(--mint-soft)]"
                  >
                    {contact.linkedInUrl.replace(/^https?:\/\/(www\.)?/i, "").slice(0, 40)}
                    {contact.linkedInUrl.length > 40 ? "…" : ""}
                    <span className="text-[var(--text-muted)]" aria-hidden>→</span>
                  </a>
                ) : (
                  <span className="text-[var(--text-muted)]">—</span>
                )}
                <button type="button" onClick={() => startEditField("linkedInUrl")} disabled={saving} className="ml-1.5 inline-flex shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70" aria-label="Edit LinkedIn">
                  <PencilIcon />
                </button>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Notes</dt>
          <dd className="mt-0.5 group">
            {editingField === "notes" ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  onBlur={handleBlur}
                  placeholder="Notes"
                  rows={3}
                  autoFocus
                  className="w-full rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1.5 text-[var(--text)] placeholder-[var(--text-muted)]"
                />
                <button type="button" onClick={() => saveField()} disabled={saving} className="self-start rounded bg-[var(--mint)] px-2.5 py-1 text-sm font-medium text-[var(--text)] hover:opacity-90 disabled:opacity-60">
                  {saving ? "…" : "Done"}
                </button>
              </div>
            ) : (
              <>
                <span className="whitespace-pre-wrap text-[var(--text)]">{contact.notes || "—"}</span>
                <button type="button" onClick={() => startEditField("notes")} disabled={saving} className="ml-1.5 inline-flex shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70" aria-label="Edit notes">
                  <PencilIcon />
                </button>
              </>
            )}
          </dd>
        </div>
      </dl>

      {scheduledEvents.length > 0 && (
        <section className="mt-6 rounded border border-[var(--mint-soft)] bg-[var(--cream)] p-4">
          <h2 className="mb-2 font-medium text-[var(--text)]">Scheduled meetings</h2>
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            Calendar events linked to this contact.
          </p>
          <ul className="space-y-2">
            {scheduledEvents
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
              .map((ev) => (
                <li key={ev.id}>
                  <Link
                    href={`/events/${ev.id}`}
                    className="block rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] p-2.5 text-sm text-[var(--text)] hover:bg-[var(--mint-soft)]/50"
                  >
                    <span className="font-medium">{ev.title}</span>
                    {ev.start && (
                      <span className="ml-2 text-[var(--text-muted)]">
                        {format(parseISO(ev.start), "EEE, MMM d 'at' h:mm a")}
                      </span>
                    )}
                    {ev.location && (
                      <span className="block mt-0.5 text-xs text-[var(--text-muted)]">{ev.location}</span>
                    )}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      {hasCompanyInfo && (
        <section className="mt-6 rounded border border-[var(--mint-soft)] bg-[var(--cream)] p-4">
          <h2 className="mb-2 font-medium text-[var(--text)]">Prepare for meeting</h2>
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            Pull company trends and generate conversation starters.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fetchTrends}
              disabled={trendsLoading}
              className="rounded bg-[var(--mint)] px-3 py-1.5 text-sm text-[var(--text)] hover:opacity-90 disabled:opacity-50"
            >
              {trendsLoading ? "Loading…" : "Load company trends"}
            </button>
            <button
              type="button"
              onClick={generateQuestions}
              disabled={questionsLoading}
              className="rounded border border-[var(--mint-soft)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)] disabled:opacity-50"
            >
              {questionsLoading ? "Generating…" : "Generate conversation starters"}
            </button>
          </div>
          {trends && (
            <div className="mt-3 text-sm text-[var(--text-muted)]">
              {trends.profile?.description && (
                <p className="mb-2">{trends.profile.description}</p>
              )}
              {trends.news?.length > 0 && (
                <div>
                  <p className="font-medium text-[var(--text-muted)]">Recent news</p>
                  <ul className="mt-1 list-disc pl-4">
                    {trends.news.slice(0, 5).map((n, i) => (
                      <li key={i}>{n.headline ?? n.summary}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {questions.length > 0 && (
            <div className="mt-3">
              <p className="font-medium text-[var(--text-muted)]">Conversation starters</p>
              <ul className="mt-1 list-inside list-decimal space-y-1 text-sm text-[var(--text-muted)]">
                {questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 font-medium text-[var(--text)]">Meeting dossiers</h2>
        <MeetingRecorder
          contactId={id}
          contactName={contact.name}
          onSaved={loadDossiers}
        />
        {dossiers.length > 0 && (
          <ul className="mt-4 space-y-3">
            {dossiers.map((d) => (
              <li
                key={d.id}
                className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] p-3"
              >
                {d.summary && <p className="text-sm text-[var(--text-muted)]">{d.summary}</p>}
                {d.transcript && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-[var(--text)]">Transcript</summary>
                    <p className="mt-1 max-h-32 overflow-y-auto text-xs text-[var(--text)] whitespace-pre-wrap">
                      {d.transcript}
                    </p>
                  </details>
                )}
                {d.actionItems && d.actionItems.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs text-[var(--text-muted)]">
                    {d.actionItems.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-xs text-[var(--text)]">
                  {d.createdAt ? new Date(d.createdAt).toLocaleString() : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
