"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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

  if (loading) return <main className="p-6"><p className="text-[var(--text-muted)]">Loading…</p></main>;
  if (!contact) return <main className="p-6"><p className="text-[var(--text-muted)]">Contact not found.</p><Link href="/contacts" className="text-[var(--text-muted)]">Back to contacts</Link></main>;

  const hasCompanyInfo = contact.stockTicker || contact.company;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/contacts" className="mb-4 inline-block text-sm text-[var(--text-muted)] hover:underline">← Contacts</Link>
      <h1 className="text-2xl font-semibold text-[var(--text)]">{contact.name}</h1>
      {(contact.company || contact.role) && (
        <p className="text-[var(--text-muted)]">{[contact.company, contact.role].filter(Boolean).join(" · ")}</p>
      )}
      {contact.phone && <p className="mt-2 text-[var(--text-muted)]">Phone: {contact.phone}</p>}
      {contact.email && <p className="text-[var(--text-muted)]">Email: {contact.email}</p>}
      {contact.notes && <p className="mt-3 text-[var(--text-muted)]">{contact.notes}</p>}

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
                    <summary className="cursor-pointer text-xs text-[var(--text)]0">Transcript</summary>
                    <p className="mt-1 max-h-32 overflow-y-auto text-xs text-[var(--text)]0 whitespace-pre-wrap">
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
                <p className="mt-1 text-xs text-[var(--text)]0">
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
