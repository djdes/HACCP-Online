"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice-input для textarea. Использует Web Speech API (Chrome/Safari)
 * для real-time транскрипции на родном устройстве — без отправки аудио
 * на сервер. На неподдерживаемых браузерах (часть Telegram WebApp на
 * iOS, Firefox) деградирует в обычный textarea.
 *
 * Race fix (decemberreview-find P0 #2): finalTranscript храним в ref
 * (а не в `let` внутри toggleRecording), и при `onresult` берём
 * стартовое value из props через ref'у. Без этого fix'а каждый
 * следующий final-event дублировал прошлый текст: `value` в closure
 * был stale, и `onChange(value + finalTranscript + interim)` каждый
 * раз перезаписывал свежие правки пользователя.
 */

// Web Speech API — declare global уже сделан в src/components/journals/voice-input.tsx
// (shared, поток 1), плюс TypeScript 5.6+ может ship'ить встроенные типы.
// Дублировать interface Window — конфликт TS2717. Используем структурную
// типизацию через cast: `window as unknown as { ... }` — никакой
// global-declarations не делаем, локальные types для events.
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Базовое значение textarea на момент старта записи — все final/interim
  // транскрипты дописываются именно к нему, чтобы не было «снежного кома»
  // (см. JSDoc выше: stale-closure caused doubling).
  const baseValueRef = useRef<string>("");
  // Накопленные final-фрагменты текущей сессии записи. Reset на старте.
  const finalAccRef = useRef<string>("");

  useEffect(() => {
    if (!getSpeechRecognitionCtor()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnsupported(true);
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = "ru-RU";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    // Зафиксировать базу один раз — больше «эффекта снежного кома».
    baseValueRef.current = value;
    finalAccRef.current = "";

    rec.onresult = (event) => {
      // Iterate forward from event.resultIndex — Web Speech API кладёт
      // в `event.results` накопленный массив за всю сессию, но `resultIndex`
      // указывает первый НОВЫЙ result в этом конкретном событии. Берём
      // только новые final'ы и текущий interim, чтобы не дублировать.
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalAccRef.current += transcript + " ";
        } else {
          interim = transcript;
        }
      }
      onChange(baseValueRef.current + finalAccRef.current + interim);
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
