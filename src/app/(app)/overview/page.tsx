import { EmptyState, PageHeader } from "@/components/nx";

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Sleep, focus, movement, and how you felt, gathered in one calm view of the last few days."
      />
      <EmptyState
        title="Nothing logged yet"
        description="The trackers for sleep, check-ins, focus sessions, movement, and nutrition are not built yet. Once they are, your recent days will appear here."
      />
    </div>
  );
}
