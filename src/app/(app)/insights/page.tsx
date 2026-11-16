import { EmptyState, PageHeader } from "@/components/nx";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="Deterministic observations from your own logs, each with the data behind it and a caveat."
      />
      <EmptyState
        title="No insights yet"
        description="Observations need a few days of entries before they are shown, and they always describe patterns rather than causes."
      />
    </div>
  );
}
