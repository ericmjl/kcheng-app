"use client";

import { useState, useEffect, useCallback } from "react";
import { vCardToContact } from "@/lib/vcard";
import { cachedGet } from "@/lib/cachedFetch";
import type { Contact } from "@/lib/types";
import Link from "next/link";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [vCardPaste, setVCardPaste] = useState("");
  const [vCardError, setVCardError] = useState("");
  const [form, setForm] = useState({
    name: "",
    company: "",
    role: "",
    phone: "",
    email: "",
    stockTicker: "",
    notes: "",
  });

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

  useEffect(() => {
    const onDataChanged = () => loadContacts();
    window.addEventListener("trip-assistant:data-changed", onDataChanged);
    return () => window.removeEventListener("trip-assistant:data-changed", onDataChanged);
  }, [loadContacts]);

  function openNew() {
    setEditing(null);
    setSelected(null);
    setForm({
      name: "",
      company: "",
      role: "",
      phone: "",
      email: "",
      stockTicker: "",
      notes: "",
    });
    setEditing({ id: "", name: "", eventIds: [], createdAt: "", updatedAt: "" });
  }

  function openEdit(c: Contact) {
    setSelected(c);
    setEditing(c);
    setForm({
      name: c.name,
      company: c.company ?? "",
      role: c.role ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      stockTicker: c.stockTicker ?? "",
      notes: c.notes ?? "",
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
        setSelected(null);
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
      if (selected?.id === id) setSelected(null);
      setEditing(null);
    }
  }

  function fillFromVCard() {
    setVCardError("");
    if (!vCardPaste.trim()) return;
    try {
      const partial = vCardToContact(vCardPaste);
      setForm({
        name: partial.name ?? "",
        company: partial.company ?? "",
        role: partial.role ?? "",
        phone: partial.phone ?? "",
        email: partial.email ?? "",
        stockTicker: form.stockTicker,
        notes: partial.notes ?? "",
      });
      setEditing({ id: "", name: partial.name ?? "", eventIds: [], createdAt: "", updatedAt: "" });
      setVCardPaste("");
    } catch (err) {
      setVCardError("Could not parse vCard. Paste the full contact card text.");
    }
  }

  function handleVCardFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      try {
        const partial = vCardToContact(text);
        setForm({
          name: partial.name ?? "",
          company: partial.company ?? "",
          role: partial.role ?? "",
          phone: partial.phone ?? "",
          email: partial.email ?? "",
          stockTicker: form.stockTicker,
          notes: partial.notes ?? "",
        });
        setEditing({
          id: "",
          name: partial.name ?? "",
          eventIds: [],
          createdAt: "",
          updatedAt: "",
        });
        setVCardError("");
      } catch {
        setVCardError("Could not parse vCard file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
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
          className="rounded bg-[var(--mint)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:opacity-90"
        >
          Add contact
        </button>
      </div>

      {/* vCard import */}
      <div className="mb-6 rounded border border-[var(--mint-soft)] bg-[var(--cream)] p-4">
        <h2 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Import from vCard</h2>
        <p className="mb-2 text-xs text-[var(--text)]0">
          Paste a contact card (e.g. from a message) or upload a .vcf file.
        </p>
        <textarea
          placeholder="Paste vCard text here (BEGIN:VCARD ... END:VCARD)"
          value={vCardPaste}
          onChange={(e) => setVCardPaste(e.target.value)}
          rows={3}
          className="mb-2 w-full rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fillFromVCard}
            className="rounded bg-[var(--mint)] px-3 py-1.5 text-sm text-[var(--text)] hover:opacity-90"
          >
            Parse and fill
          </button>
          <label className="cursor-pointer rounded border border-[var(--mint-soft)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]">
            Upload .vcf file
            <input
              type="file"
              accept=".vcf,.vcard"
              className="hidden"
              onChange={handleVCardFile}
            />
          </label>
        </div>
        {vCardError && <p className="mt-2 text-sm text-[var(--coral)]">{vCardError}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto rounded border border-[var(--mint-soft)] bg-[var(--cream)] p-2">
          {contacts.length === 0 && (
            <li className="px-3 py-2 text-sm text-[var(--text)]0">No contacts yet.</li>
          )}
          {contacts.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(c);
                  setEditing(null);
                }}
                className={`w-full rounded px-3 py-2 text-left text-sm ${
                  selected?.id === c.id ? "bg-[var(--mint)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
                }`}
              >
                {c.name}
                {c.company && (
                  <span className="block truncate text-xs text-[var(--text)]0">{c.company}</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <div>
          {editing ? (
            <form onSubmit={saveContact} className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] p-4">
              <h2 className="mb-3 font-medium text-[var(--text)]">
                {editing.id ? "Edit contact" : "New contact"}
              </h2>
              <div className="space-y-3">
                <input
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
                  required
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    placeholder="Company"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    className="w-full rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
                  />
                  <input
                    placeholder="Role"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
                  />
                </div>
                <input
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
                />
                <input
                  placeholder="Stock ticker (for company trends)"
                  value={form.stockTicker}
                  onChange={(e) => setForm((f) => ({ ...f, stockTicker: e.target.value }))}
                  className="w-full rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
                />
                <textarea
                  placeholder="Notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  className="rounded bg-[var(--mint)] px-4 py-2 text-sm text-[var(--text)] hover:opacity-90"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded border border-[var(--mint-soft)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
                >
                  Cancel
                </button>
                {editing.id && (
                  <button
                    type="button"
                    onClick={() => editing.id && deleteContact(editing.id)}
                    className="rounded px-4 py-2 text-sm text-[var(--coral)] hover:bg-[var(--peach)]/30"
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          ) : selected ? (
            <div className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] p-4">
              <div className="mb-3 flex items-start justify-between">
                <h2 className="text-lg font-medium text-[var(--text)]">{selected.name}</h2>
                <button
                  type="button"
                  onClick={() => openEdit(selected)}
                  className="text-sm text-[var(--text-muted)] hover:underline"
                >
                  Edit
                </button>
              </div>
              {(selected.company || selected.role) && (
                <p className="text-sm text-[var(--text-muted)]">
                  {[selected.company, selected.role].filter(Boolean).join(" · ")}
                </p>
              )}
              {selected.phone && (
                <p className="mt-1 text-sm text-[var(--text-muted)]">Phone: {selected.phone}</p>
              )}
              {selected.email && (
                <p className="text-sm text-[var(--text-muted)]">Email: {selected.email}</p>
              )}
              {selected.stockTicker && (
                <p className="text-sm text-[var(--text)]0">Ticker: {selected.stockTicker}</p>
              )}
              {selected.notes && (
                <p className="mt-2 text-sm text-[var(--text-muted)]">{selected.notes}</p>
              )}
              {selected.eventIds?.length > 0 && (
                <p className="mt-2 text-xs text-[var(--text)]0">
                  Linked to {selected.eventIds.length} event(s)
                </p>
              )}
              <Link
                href={`/contacts/${selected.id}`}
                className="mt-3 inline-block text-sm text-[var(--text-muted)] hover:underline"
              >
                View full profile & meeting dossiers →
              </Link>
            </div>
          ) : (
            <p className="text-[var(--text-muted)]">Select a contact or add a new one.</p>
          )}
        </div>
      </div>
    </main>
  );
}
