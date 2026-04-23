"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognition;
    SpeechRecognition?: new () => SpeechRecognition;
  }
}

interface SpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

export function VoiceInput({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [recording, setRecording] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUnsupported(true);
      return;
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.lang = "ru-RU";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalTranscript = "";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.results.length - 1; i >= 0; i--) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interim = result[0].transcript;
        }
      }
      onChange(value + finalTranscript + interim);
    };

    rec.onerror = () => {
      setRecording(false);
    };

    rec.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }, [recording, value, onChange]);

  if (unsupported) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] focus:border-slate-400 focus:outline-none"
      />
    );
  }

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-[14px] focus:border-slate-400 focus:outline-none"
      />
      <button
        type="button"
        onClick={toggleRecording}
        className={`absolute right-2 top-2 rounded-full p-1.5 transition-colors ${
          recording
            ? "animate-pulse bg-red-500 text-white"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
        }`}
        title={recording ? "Остановить запись" : "Голосовой ввод"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </button>
      {recording ? (
        <div className="absolute right-2 top-10 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-white">
          Слушаем…
        </div>
      ) : null}
    </div>
  );
}
