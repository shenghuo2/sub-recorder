"use client";

import { LayoutDashboard, Settings, Import } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavPage = "subscriptions" | "import" | "settings";

interface Props {
  current: NavPage;
  onChange: (page: NavPage) => void;
}

const NAV_ITEMS: { id: NavPage; icon: React.ElementType; label: string }[] = [
  { id: "subscriptions", icon: LayoutDashboard, label: "订阅" },
  { id: "import", icon: Import, label: "导入" },
  { id: "settings", icon: Settings, label: "设置" },
];

export function NavSidebar({ current, onChange }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 px-2 border-r bg-muted/30 w-14 shrink-0">
      {/* Logo */}
      <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm mb-4 select-none">
        SR
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
