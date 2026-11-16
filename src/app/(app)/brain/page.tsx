"use client";

import { useState } from "react";

import { PageHeader } from "@/components/nx";
import BrainExplorer from "@/features/brain";
import type { RegionId } from "@/types/domain";

export default function BrainPage() {
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brain explorer"
        description="Seven regions with notes on what they are commonly associated with. Associations are educational context, not measurements of your brain."
      />
      <BrainExplorer
        mode="anatomy"
        selectedRegion={selectedRegion}
        activity={{}}
        onSelectRegion={setSelectedRegion}
        quality="auto"
      />
    </div>
  );
}
