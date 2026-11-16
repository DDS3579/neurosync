import {
  Brain,
  FlaskConical,
  LayoutDashboard,
  Library,
  ListChecks,
  Settings,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Today",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/habits", label: "Daily Habits", icon: ListChecks },
      { href: "/focus", label: "Focus Lab", icon: Timer },
    ],
  },
  {
    label: "Explore",
    items: [
      { href: "/brain", label: "Brain Explorer", icon: Brain },
      { href: "/insights", label: "Insights", icon: Sparkles },
      { href: "/experiments", label: "Experiments", icon: FlaskConical },
      { href: "/library", label: "Library", icon: Library },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
};

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_ITEM,
];

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/brain", label: "Brain", icon: Brain },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/insights", label: "Insights", icon: Sparkles },
];

const ROUTE_TITLES: Record<string, string> = Object.fromEntries(
  ALL_NAV_ITEMS.map((item) => [item.href, item.label]),
);

export function routeTitle(pathname: string): string {
  const exact = ROUTE_TITLES[pathname];
  if (exact) return exact;

  const parent = Object.keys(ROUTE_TITLES).find((href) =>
    pathname.startsWith(`${href}/`),
  );

  return parent ? (ROUTE_TITLES[parent] ?? "NeuroSync") : "NeuroSync";
}

export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
