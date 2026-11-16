import { EmptyState, PageHeader } from "@/components/nx";

export default function FocusPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Focus"
        description="Planned focus sessions with a subject, a learning method, and how it actually felt."
      />
      <EmptyState
        title="No sessions yet"
        description="The session timer and its log will live here. Sessions will record planned versus actual minutes and the method you used."
      />
    </div>
  );
}
