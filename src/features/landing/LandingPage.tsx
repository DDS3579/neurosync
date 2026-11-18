"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";

import { ServiceWorkerRegister } from "@/components/app-shell/service-worker-register";
import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { useIsMobile } from "@/hooks/use-mobile";
import { Atmosphere } from "./Atmosphere";
import { BrainPoster } from "./BrainPoster";
import { DescentSection } from "./DescentSection";
import { HeroSection } from "./HeroSection";
import { InViewSection } from "./InViewSection";
import { IntroLoader } from "./intro/IntroLoader";
import { useBrainReadiness } from "./intro/useBrainReadiness";
import { LandingFooter } from "./LandingFooter";
import { LandingHeader } from "./LandingHeader";
import { SmoothScroll, useSmoothScroll } from "./SmoothScroll";
import { useScrollProgress } from "./useScrollProgress";

const DynamicBrainHero = dynamic(
  () => import("@/features/brain/BrainHero").then((m) => m.BrainHero),
  {
    ssr: false,
    loading: () => <BrainPoster className="absolute inset-0" />,
  },
);

const DynamicInstrumentsSection = dynamic(() =>
  import("./InstrumentsSection").then((m) => m.InstrumentsSection),
);
const DynamicHonestScienceSection = dynamic(() =>
  import("./HonestScienceSection").then((m) => m.HonestScienceSection),
);
const DynamicExperimentTeaserSection = dynamic(() =>
  import("./ExperimentTeaserSection").then((m) => m.ExperimentTeaserSection),
);
const DynamicPrivacySection = dynamic(() =>
  import("./PrivacySection").then((m) => m.PrivacySection),
);
const DynamicFinalCtaFooter = dynamic(() =>
  import("./FinalCtaFooter").then((m) => m.FinalCtaFooter),
);

/**
 * Full NeuroSync observatory landing page:
 * Global atmosphere + minimal scroll-aware header +
 * sticky WebGL particle brain (Hero + Descent) + lazily loaded below-the-fold sections
 * (Three Instruments, Honest Science, Experiment Teaser, Privacy, Final CTA) + Footer.
 */
export function LandingPage() {
  return (
    <SmoothScroll>
      <LandingContent />
    </SmoothScroll>
  );
}

function LandingContent() {
  const descentRef = useRef<HTMLElement>(null);
  const skipLinkRef = useRef<HTMLAnchorElement>(null);
  const wasLockedRef = useRef(false);
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const { setScrollLocked } = useSmoothScroll();
  const {
    state: introState,
    handleBrainProgress,
    handleBrainReady,
    skipIntro,
  } = useBrainReadiness();

  const lockLanding =
    introState.variant === "full" &&
    (introState.phase === "idle" || introState.phase === "loading" || introState.phase === "ready");

  // Under reduced motion LandingPage renders the static BrainPoster instead of WebGL DynamicBrainHero,
  // so mark the hero stage ready directly once fonts/poster are mounted.
  useEffect(() => {
    if (!reducedMotion) return;
    handleBrainProgress({ stage: "firstFrame", value: 1 });
    handleBrainReady();
  }, [reducedMotion, handleBrainProgress, handleBrainReady]);

  // Lock page scroll + Lenis while full First Light overlay covers viewport; restore cleanly on exit.
  useEffect(() => {
    setScrollLocked(lockLanding);
    if (!lockLanding) return;

    wasLockedRef.current = true;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [lockLanding, setScrollLocked]);

  // Move focus cleanly to the skip link / landing start after exit completes.
  useEffect(() => {
    if (lockLanding || !wasLockedRef.current) return;
    if (introState.phase !== "done" && introState.phase !== "skipped") return;

    wasLockedRef.current = false;
    const id = window.requestAnimationFrame(() => {
      const target = skipLinkRef.current ?? document.getElementById("main-content");
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [lockLanding, introState.phase]);

  const progress = useScrollProgress(descentRef, {
    start: "top top",
    end: () => `+=${Math.round(window.innerHeight * (isMobile ? 2 : 3))}`,
    disabled: reducedMotion,
    refreshKey: `${isMobile}-${reducedMotion}`,
  });

  const headlineActive = reducedMotion || introState.headlineReleased;

  return (
    <>
      <IntroLoader state={introState} onSkip={skipIntro} />
      <ServiceWorkerRegister />
      <div
        inert={lockLanding || undefined}
        aria-hidden={lockLanding ? "true" : undefined}
        className="relative min-h-svh w-full overflow-x-clip bg-background text-foreground"
      >
        <a
          ref={skipLinkRef}
          id="skip-to-content"
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:border focus:border-cyan focus:bg-surface focus:px-4 focus:py-2 focus:text-body focus:font-medium focus:text-foreground focus:shadow-lg"
        >
          Skip to content
        </a>
        <Atmosphere />
        <LandingHeader />

        <main id="main-content" tabIndex={-1} className="relative w-full outline-none">
          {reducedMotion ? (
            <>
              <div className="relative">
                <div aria-hidden="true" className="absolute inset-0 z-0">
                  <BrainPoster />
                </div>
                <div className="relative z-10">
                  <HeroSection headlineActive={headlineActive} />
                </div>
              </div>
              <DescentSection
                ref={descentRef}
                progress={0}
                isMobile={isMobile}
                reducedMotion
              />
            </>
          ) : (
            <div className="relative">
              {/* Sticky 100svh BrainHero stage shared across Hero and Descent */}
              <div className="sticky top-0 z-0 h-svh w-full overflow-hidden">
                <BrainPoster className="absolute inset-0" />
                <DynamicBrainHero
                  progress={progress}
                  interactive={!isMobile}
                  onProgress={handleBrainProgress}
                  onReady={handleBrainReady}
                  className="absolute inset-0 h-full w-full rounded-none border-0 bg-transparent sm:h-full"
                />
              </div>

              {/* Scrollable foreground layers over the sticky brain stage */}
              <div className="pointer-events-none relative z-10 -mt-[100svh]">
                <HeroSection headlineActive={headlineActive} />
                <DescentSection
                  ref={descentRef}
                  progress={progress}
                  isMobile={isMobile}
                  reducedMotion={false}
                />
              </div>
            </div>
          )}

          <InViewSection id="instruments" minHeightClass="min-h-[300svh]">
            <DynamicInstrumentsSection />
          </InViewSection>
          <InViewSection id="honest-science" minHeightClass="min-h-[60svh]">
            <DynamicHonestScienceSection />
          </InViewSection>
          <InViewSection id="experiments" minHeightClass="min-h-[65svh]">
            <DynamicExperimentTeaserSection />
          </InViewSection>
          <InViewSection id="privacy" minHeightClass="min-h-[55svh]">
            <DynamicPrivacySection />
          </InViewSection>
          <InViewSection id="ready" minHeightClass="min-h-[70svh]">
            <DynamicFinalCtaFooter />
          </InViewSection>
        </main>

        <LandingFooter />
      </div>
    </>
  );
}
