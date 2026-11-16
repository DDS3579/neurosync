import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppTopbar() {
  return (
    <header className="flex h-12 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger />
      <p className="text-xs text-muted-foreground">Local-first · data stays in this browser</p>
    </header>
  );
}
