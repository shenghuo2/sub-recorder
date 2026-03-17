"use client";

import { LayoutDashboard, Settings, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/animated-logo";

export type NavPage = "subscriptions" | "categories" | "settings";

interface Props {
  current: NavPage;
  onChange: (page: NavPage) => void;
}

const NAV_ITEMS: { id: NavPage; icon: React.ElementType; label: string }[] = [
  { id: "subscriptions", icon: LayoutDashboard, label: "订阅" },
  { id: "categories", icon: FolderOpen, label: "分类" },
  { id: "settings", icon: Settings, label: "设置" },
];

export function NavSidebar({ current, onChange }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 px-2 border-r bg-muted/30 w-14 shrink-0">
      {/* Logo */}
      <div className="mb-4 select-none">
        <AppLogo size={36} />
      </div>

      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = current === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            title={item.label}
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}
