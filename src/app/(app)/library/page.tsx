import { EmptyState, PageHeader } from "@/components/nx";

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Library"
        description="Short, careful explanations of the evidence behind the app: what is known, and what is not."
      />
      <EmptyState
        title="Reading list coming next"
        description="The educational entries in data/library.ts are ready; the reading view that renders them is not built yet."
      />
    </div>
  );
}
