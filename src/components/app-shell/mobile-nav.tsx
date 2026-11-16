"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { isActiveRoute, MOBILE_NAV_ITEMS, type NavItem } from "@/components/app-shell/nav-items";
import { cn } from "@/lib/utils";

function MobileTab({ item, active, index }: { item: NavItem; active: boolean; index: number }) {
  const Icon = item.icon;
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut", delay: index * 0.04 }}
    >
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 flex-col items-center justify-center gap-1 rounded-control py-2 text-caption transition-colors duration-[180ms] ease-out",
          active ? "text-violet" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden />
        <span>{item.label}</span>
      </Link>
    </motion.div>
  );
}

export function MobileNav({ onQuickLog }: { onQuickLog: () => void }) {
  const pathname = usePathname();
  const [first, second, third, fourth] = MOBILE_NAV_ITEMS;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="relative grid grid-cols-5 items-center px-2">
        {first ? (
          <MobileTab item={first} active={isActiveRoute(pathname, first.href)} index={0} />
        ) : null}
        {second ? (
          <MobileTab item={second} active={isActiveRoute(pathname, second.href)} index={1} />
        ) : null}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onQuickLog}
            aria-label="Log today"
            className="-mt-6 flex size-12 items-center justify-center rounded-full bg-violet text-white transition-colors duration-[180ms] ease-out hover:bg-violet/90"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>

        {third ? (
          <MobileTab item={third} active={isActiveRoute(pathname, third.href)} index={2} />
        ) : null}
        {fourth ? (
          <MobileTab item={fourth} active={isActiveRoute(pathname, fourth.href)} index={3} />
        ) : null}
      </div>
    </nav>
  );
}
