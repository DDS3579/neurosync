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

export const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/brain", label: "Brain explorer", icon: Brain },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/habits", label: "Habits", icon: ListChecks },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];
