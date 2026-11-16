import type { ReactNode } from "react";
import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { ReducedMotionProvider } from "@/components/app-shell/reduced-motion-sync";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuroSync",
  description:
    "A privacy-first, neuroscience-informed tracker: educational brain atlas, honest daily logs, and small personal experiments.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ReducedMotionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ReducedMotionProvider>
      </body>
    </html>
  );
}
