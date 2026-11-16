import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { OnboardingDialog } from "@/components/app-shell/onboarding-dialog";
import { ReducedMotionProvider } from "@/components/app-shell/reduced-motion-sync";
import { ServiceWorkerRegister } from "@/components/app-shell/service-worker-register";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ReducedMotionProvider>
      <AppShell>
        {children}
        <OnboardingDialog />
        <ServiceWorkerRegister />
        <Toaster theme="dark" position="bottom-right" />
      </AppShell>
    </ReducedMotionProvider>
  );
}
