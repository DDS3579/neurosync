import type { ReactNode } from "react";
import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { A11yPrefsSync } from "@/components/app-shell/a11y-prefs-sync";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuroSync",
  description:
    "A privacy-first, neuroscience-informed tracker: educational brain atlas, honest daily logs, and small personal experiments.",
};

const INTRO_SEEN_HEAD_SCRIPT =
  "try{if(sessionStorage.getItem('ns:intro:v1')==='1')document.documentElement.dataset.intro='seen'}catch(e){}";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_SEEN_HEAD_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <A11yPrefsSync />
        {children}
      </body>
    </html>
  );
}
