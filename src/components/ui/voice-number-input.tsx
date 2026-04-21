"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseRussianNumber } from "@/lib/russian-number-parser";

type SpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
  resultIndex: number;
};
type SpeechRecognitionErrorLike = { error?: string };
type Ctor = { new (): SpeechRecognition };

function getSpeechCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: Ctor;
    webkitSpeechRecognition?: Ctor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceNumberInputProps = {
  /** Текущее значение в поле. */
  value: number | "" | null;
  /** Вызывается с распознанным числом (или `null`, если очистили голосом). */
  onChange: (next: number | null) => void;
  /** id связанного <input>. Кнопка будет помечена как его control. */
  inputId?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Кнопка-микрофон для голосового ввода числа (температура, влажность,
 * вес партии). Использует Web Speech API (webkitSpeechRecognition).
 *
 * UX: один тап — началась запись, индикатор «слушаю», второй тап или
 * пауза — остановилась, распознано число, вызывается onChange.
 * Если браузер не поддерживает — кнопка прячется (return null), поле
 * работает как обычный number input.
 */
export function VoiceNumberInput({
  value: _value,
  onChange,
  inputId,
  className,
  disabled,
}: VoiceNumberInputProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const ctor = getSpeechCtor();
    setSupported(ctor !== null);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, []);

  if (!supported) return null;

  function start() {
    const ctor = getSpeechCtor();
    if (!ctor) return;
    const rec = new ctor();
    rec.lang = "ru-RU";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onresult = (event) => {
      let best: { transcript: string; number: number } | null = null;
      const result = event.results[event.resultIndex];
      for (let i = 0; i < result.length; i++) {
        const alt = result[i];
        const parsed = parseRussianNumber(alt.transcript);
        if (parsed !== null && (best === null || i === 0)) {
          best = { transcript: alt.transcript, number: parsed };
          break;
        }
      }
      if (best) {
        onChange(best.number);
        setHint(`${best.transcript.trim()} → ${best.number}`);
      } else {
        const raw = result[0]?.transcript ?? "";
        setError(
          `Не распознал число в «${raw.trim() || "…"}». Скажите ещё раз, например «два и восемь».`
        );
      }
    };
    rec.onerror = (event) => {
      const code = event.error ?? "unknown";
      setError(
        code === "not-allowed" || code === "service-not-allowed"
          ? "Нужно разрешение на микрофон. Проверьте настройки браузера."
          : code === "no-speech"
            ? "Не слышно. Попробуйте ещё раз."
            : `Ошибка распознавания: ${code}`
      );
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    try {
      recognitionRef.current = rec;
      setError(null);
      setHint(null);
      rec.start();
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить");
    }
  }

  function stop() {
    recognitionRef.current?.stop?.();
  }

  return (
    <div className={cn("flex flex-col items-stretch gap-1", className)}>
      <button
        type="button"
        aria-controls={inputId}
        aria-pressed={listening}
        aria-label={listening ? "Остановить запись" : "Голосовой ввод"}
        title={
          listening
            ? "Слушаю… Скажите «два и восемь» или «минус три»"
            : "Голосовой ввод температуры"
        }
        disabled={disabled}
        onClick={listening ? stop : start}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border transition-all",
          listening
            ? "animate-pulse border-[#d2453d] bg-[#fff4f2] text-[#d2453d]"
            : "border-[#dcdfed] bg-white text-[#5566f6] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </button>
      {(hint || error) && (
        <div
          className={cn(
            "max-w-[220px] text-[11px] leading-tight",
            error ? "text-[#d2453d]" : "text-[#116b2a]"
          )}
        >
          {error ?? hint}
        </div>
      )}
    </div>
  );
}
