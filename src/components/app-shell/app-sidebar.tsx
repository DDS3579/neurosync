"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActiveRoute, NAV_GROUPS, SETTINGS_ITEM, type NavItem } from "@/components/app-shell/nav-items";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";

function NavRow({ item, active, index }: { item: NavItem; active: boolean; index: number }) {
  const Icon = item.icon;
  const reduce = usePrefersReducedMotion();

  return (
    <SidebarMenuItem>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut", delay: index * 0.04 }}
      >
        <SidebarMenuButton
          asChild
          tooltip={item.label}
          className={cn(
            "h-9 rounded-l-none rounded-r-control border-l-2 border-transparent pl-2 text-body transition-colors duration-[180ms] ease-out",
            active
              ? "border-violet text-violet-text hover:bg-transparent hover:text-violet-text"
              : "text-muted-foreground hover:bg-transparent hover:text-foreground",
          )}
        >
          <Link href={item.href} aria-current={active ? "page" : undefined}>
            <Icon aria-hidden />
            <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </motion.div>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link
          href="/"
          className="flex items-baseline gap-2 overflow-hidden group-data-[collapsible=icon]:justify-center"
        >
          <span className="font-heading text-base font-semibold tracking-[-0.02em] whitespace-nowrap group-data-[collapsible=icon]:hidden">
            NeuroSync
          </span>
          <span className="hidden font-heading text-base font-semibold tracking-[-0.02em] group-data-[collapsible=icon]:block">
            N
          </span>
          <span className="font-mono text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
            v0.3
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group, groupIndex) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-caption tracking-[0.08em] text-muted-foreground uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item, itemIndex) => (
                  <NavRow
                    key={item.href}
                    item={item}
                    active={isActiveRoute(pathname, item.href)}
                    index={groupIndex * 3 + itemIndex}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-sidebar-border pt-2">
        <SidebarMenu>
          <NavRow
            item={SETTINGS_ITEM}
            active={isActiveRoute(pathname, SETTINGS_ITEM.href)}
            index={7}
          />
        </SidebarMenu>
        <p className="px-2 pb-2 text-[11px] leading-4 text-muted-foreground group-data-[collapsible=icon]:hidden">
          Everything stays in this browser.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
