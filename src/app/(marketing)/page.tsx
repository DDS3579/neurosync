import type { Metadata } from "next";

import { LandingPage } from "@/features/landing/LandingPage";

const TITLE = "NeuroSync — An observatory for your inner universe";
const DESCRIPTION =
  "Explore an interactive 3D atlas of the brain, log sleep, focus, movement and mood in seconds, and discover personal associations locally in your browser.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "NeuroSync",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "NeuroSync",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function MarketingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD).replace(/</g, "\\u003c"),
        }}
      />
      <LandingPage />
    </>
  );
}
