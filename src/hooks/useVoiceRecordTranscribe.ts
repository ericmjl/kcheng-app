"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// Web Speech API types (for live transcript when available)
const SpeechRecognition =
  typeof window !== "undefined"
    ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition
    : undefined;

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  0?: { transcript: string };
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResult };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

export type VoiceRecordErrorType =
  | "not-allowed"
  | "no-audio"
  | "transcribe-failed"
  | "no-api-key"
  | "network"
  | "unsupported";

export interface UseVoiceRecordTranscribeResult {
  isSupported: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  /** Live transcript while recording (Web Speech), or empty if not available. */
  liveTranscript: string;
  error: VoiceRecordErrorType | null;
  startRecording: () => void;
  stopRecording: () => void;
  clearError: () => void;
}

const RECORD_MIME = "audio/webm";

function getSupportedMimeType(): string | null {
  if (typeof window === "undefined") return null;
  const types = [RECORD_MIME, "audio/mp4", "audio/ogg"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return RECORD_MIME;
}

export function useVoiceRecordTranscribe(options: {
  onTranscribed: (text: string) => void;
  lang?: string;
}): UseVoiceRecordTranscribeResult {
  const { onTranscribed, lang = "en-US" } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<VoiceRecordErrorType | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalSpeechRef = useRef("");
  const interimSpeechRef = useRef("");
  const speechFailedRef = useRef(false);
  const transcriptToUseOnStopRef = useRef<string | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator?.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined";

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    finalSpeechRef.current = "";
    interimSpeechRef.current = "";
    setLiveTranscript("");
  }, []);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      transcriptToUseOnStopRef.current = speechFailedRef.current
        ? null
        : (finalSpeechRef.current + " " + interimSpeechRef.current).trim() || null;
      mr.stop();
      mediaRecorderRef.current = null;
    }
    stopSpeechRecognition();
    setIsRecording(false);
  }, [stopSpeechRecognition]);

  const startRecording = useCallback(() => {
    if (!isSupported) {
      setError("unsupported");
      return;
    }
    setError(null);
    setLiveTranscript("");
    chunksRef.current = [];
    finalSpeechRef.current = "";
    interimSpeechRef.current = "";
    speechFailedRef.current = false;
    transcriptToUseOnStopRef.current = null;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        const mime = getSupportedMimeType();
        const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        mediaRecorderRef.current = mr;

        mr.ondataavailable = (e) => {
          if (e.data.size) chunksRef.current.push(e.data);
        };

        mr.onstop = () => {
          stopTracks();
          const useSpeech = transcriptToUseOnStopRef.current?.trim();
          if (useSpeech) {
            onTranscribed(useSpeech);
            setIsTranscribing(false);
            return;
          }
          if (chunksRef.current.length === 0) {
            setError("no-audio");
            return;
          }
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || RECORD_MIME });
          const form = new FormData();
          form.append("file", blob, "recording.webm");
          setIsTranscribing(true);
          fetch("/api/transcribe", {
            method: "POST",
            credentials: "include",
            body: form,
          })
            .then(async (res) => {
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                if (res.status === 503) setError("no-api-key");
                else setError("transcribe-failed");
                return;
              }
              const text = (data.transcript ?? "").trim();
              if (text) onTranscribed(text);
            })
            .catch(() => setError("transcribe-failed"))
            .finally(() => setIsTranscribing(false));
        };

        mr.start();
        setIsRecording(true);

        if (SpeechRecognition) {
          const rec = new SpeechRecognition() as SpeechRecognitionInstance;
          recognitionRef.current = rec;
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = lang;

          rec.onresult = (e: SpeechRecognitionEvent) => {
            let interim = "";
            let finalChunk = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const result = e.results[i];
              const t = result[0]?.transcript?.trim() ?? "";
              if (result.isFinal) {
                finalChunk += (finalChunk ? " " : "") + t;
              } else {
                interim += (interim ? " " : "") + t;
              }
            }
            if (finalChunk) {
              finalSpeechRef.current = (finalSpeechRef.current + " " + finalChunk).trim();
            }
            interimSpeechRef.current = interim;
            setLiveTranscript((finalSpeechRef.current + " " + interim).trim());
          };

          rec.onerror = (e: SpeechRecognitionErrorEvent) => {
            const err = (e.error || "unknown") as string;
            if (err === "aborted" || err === "no-speech") return;
            speechFailedRef.current = true;
            if (err === "not-allowed") setError("not-allowed");
            else if (err === "network") setError("network");
            else setError("unsupported");
            stopSpeechRecognition();
          };

          rec.onend = () => {
            if (recognitionRef.current === rec) {
              recognitionRef.current = null;
              setLiveTranscript("");
            }
          };

          try {
            rec.start();
          } catch {
            speechFailedRef.current = true;
          }
        }
      })
      .catch((e) => {
        if (e?.name === "NotAllowedError") setError("not-allowed");
        else setError("transcribe-failed");
      });
  }, [isSupported, lang, onTranscribed, stopTracks, stopSpeechRecognition]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      stopSpeechRecognition();
      stopTracks();
    };
  }, [stopTracks, stopSpeechRecognition]);

  const clearError = useCallback(() => setError(null), []);

  return {
    isSupported,
    isRecording,
    isTranscribing,
    liveTranscript,
    error,
    startRecording,
    stopRecording,
    clearError,
  };
}
