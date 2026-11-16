import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-4">
        <p className="font-mono text-xs tracking-wide text-cyan uppercase">
          Local-first · no account
        </p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance">
          NeuroSync
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          A privacy-first, neuroscience-informed tracker: an educational brain atlas, honest daily
          logs, and small personal experiments. Everything is stored in your browser.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/overview">Open the app</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/brain">Browse the atlas</Link>
        </Button>
      </div>

      <p className="max-w-xl text-xs text-muted-foreground">
        Region notes are educational associations, never measurements of your brain. This app does
        not diagnose anything and makes no network requests with your data.
      </p>
    </main>
  );
}
