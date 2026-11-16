import { EmptyState, PageHeader } from "@/components/nx";

export default function HabitsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Habits"
        description="Behaviours you want to keep an eye on, without scores, loss aversion, or streak pressure."
      />
      <EmptyState
        title="No habits yet"
        description="Your own habits and the daily sleep, movement, and nutrition check-ins will be managed from here."
      />
    </div>
  );
}
