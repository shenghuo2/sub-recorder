"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X, Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { Category, Subscription } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FaIconPicker } from "@/components/fa-icon-picker";
import { parseFaIcon, getFaClass } from "@/lib/fa-icons";

interface Props {
  categories: Category[];
  subscriptions: Subscription[];
  selectedCategoryIds: Set<number>;
  onFilterChange: (ids: Set<number>) => void;
  onRefresh: () => void;
}

function CategoryIcon({ cat }: { cat: Category }) {
  if (cat.fa_icon) {
    const parsed = parseFaIcon(cat.fa_icon);
    if (parsed) {
      return <i className={`${getFaClass(parsed.name, parsed.style)} text-xs text-muted-foreground`} />;
    }
    // 兼容旧格式 (只有图标名，无样式前缀)
    return <i className={`fa-solid ${cat.fa_icon} text-xs text-muted-foreground`} />;
  }
  if (cat.icon) {
    return (
      <img
        src={`data:${cat.icon_mime_type || "image/png"};base64,${cat.icon}`}
        alt=""
        className="h-4 w-4 object-contain"
      />
    );
  }
  return (
    <span className="text-[10px] font-bold text-muted-foreground">
      {cat.name.charAt(0)}
    </span>
  );
}

export function CategoryPanel({
  categories,
  subscriptions,
  selectedCategoryIds,
  onFilterChange,
  onRefresh,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editFaIcon, setEditFaIcon] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");

  // Count subscriptions per category
  const countMap = new Map<number | null, number>();
  for (const sub of subscriptions) {
    const key = sub.category_id;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditFaIcon(cat.fa_icon);
  };

  const saveEdit = async () => {
    if (editingId == null || !editName.trim()) return;
    try {
      await api.updateCategory(editingId, { name: editName.trim(), fa_icon: editFaIcon });
      toast.success("已更新");
      setEditingId(null);
      onRefresh();
    } catch (e: unknown) {
      toast.error("更新失败: " + (e instanceof Error ? e.message : "未知错误"));
    }
  };

  const handleDelete = async (id: number) => {
    const count = countMap.get(id) ?? 0;
    if (count > 0) {
      toast.error(`该分类下还有 ${count} 个订阅，无法删除`);
      return;
    }
    try {
      await api.deleteCategory(id);
      toast.success("已删除");
      if (selectedCategoryIds.has(id)) {
        const next = new Set(selectedCategoryIds);
        next.delete(id);
        onFilterChange(next);
      }
      onRefresh();
    } catch (e: unknown) {
      toast.error("删除失败: " + (e instanceof Error ? e.message : "未知错误"));
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await api.createCategory({ name: newName.trim() });
      toast.success("已创建");
      setAddingNew(false);
      setNewName("");
      onRefresh();
    } catch (e: unknown) {
      toast.error("创建失败: " + (e instanceof Error ? e.message : "未知错误"));
    }
  };

  const toggleFilter = (id: number) => {
    if (selectedCategoryIds.size === 1 && selectedCategoryIds.has(id)) {
      onFilterChange(new Set());
    } else {
      onFilterChange(new Set([id]));
    }
  };

  const allSelected = selectedCategoryIds.size === 0;
  const uncategorizedCount = countMap.get(null) ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          分类管理
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => { setAddingNew(true); setNewName(""); }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* 全部 */}
        <button
          onClick={() => onFilterChange(new Set())}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
            allSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-muted-foreground"
          )}
        >
          <span className="flex-1 text-left">全部</span>
          <span className="text-xs opacity-60">{subscriptions.length}</span>
        </button>

        {categories.map((cat) => {
          const count = countMap.get(cat.id) ?? 0;
          const isEditing = editingId === cat.id;
          const isFiltered = selectedCategoryIds.has(cat.id);

          return (
            <div
              key={cat.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                isFiltered ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"
              )}
            >
              {/* Icon */}
              <div className="h-5 w-5 shrink-0 rounded flex items-center justify-center bg-muted overflow-hidden">
                <CategoryIcon cat={cat} />
              </div>

              {isEditing ? (
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-6 text-sm flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                      autoFocus
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={saveEdit}>
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">图标:</span>
                    <FaIconPicker value={editFaIcon} onChange={setEditFaIcon} />
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className="flex-1 text-left truncate"
                    onClick={() => toggleFilter(cat.id)}
                  >
                    {cat.name}
                  </button>
                  <span className="text-xs opacity-50">{count}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(cat)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(cat.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* 未分类 */}
        <button
          onClick={() => toggleFilter(-1)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
            selectedCategoryIds.has(-1) ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-muted-foreground"
          )}
        >
          <div className="h-5 w-5 shrink-0 rounded flex items-center justify-center bg-muted">
            <span className="text-[10px] text-muted-foreground">?</span>
          </div>
          <span className="flex-1 text-left">未分类</span>
          <span className="text-xs opacity-60">{uncategorizedCount}</span>
        </button>

        {/* Add new */}
        {addingNew && (
          <div className="flex items-center gap-2 px-3 py-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新分类名称"
              className="h-7 text-sm flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAddingNew(false); }}
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAdd}>
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAddingNew(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
