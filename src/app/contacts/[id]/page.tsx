"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Contact, MeetingDossier } from "@/lib/types";
import { MeetingRecorder } from "@/app/components/MeetingRecorder";

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
  const [researchReportOpen, setResearchReportOpen] = useState(false);
  const researchSummaryRef = useRef<HTMLElement>(null);

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
        <div className="flex items-center gap-2">
          <Link
            href={`/contacts?edit=${contact.id}`}
            className="rounded-lg border border-[var(--mint-soft)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={runResearch}
            disabled={!!contact.researchTaskId}
            className="rounded-lg border border-[var(--sky)] bg-[var(--sky-soft)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--sky)] disabled:opacity-60"
          >
            {contact.researchTaskId ? "Researching…" : "Deep research"}
          </button>
        </div>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--text)]">{contact.name}</h1>
      {(contact.company || contact.role) && (
        <p className="text-[var(--text-muted)]">{[contact.company, contact.role].filter(Boolean).join(" · ")}</p>
      )}
      {contact.pronouns && (
        <p className="text-sm text-[var(--text-muted)]">Pronouns: {contact.pronouns}</p>
      )}

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

      <div className="mt-6 space-y-1 text-sm text-[var(--text-muted)]">
        {contact.phone && <p>Phone: {contact.phone}</p>}
        {contact.email && <p>Email: {contact.email}</p>}
        {contact.linkedInUrl && (
          <p>
            <a href={contact.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--text)] underline hover:no-underline">
              LinkedIn profile →
            </a>
          </p>
        )}
      </div>
      {contact.notes && <p className="mt-3 text-sm text-[var(--text-muted)]">{contact.notes}</p>}

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
