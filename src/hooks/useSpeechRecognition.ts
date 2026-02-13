"use client";

import { useState, useCallback, useRef, useEffect } from "react";

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
  onaudiostart: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  0?: { transcript: string };
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { length: number; item(i: number): SpeechRecognitionResult; [i: number]: SpeechRecognitionResult };
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

export type SpeechRecognitionErrorType =
  | "not-allowed"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "aborted"
  | "unsupported";

export interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: SpeechRecognitionErrorType | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  clearError: () => void;
}

export function useSpeechRecognition(options?: { lang?: string }): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<SpeechRecognitionErrorType | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef("");

  const isSupported = Boolean(SpeechRecognition);

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.abort();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError("unsupported");
      return;
    }
    setError(null);
    finalTranscriptRef.current = transcript || finalTranscriptRef.current;
    const rec = new SpeechRecognition() as SpeechRecognitionInstance;
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = options?.lang ?? "en-US";

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
        finalTranscriptRef.current = (finalTranscriptRef.current + (finalTranscriptRef.current ? " " : "") + finalChunk).trim();
        setTranscript(finalTranscriptRef.current);
      }
      setInterimTranscript(interim);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      const err = (e.error || "unknown") as string;
      if (err === "aborted" || err === "no-speech") {
        setError(null);
      } else if (err === "not-allowed") {
        setError("not-allowed");
      } else if (err === "network") {
        setError("network");
      } else if (err === "audio-capture") {
        setError("audio-capture");
      } else {
        setError("unsupported");
      }
      stopListening();
    };

    rec.onend = () => {
      if (recognitionRef.current === rec) {
        setIsListening(false);
        setInterimTranscript("");
        recognitionRef.current = null;
      }
    };

    try {
      rec.start();
      setIsListening(true);
    } catch (err) {
      setError("unsupported");
      recognitionRef.current = null;
    }
  }, [options?.lang, transcript, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    clearError,
  };
}
