import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="relative z-10 border-t border-white/[0.08] bg-[#060913] px-5 py-10 sm:px-10 lg:px-16">
      <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#E6EAF5]">
            <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-[#22D3EE]" />
            NEUROSYNC
          </span>
          <p className="text-xs text-[#8A93AD]">
            NeuroSync is an educational and self-reflection tool, not a medical device.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-6">
          <Link
            href="/overview"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD] transition-colors hover:text-[#E6EAF5]"
          >
            Overview
          </Link>
          <Link
            href="/library"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD] transition-colors hover:text-[#E6EAF5]"
          >
            Library
          </Link>
          <Link
            href="/settings"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD] transition-colors hover:text-[#E6EAF5]"
          >
            Settings
          </Link>
        </nav>
      </div>
    </footer>
  );
}
