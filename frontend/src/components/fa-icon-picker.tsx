"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FA_CATEGORIES,
  FA_STATS,
  type FaStyle,
  type FaIconData,
  getFaClass,
  parseFaIcon,
  serializeFaIcon,
  searchIcons,
} from "@/lib/fa-icons";

interface Props {
  value: string | null;
  onChange: (icon: string | null) => void;
}

const STYLE_OPTIONS: { id: FaStyle | "all"; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "solid", label: "实心 Solid" },
  { id: "regular", label: "线框 Regular" },
  { id: "brands", label: "品牌 Brands" },
];

export function FaIconPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<FaStyle | "all">("all");
  const [category, setCategory] = useState<string | null>(null);

  const parsed = parseFaIcon(value);

  const filtered = useMemo(() => {
    return searchIcons(search, style, category);
  }, [search, style, category]);

  const handleSelect = (icon: FaIconData & { style: FaStyle }) => {
    onChange(serializeFaIcon(icon.name, icon.style));
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  const resetFilters = () => {
    setSearch("");
    setStyle("all");
    setCategory(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 px-3">
          {parsed ? (
            <i className={`${getFaClass(parsed.name, parsed.style)} text-sm`} />
          ) : (
            <span className="text-xs text-muted-foreground">选择图标</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-3" align="start">
        {/* Search */}
        <Input
          placeholder="搜索图标名称、标签、关键词..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm mb-2"
          autoFocus
        />

        {/* Filters row */}
        <div className="flex gap-2 mb-2">
          {/* Style filter */}
          <Select value={style} onValueChange={(v) => setStyle(v as FaStyle | "all")}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="样式" />
            </SelectTrigger>
            <SelectContent>
              {STYLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select value={category || "__all__"} onValueChange={(v) => setCategory(v === "__all__" ? null : v)}>
            <SelectTrigger className="h-7 text-xs flex-[2]">
              <SelectValue placeholder="分类" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="__all__" className="text-xs">全部分类</SelectItem>
              {FA_CATEGORIES.map((cat) => (
                <SelectItem key={cat.id} value={cat.id} className="text-xs">
                  {cat.label} ({cat.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset */}
          {(search || style !== "all" || category) && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetFilters}>
              重置
            </Button>
          )}
        </div>

        {/* Results count */}
        <div className="text-[10px] text-muted-foreground mb-1">
          找到 {filtered.length} 个图标
          {category && ` (${FA_CATEGORIES.find(c => c.id === category)?.label})`}
        </div>

        {/* Icons grid */}
        <div className="grid grid-cols-12 gap-0.5 max-h-72 overflow-y-auto border rounded-md p-1 bg-muted/30">
          {/* Clear option */}
          <button
            onClick={handleClear}
            className={cn(
              "h-7 w-7 rounded flex items-center justify-center text-xs hover:bg-accent transition-colors",
              !value && "bg-primary/10 text-primary ring-1 ring-primary"
            )}
            title="清除图标"
          >
            ✕
          </button>
          {filtered.slice(0, 200).map((icon) => {
            const isSelected = parsed?.name === icon.name && parsed?.style === icon.style;
            return (
              <button
                key={`${icon.style}:${icon.name}`}
                onClick={() => handleSelect(icon)}
                className={cn(
                  "h-7 w-7 rounded flex items-center justify-center hover:bg-accent transition-colors",
                  isSelected && "bg-primary/10 text-primary ring-1 ring-primary"
                )}
                title={`${icon.label} (${icon.style}:${icon.name})`}
              >
                <i className={`${getFaClass(icon.name, icon.style)} text-xs`} />
              </button>
            );
          })}
        </div>

        {filtered.length > 200 && (
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            显示前 200 个，请使用搜索或筛选缩小范围
          </p>
        )}

        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">无匹配图标</p>
        )}

        {/* Selected preview */}
        {parsed && (
          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground flex items-center gap-2">
            <i className={`${getFaClass(parsed.name, parsed.style)} text-base`} />
            <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{parsed.style}:{parsed.name}</code>
          </div>
        )}

        {/* Stats */}
        <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground/60 flex justify-between">
          <span>Font Awesome 6 Free</span>
          <span>{FA_STATS.total} 图标 · {FA_STATS.categories} 分类</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
