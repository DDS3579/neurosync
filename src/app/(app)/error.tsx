"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[NeuroSync app error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-12">
      <Card
        role="alert"
        className="space-y-4 rounded-card border border-border bg-surface p-6 shadow-none"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-cyan">
            <AlertCircle className="size-4" aria-hidden />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-section font-medium text-foreground">Something went wrong</h1>
            <p className="text-body text-muted-foreground">
              This view ran into an unexpected local error. Your saved entries remain in your
              browser storage.
            </p>
            {error.message ? (
              <p className="rounded-control border border-border bg-surface-2 px-3 py-2 font-mono text-caption text-muted-foreground">
                {error.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Button type="button" onClick={reset} className="gap-1.5 rounded-control">
            <RotateCcw className="size-3.5" aria-hidden />
            Try again
          </Button>
          <Button variant="outline" asChild className="rounded-control border-border bg-surface-2">
            <Link href="/overview">Back to overview</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
