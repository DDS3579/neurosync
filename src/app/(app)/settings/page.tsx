import { EmptyState, PageHeader } from "@/components/nx";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your sleep reference target, timer defaults, reduced motion, and local backup."
      />
      <EmptyState
        title="Settings UI not built yet"
        description="Defaults are stored locally already: a 8h sleep reference, 25 minute focus blocks, and 5 minute breaks. The form to change them comes with the settings build."
      />
    </div>
  );
}
