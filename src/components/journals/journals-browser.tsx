"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type JournalTemplateListItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isMandatorySanpin: boolean;
  isMandatoryHaccp: boolean;
};

type JournalsBrowserProps = {
  templates: JournalTemplateListItem[];
};

function normalizeSearchValue(value: string) {
  return value.toLocaleLowerCase("ru-RU").trim();
}

export function JournalsBrowser({ templates }: JournalsBrowserProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalizeSearchValue(deferredQuery);

  const filteredTemplates = normalizedQuery
    ? templates.filter((template) => {
        const searchableText = normalizeSearchValue(
          [template.name, template.description, template.code].filter(Boolean).join(" ")
        );

        return searchableText.includes(normalizedQuery);
      })
    : templates;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold">Журналы</h1>
          <p className="text-sm text-muted-foreground">
            Найдите журнал по названию, описанию или коду.
          </p>
        </div>

        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по журналам"
            aria-label="Поиск по журналам"
            className="h-11 rounded-xl pl-9 pr-11"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Очистить поиск"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {normalizedQuery ? (
          <p className="text-sm text-muted-foreground">
            Найдено: {filteredTemplates.length} из {templates.length}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Всего журналов: {templates.length}
          </p>
        )}
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
          <p className="text-base font-medium">Ничего не найдено</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Попробуйте изменить запрос или очистить поиск.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Link key={template.id} href={`/journals/${template.code}`}>
              <Card className="h-full cursor-pointer rounded-2xl transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <div className="flex shrink-0 gap-1">
                      {template.isMandatorySanpin ? (
                        <Badge
                          variant="destructive"
                          className="h-5 shrink-0 px-1.5 py-0 text-[10px]"
                        >
                          <ShieldCheck className="mr-0.5 size-3" />
                          СанПиН
                        </Badge>
                      ) : null}
                      {template.isMandatoryHaccp ? (
                        <Badge
                          variant="default"
                          className="h-5 shrink-0 px-1.5 py-0 text-[10px]"
                        >
                          <ShieldAlert className="mr-0.5 size-3" />
                          ХАССП
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  {template.description ? (
                    <CardDescription>{template.description}</CardDescription>
                  ) : null}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
