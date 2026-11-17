import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { OnboardingDialog } from "@/components/app-shell/onboarding-dialog";
import { ReducedMotionProvider } from "@/components/app-shell/reduced-motion-sync";
import { ReminderRunner } from "@/components/app-shell/reminder-runner";
import { ServiceWorkerRegister } from "@/components/app-shell/service-worker-register";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ReducedMotionProvider>
      <TooltipProvider>
        <AppShell>
          {children}
          <OnboardingDialog />
          <ReminderRunner />
          <ServiceWorkerRegister />
          <Toaster theme="dark" position="bottom-right" />
        </AppShell>
      </TooltipProvider>
    </ReducedMotionProvider>
  );
}
