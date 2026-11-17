"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import {
  BRAIN_UI_PREFS_EVENT,
  DEFAULT_BRAIN_IMMERSIVE,
  UI_BRAIN_IMMERSIVE_KEY,
  readBrainImmersivePref,
  writeBrainImmersivePref,
} from "@/lib/ui/brainUiPrefs";

export interface ImmersiveBrainContextValue {
  /** True only when currently on `/brain`. */
  isBrainRoute: boolean;
  /** Persisted user preference (`ns:ui:v1:brain-immersive`, default true). */
  immersivePref: boolean;
  /** True when `/brain` is currently rendering in full-screen immersive mode. */
  isImmersive: boolean;
  /** Updates the persisted preference in localStorage. */
  setImmersivePref: (next: boolean) => void;
  /** Enters immersive mode for the current `/brain` visit. */
  enterImmersive: () => void;
  /** Exits immersive mode back to the standard layout for the current `/brain` visit. */
  exitImmersive: () => void;
  /** Opens the global Command Palette from immersive panels. */
  openCommandPalette: () => void;
}

const DEFAULT_CONTEXT: ImmersiveBrainContextValue = {
  isBrainRoute: false,
  immersivePref: DEFAULT_BRAIN_IMMERSIVE,
  isImmersive: false,
  setImmersivePref: writeBrainImmersivePref,
  enterImmersive: () => {},
  exitImmersive: () => {},
  openCommandPalette: () => {},
};

const ImmersiveBrainContext = createContext<ImmersiveBrainContextValue>(DEFAULT_CONTEXT);

function subscribeImmersivePref(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === UI_BRAIN_IMMERSIVE_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(BRAIN_UI_PREFS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BRAIN_UI_PREFS_EVENT, callback);
  };
}

export function ImmersiveBrainProvider({
  children,
  onOpenCommandPalette,
}: {
  children: ReactNode;
  onOpenCommandPalette?: () => void;
}) {
  const pathname = usePathname();
  const isBrainRoute = pathname === "/brain";

  const immersivePref = useSyncExternalStore(
    subscribeImmersivePref,
    readBrainImmersivePref,
    () => DEFAULT_BRAIN_IMMERSIVE,
  );

  // Scoped to the current route visit so navigating away and back honors the saved pref.
  const [override, setOverride] = useState<{ pathname: string; active: boolean } | null>(null);

  const effectiveOverride =
    override && override.pathname === pathname ? override.active : null;
  const isImmersive = isBrainRoute && (effectiveOverride ?? immersivePref);

  const setImmersivePref = useCallback((next: boolean) => {
    writeBrainImmersivePref(next);
    setOverride(null);
  }, []);

  const enterImmersive = useCallback(() => {
    setOverride({ pathname, active: true });
  }, [pathname]);

  const exitImmersive = useCallback(() => {
    setOverride({ pathname, active: false });
  }, [pathname]);

  const openCommandPalette = useCallback(() => {
    onOpenCommandPalette?.();
  }, [onOpenCommandPalette]);

  const value = useMemo<ImmersiveBrainContextValue>(
    () => ({
      isBrainRoute,
      immersivePref,
      isImmersive,
      setImmersivePref,
      enterImmersive,
      exitImmersive,
      openCommandPalette,
    }),
    [
      isBrainRoute,
      immersivePref,
      isImmersive,
      setImmersivePref,
      enterImmersive,
      exitImmersive,
      openCommandPalette,
    ],
  );

  return (
    <ImmersiveBrainContext.Provider value={value}>
      {children}
    </ImmersiveBrainContext.Provider>
  );
}

export function useImmersiveBrain(): ImmersiveBrainContextValue {
  return useContext(ImmersiveBrainContext);
}
