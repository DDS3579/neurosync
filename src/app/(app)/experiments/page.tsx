import { EmptyState, PageHeader } from "@/components/nx";

export default function ExperimentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal experiments"
        description="Compare a baseline window with an intervention window on one metric you choose."
      />
      <EmptyState
        title="No experiments yet"
        description="The Experiment Lab will let you write a hypothesis, pick a metric, and review the two windows side by side once both have enough days."
      />
    </div>
  );
}
