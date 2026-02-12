"use client";

import { useState, useRef, useCallback } from "react";
import { ensureAnonymousAuth, isFirebaseConfigured } from "@/lib/firebase";

type Props = {
  contactId: string;
  contactName: string;
  eventId?: string;
  onSaved?: () => void;
};

export function MeetingRecorder({
  contactId,
  contactName,
  eventId,
  onSaved,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [hasChunks, setHasChunks] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [summarizing, setSummarizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(() => {
    chunksRef.current = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setHasChunks(chunksRef.current.length > 0);
      };
      mr.start();
      setRecording(true);
    }).catch((e) => {
      console.error(e);
    });
  }, []);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
      setRecording(false);
    }
  }, []);

  async function uploadAndTranscribe() {
    if (chunksRef.current.length === 0) return;
    setUploading(true);
    setTranscript("");
    try {
      const user = await ensureAnonymousAuth();
      if (!user) return;
      const token = await user.getIdToken();
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        setTranscript(data.transcript ?? "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  }

  async function summarizeTranscript() {
    if (!transcript.trim()) return;
    setSummarizing(true);
    try {
      const user = await ensureAnonymousAuth();
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch("/api/dossiers/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transcript }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary ?? "");
        setActionItems(data.actionItems ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSummarizing(false);
    }
  }

  async function saveDossier() {
    if (!isFirebaseConfigured()) return;
    setSaving(true);
    try {
      const user = await ensureAnonymousAuth();
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch("/api/dossiers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contactId,
          eventId: eventId || undefined,
          transcript: transcript || undefined,
          summary: summary || undefined,
          actionItems: actionItems.length ? actionItems : undefined,
        }),
      });
      if (res.ok) {
        setTranscript("");
        setSummary("");
        setActionItems([]);
        chunksRef.current = [];
        setHasChunks(false);
        onSaved?.();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const hasRecording = chunksRef.current.length > 0 || transcript;
  const canSave = transcript.trim() && contactId;

  return (
    <div className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] p-4">
      <h3 className="mb-2 font-medium text-[var(--text)]">Record meeting</h3>
      <p className="mb-3 text-sm text-[var(--text-muted)]">
        Record with {contactName}, then transcribe and save as a dossier.
      </p>
      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            className="rounded bg-red-600/80 px-3 py-1.5 text-sm text-[var(--text)] hover:bg-red-600"
          >
            Start recording
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded bg-[var(--mint)] px-3 py-1.5 text-sm text-[var(--text)] hover:opacity-90"
          >
            Stop recording
          </button>
        )}
        {!recording && hasChunks && (
          <button
            type="button"
            onClick={uploadAndTranscribe}
            disabled={uploading}
            className="rounded bg-[var(--mint)] px-3 py-1.5 text-sm text-[var(--text)] hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? "Transcribing…" : "Transcribe"}
          </button>
        )}
      </div>
      {uploading && <p className="mt-2 text-sm text-[var(--text)]0">Uploading and transcribing…</p>}
      {transcript && (
        <div className="mt-3">
          <p className="mb-1 text-sm font-medium text-[var(--text-muted)]">Transcript</p>
          <p className="max-h-40 overflow-y-auto rounded bg-[var(--cream)] p-2 text-sm text-[var(--text-muted)] whitespace-pre-wrap">
            {transcript}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={summarizeTranscript}
              disabled={summarizing}
              className="rounded border border-[var(--mint-soft)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)] disabled:opacity-50"
            >
              {summarizing ? "Summarizing…" : "Summarize with AI"}
            </button>
            {canSave && (
              <button
                type="button"
                onClick={saveDossier}
                disabled={saving}
                className="rounded bg-[var(--mint)] px-3 py-1.5 text-sm text-[var(--text)] hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save dossier"}
              </button>
            )}
          </div>
          {summary && (
            <div className="mt-2 text-sm text-[var(--text-muted)]">
              <p className="font-medium text-[var(--text-muted)]">Summary</p>
              <p className="mt-1">{summary}</p>
              {actionItems.length > 0 && (
                <>
                  <p className="mt-2 font-medium text-[var(--text-muted)]">Action items</p>
                  <ul className="mt-1 list-disc pl-4">
                    {actionItems.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
