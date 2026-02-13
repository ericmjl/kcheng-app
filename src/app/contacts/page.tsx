"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { cachedGet } from "@/lib/cachedFetch";
import type { Contact } from "@/lib/types";
import Link from "next/link";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({
    name: "",
    company: "",
    role: "",
    phone: "",
    email: "",
    stockTicker: "",
    notes: "",
    pronouns: "",
  });
  const [enrichId, setEnrichId] = useState<string | null>(null);
  const [enrichCandidates, setEnrichCandidates] = useState<{ title: string; link: string }[]>([]);
  const [enrichLoading, setEnrichLoading] = useState(false);

  const loadContacts = useCallback(async () => {
    try {
      const data = await cachedGet<Contact[]>("contacts", async () => {
        const res = await fetch("/api/contacts", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load contacts");
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      });
      setContacts(data);
    } catch (e) {
      console.warn(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const searchParams = useSearchParams();
  const editIdFromUrl = searchParams.get("edit");
  const appliedEditIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editIdFromUrl || !contacts.length || appliedEditIdRef.current === editIdFromUrl) return;
    const c = contacts.find((x) => x.id === editIdFromUrl);
    if (c) {
      openEdit(c);
      appliedEditIdRef.current = editIdFromUrl;
    }
  }, [editIdFromUrl, contacts]);
  useEffect(() => {
    if (!editIdFromUrl) appliedEditIdRef.current = null;
  }, [editIdFromUrl]);

  useEffect(() => {
    const onDataChanged = () => loadContacts();
    window.addEventListener("trip-assistant:data-changed", onDataChanged);
    return () => window.removeEventListener("trip-assistant:data-changed", onDataChanged);
  }, [loadContacts]);

  // Poll research status for any contact with an in-flight task
  const researchContactIds = contacts
    .filter((c) => c.researchTaskId)
    .map((c) => c.id);
  useEffect(() => {
    if (researchContactIds.length === 0) return;
    const interval = setInterval(async () => {
      for (const id of researchContactIds) {
        try {
          const res = await fetch(`/api/contacts/${id}/research/status`, {
            credentials: "include",
          });
          if (!res.ok) continue;
          const data = await res.json();
          if (data.status === "completed" && data.contact) {
            setContacts((prev) => prev.map((c) => (c.id === data.contact.id ? data.contact : c)));
          }
          if (data.status === "failed") {
            setContacts((prev) =>
              prev.map((c) =>
                c.id === id
                  ? { ...c, researchTaskId: undefined, researchTaskStatus: undefined }
                  : c
              )
            );
          }
        } catch {
          // ignore
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [researchContactIds.join(",")]);

  function openNew() {
    setEditing({ id: "", name: "", eventIds: [], createdAt: "", updatedAt: "" });
    setForm({
      name: "",
      company: "",
      role: "",
      phone: "",
      email: "",
      stockTicker: "",
      notes: "",
      pronouns: "",
    });
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      name: c.name,
      company: c.company ?? "",
      role: c.role ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      stockTicker: c.stockTicker ?? "",
      notes: c.notes ?? "",
      pronouns: c.pronouns ?? "",
    });
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || undefined,
      role: form.role.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      stockTicker: form.stockTicker.trim() || undefined,
      notes: form.notes.trim() || undefined,
      pronouns: editing?.id ? form.pronouns.trim() : (form.pronouns.trim() || undefined),
      eventIds: editing?.eventIds ?? [],
    };
    if (editing?.id) {
      const res = await fetch(`/api/contacts/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setEditing(null);
      }
    } else {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setContacts((prev) => [...prev, created]);
        setEditing(null);
      }
    }
  }

  async function deleteContact(id: string) {
    const res = await fetch(`/api/contacts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setEditing(null);
      setEnrichId(null);
    }
  }

  async function runEnrich(c: Contact) {
    setEnrichId(c.id);
    setEnrichCandidates([]);
    setEnrichLoading(true);
    try {
      const res = await fetch(`/api/contacts/${c.id}/enrich`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enrich failed");
      setEnrichCandidates(data.candidates ?? []);
    } catch (e) {
      setEnrichCandidates([{ title: e instanceof Error ? e.message : "Search failed", link: "" }]);
    }
    setEnrichLoading(false);
  }

  async function pickLinkedIn(contactId: string, link: string) {
    if (!link) return;
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ linkedInUrl: link }),
    });
    if (res.ok) {
      const updated = await res.json();
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEnrichId(null);
      setEnrichCandidates([]);
    }
  }

  async function runResearch(c: Contact) {
    if (c.researchTaskId) return; // already in progress
    try {
      const res = await fetch(`/api/contacts/${c.id}/research`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      setContacts((prev) => prev.map((c) => (c.id === data.id ? data : c)));
      // Polling effect will pick up status; card shows "Researching…" via researchTaskId
    } catch (e) {
      console.warn(e);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-[var(--text-muted)]">Loading contacts…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Contacts</h1>
        <button
          type="button"
          onClick={openNew}
          className="rounded-xl bg-[var(--mint)] px-4 py-2 text-sm font-medium text-[var(--text)] shadow-sm hover:opacity-90"
        >
          Add contact
        </button>
      </div>

      {/* Add/Edit form */}
      {editing && (
        <section className="mb-8 rounded-xl border border-[var(--mint-soft)] bg-[var(--cream)] p-5 shadow-sm">
          <h2 className="mb-4 font-medium text-[var(--text)]">
            {editing.id ? "Edit contact" : "New contact"}
          </h2>
          <form onSubmit={saveContact} className="space-y-3">
            <input
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Company"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className="w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
              />
              <input
                placeholder="Role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
              />
            </div>
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
            />
            <input
              placeholder="Stock ticker (for company trends)"
              value={form.stockTicker}
              onChange={(e) => setForm((f) => ({ ...f, stockTicker: e.target.value }))}
              className="w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
            />
            <input
              placeholder="Pronouns (e.g. they/them, she/her, he/him)"
              value={form.pronouns}
              onChange={(e) => setForm((f) => ({ ...f, pronouns: e.target.value }))}
              className="w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
            />
            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-lg bg-[var(--mint)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:opacity-90"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-[var(--mint-soft)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
              >
                Cancel
              </button>
              {editing.id && (
                <button
                  type="button"
                  onClick={() => editing.id && deleteContact(editing.id)}
                  className="rounded-lg px-4 py-2 text-sm text-[var(--coral)] hover:bg-[var(--peach)]/30"
                >
                  Delete
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {/* Contact cards grid */}
      {contacts.length === 0 && !editing && (
        <p className="text-[var(--text-muted)]">No contacts yet. Add one to get started.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((c) => (
          <article
            key={c.id}
            className="flex flex-col rounded-xl border border-[var(--mint-soft)] bg-[var(--cream)] p-4 shadow-sm transition-shadow hover:shadow"
          >
            <Link
              href={`/contacts/${c.id}`}
              className="flex items-start gap-3 min-w-0 rounded-lg -m-1 p-1 hover:bg-[var(--mint-soft)]/50 transition-colors"
            >
              {c.photoUrl ? (
                <img
                  src={c.photoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--mint-soft)] text-sm font-medium text-[var(--text)]"
                  aria-hidden
                >
                  {initials(c.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-[var(--text)] truncate">{c.name}</h3>
                {(c.company || c.role) && (
                  <p className="text-sm text-[var(--text-muted)] truncate">
                    {[c.company, c.role].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </Link>

            <div className="mt-3 flex flex-wrap gap-2">
              {c.linkedInUrl ? (
                <a
                  href={c.linkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--mint-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--mint-soft)]"
                >
                  LinkedIn →
                </a>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); runEnrich(c); }}
                  disabled={enrichLoading && enrichId === c.id}
                  className="rounded-lg border border-[var(--mint-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--mint-soft)] disabled:opacity-60"
                >
                  {enrichLoading && enrichId === c.id ? "Searching…" : "Find on LinkedIn"}
                </button>
              )}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); runResearch(c); }}
                disabled={!!c.researchTaskId}
                className="rounded-lg border border-[var(--sky)] bg-[var(--sky-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--sky)] disabled:opacity-60"
              >
                {c.researchTaskId ? "Researching…" : "Deep research"}
              </button>
            </div>

            {c.displaySummary && (
              <div className="mt-3 rounded-lg bg-[var(--wall)] p-2.5 text-xs text-[var(--text)] line-clamp-4 [&>p]:mb-0 [&>p]:last:mb-0">
                <div className="whitespace-pre-wrap line-clamp-4">{c.displaySummary.replace(/\*\*/g, "").replace(/#/g, "")}</div>
              </div>
            )}

            <div className="mt-auto flex items-center gap-3 pt-3 border-t border-[var(--mint-soft)]/50">
              <Link
                href={`/contacts/${c.id}`}
                className="text-xs text-[var(--text-muted)] hover:underline"
              >
                View
              </Link>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); openEdit(c); }}
                className="text-xs text-[var(--text-muted)] hover:underline"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); deleteContact(c.id); }}
                className="ml-auto text-xs text-[var(--coral)] hover:underline"
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Enrich modal: pick LinkedIn profile */}
      {enrichId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEnrichId(null)}
          role="dialog"
          aria-label="Pick LinkedIn profile"
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl border border-[var(--mint-soft)] bg-[var(--cream)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--mint-soft)] p-3">
              <h3 className="font-medium text-[var(--text)]">Choose LinkedIn profile</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Click a result to set as this contact’s LinkedIn.
              </p>
            </div>
            <ul className="max-h-96 overflow-y-auto p-2">
              {enrichCandidates.length === 0 && !enrichLoading && (
                <li className="p-2 text-sm text-[var(--text-muted)]">No profiles found.</li>
              )}
              {enrichCandidates.map((item) =>
                item.link ? (
                  <li key={item.link}>
                    <button
                      type="button"
                      onClick={() => pickLinkedIn(enrichId, item.link)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--mint-soft)]"
                    >
                      <span className="font-medium line-clamp-1">{item.title}</span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">
                        {item.link}
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key="err" className="p-2 text-sm text-[var(--coral)]">
                    {item.title}
                  </li>
                )
              )}
            </ul>
            <div className="border-t border-[var(--mint-soft)] p-2">
              <button
                type="button"
                onClick={() => setEnrichId(null)}
                className="w-full rounded-lg border border-[var(--mint-soft)] py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
