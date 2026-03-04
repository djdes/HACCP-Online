"use client";

import { Info, AlertTriangle, BookOpen } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getFieldHint } from "@/lib/sanpin-norms";

interface FieldHintProps {
  templateCode: string;
  fieldKey: string;
}

export function FieldHint({ templateCode, fieldKey }: FieldHintProps) {
  const hint = getFieldHint(templateCode, fieldKey);
  if (!hint) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label="Подсказка СанПиН"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm" side="right" align="start">
        <div className="space-y-2">
          <p>{hint.hint}</p>
          {hint.norm && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground border-t pt-2">
              <BookOpen className="size-3 mt-0.5 shrink-0" />
              <span>{hint.norm}</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FieldWarningProps {
  templateCode: string;
  fieldKey: string;
  value: number | undefined;
}

export function FieldWarning({ templateCode, fieldKey, value }: FieldWarningProps) {
  const hint = getFieldHint(templateCode, fieldKey);
  if (!hint || value === undefined || value === null) return null;

  let warning = "";
  if (hint.warnBelow !== undefined && value < hint.warnBelow) {
    warning = `Значение ${value} ниже нормы (мин. ${hint.warnBelow})`;
  }
  if (hint.warnAbove !== undefined && value > hint.warnAbove) {
    warning = `Значение ${value} выше нормы (макс. ${hint.warnAbove})`;
  }

  if (!warning) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-md bg-yellow-50 border border-yellow-200 px-2.5 py-1.5 text-xs text-yellow-800">
      <AlertTriangle className="size-3.5 shrink-0 text-yellow-600" />
      <span>{warning}</span>
    </div>
  );
}
