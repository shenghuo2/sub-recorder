"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  categories: Category[];
  selectedIds: Set<number>;
  onChange: (ids: Set<number>) => void;
}

export function CategoryFilter({ categories, selectedIds, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const allSelected = selectedIds.size === 0;

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-sm font-semibold py-2 hover:text-foreground transition-colors"
      >
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span>分类筛选</span>
        {!allSelected && (
          <span className="text-xs text-primary ml-auto mr-2">
            {selectedIds.size} 项
          </span>
        )}
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-1 pl-1">
          {/* 全部 */}
          <label className="flex items-center gap-2 py-1 cursor-pointer text-sm hover:text-foreground transition-colors">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onChange(new Set())}
              className="h-3.5 w-3.5 rounded accent-primary"
            />
            <span className={cn(allSelected ? "text-foreground font-medium" : "text-muted-foreground")}>
              全部
            </span>
          </label>

          {categories.map((cat) => (
            <label
              key={cat.id}
              className="flex items-center gap-2 py-1 cursor-pointer text-sm hover:text-foreground transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(cat.id)}
                onChange={() => toggle(cat.id)}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
              <span className={cn(selectedIds.has(cat.id) ? "text-foreground font-medium" : "text-muted-foreground")}>
                {cat.name}
              </span>
            </label>
          ))}

          {/* 无分类 */}
          <label className="flex items-center gap-2 py-1 cursor-pointer text-sm hover:text-foreground transition-colors">
            <input
              type="checkbox"
              checked={selectedIds.has(-1)}
              onChange={() => toggle(-1)}
              className="h-3.5 w-3.5 rounded accent-primary"
            />
            <span className={cn(selectedIds.has(-1) ? "text-foreground font-medium" : "text-muted-foreground")}>
              未分类
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
