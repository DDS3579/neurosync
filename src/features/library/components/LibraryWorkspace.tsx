"use client";

import { useMemo, useState } from "react";
import { BookOpen, Info, Search } from "lucide-react";

import { EmptyState, PageHeader, RegionBadge } from "@/components/nx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LibraryCategory, LibraryEntry } from "@/data/library";

const CATEGORY_OPTIONS: ReadonlyArray<{ value: LibraryCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "region", label: "Brain regions" },
  { value: "sleep", label: "Sleep" },
  { value: "learning", label: "Learning" },
  { value: "movement", label: "Movement" },
  { value: "nutrition", label: "Nutrition" },
  { value: "wellbeing", label: "Wellbeing" },
];

export interface LibraryWorkspaceProps {
  entries: LibraryEntry[];
}

export function LibraryWorkspace({ entries }: LibraryWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LibraryCategory | "all">("all");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (category !== "all" && entry.category !== category) return false;
      if (!q) return true;
      const haystack = [
        entry.title,
        entry.summary,
        entry.caveat,
        ...entry.body,
        ...entry.keyPoints,
        ...(entry.relatedRegions ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, query, category]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Library"
        description="Short, careful explanations of the ideas behind NeuroSync — what is known, what varies, and explicit caveats."
      />

      {/* Search & Category filter */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Label htmlFor="library-search" className="sr-only">
            Search library entries
          </Label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search regions, sleep, learning, caveats..."
            className="rounded-control border-border bg-surface pl-9"
          />
        </div>

        <div
          role="group"
          aria-label="Filter library by topic"
          className="flex flex-wrap gap-1.5"
        >
          {CATEGORY_OPTIONS.map((opt) => {
            const active = category === opt.value;
            return (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => setCategory(opt.value)}
                className="rounded-chip"
              >
                {opt.label}
              </Button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="No matching articles"
          description="Try a different keyword or clear the topic filter to browse everything."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
              className="rounded-control"
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((entry) => {
            const expanded = Boolean(expandedIds[entry.id]);
            const bodyId = `library-body-${entry.id}`;

            return (
              <Card
                key={entry.id}
                id={entry.id}
                className="flex scroll-mt-20 flex-col gap-0 rounded-card border border-border bg-surface py-0 shadow-none"
              >
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className="border-border bg-surface-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cyan"
                    >
                      {entry.category}
                    </Badge>
                    {entry.relatedRegions && entry.relatedRegions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {entry.relatedRegions.map((r) => (
                          <RegionBadge key={r} region={r} />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <h2 className="text-section font-medium text-foreground">{entry.title}</h2>
                  <p className="text-body text-muted-foreground">{entry.summary}</p>

                  {entry.keyPoints.length > 0 ? (
                    <ul className="space-y-1 text-caption text-foreground/85">
                      {entry.keyPoints.map((pt) => (
                        <li key={pt} className="flex gap-2">
                          <span aria-hidden className="text-cyan">
                            ·
                          </span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-expanded={expanded}
                      aria-controls={bodyId}
                      onClick={() =>
                        setExpandedIds((prev) => ({
                          ...prev,
                          [entry.id]: !prev[entry.id],
                        }))
                      }
                      className="px-0 text-caption font-medium text-cyan hover:bg-transparent hover:text-cyan/80"
                    >
                      {expanded ? "Hide full note" : "Read full note"}
                    </Button>

                    {expanded ? (
                      <div id={bodyId} className="mt-2 space-y-2.5 text-body text-muted-foreground">
                        {entry.body.map((para, idx) => (
                          <p key={idx}>{para}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-auto flex items-start gap-2 border-t border-border px-5 py-3">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="text-caption text-muted-foreground">{entry.caveat}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
