"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Settings2, Trash2, Layers, ArrowUpDown, CheckSquare, Square, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SceneWithSummary, SceneDetail, Subscription, Category } from "@/lib/types";
import { BILLING_CYCLES, BILLING_CYCLE_LABELS, getBillingCycleShort, cycleToMonths } from "@/lib/types";
import { getCycleFormat, getTargetCurrency } from "@/components/settings-page";
import { formatCurrencyCompact, convertCurrency } from "@/lib/currency";
import { SubscriptionCard } from "@/components/subscription-card";
import { SubscriptionDialog } from "@/components/subscription-dialog";
import { SubscriptionDetailSheet } from "@/components/subscription-detail-sheet";
import * as api from "@/lib/api";

interface Props {
  scenes: SceneWithSummary[];
  categories: Category[];
  onBack: () => void;
  onRefresh: () => void;
  initialSceneId?: string | null;
  exchangeRates: Record<string, number>;
}

export function ScenePage({ scenes, categories, onBack, onRefresh, initialSceneId, exchangeRates }: Props) {
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(initialSceneId ?? scenes[0]?.id ?? null);
  const [detail, setDetail] = useState<SceneDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Sub dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [detailSubId, setDetailSubId] = useState<string | null>(null);

  // Sorting
  const [sortBy, setSortBy] = useState<"billing_date" | "name" | "price_high" | "price_low">("billing_date");

  // Multi-select mode for releasing subscriptions
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Scene settings dialog
  const [sceneSettingsOpen, setSceneSettingsOpen] = useState(false);
  const [sceneName, setSceneName] = useState("");
  const [sceneCycle, setSceneCycle] = useState("month_1");
  const [sceneShowLogos, setSceneShowLogos] = useState(true);

  // Create scene dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newSceneName, setNewSceneName] = useState("");
  const [newSceneCycle, setNewSceneCycle] = useState("month_1");

  const loadDetail = useCallback(async () => {
    if (!currentSceneId) return;
    setLoading(true);
    try {
      const d = await api.getScene(currentSceneId);
      setDetail(d);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [currentSceneId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const refresh = () => {
    loadDetail();
    onRefresh();
  };

  const currentScene = scenes.find(s => s.id === currentSceneId);
  const today = useMemo(() => new Date(), []);

  // Helper to compute subscription monthly CNY
  const subMonthlyCNY = useCallback((sub: Subscription) => {
    const records = sub.effective_records ?? [];
    if (records.length > 0) {
      return records.reduce((sum, r) => {
        const months = cycleToMonths(r.billing_cycle || sub.billing_cycle);
        return sum + convertCurrency(r.amount, r.currency, "CNY", exchangeRates) / months;
      }, 0);
    }
    return convertCurrency(sub.price, sub.currency, "CNY", exchangeRates) / cycleToMonths(sub.billing_cycle);
  }, [exchangeRates]);

  // Sorted subscriptions with expired at bottom
  const sortedSubs = useMemo(() => {
    if (!detail) return [];
    const list = [...detail.subscriptions];
    const isExpired = (s: Subscription) => s.end_date ? new Date(s.end_date) < today : false;

    list.sort((a, b) => {
      // Expired always at bottom
      const ae = isExpired(a);
      const be = isExpired(b);
      if (ae !== be) return ae ? 1 : -1;

      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name, "zh-CN");
          break;
        case "billing_date": {
          const aDate = a.next_bill_date || "9999-12-31";
          const bDate = b.next_bill_date || "9999-12-31";
          cmp = aDate.localeCompare(bDate);
          break;
        }
        case "price_high":
          cmp = subMonthlyCNY(b) - subMonthlyCNY(a);
          break;
        case "price_low":
          cmp = subMonthlyCNY(a) - subMonthlyCNY(b);
          break;
      }
      return cmp;
    });
    return list;
  }, [detail, sortBy, today, subMonthlyCNY]);

  // Compute total for the scene using effective_records + currency conversion
  const targetCurrency = getTargetCurrency();
  const totalNormalized = useMemo(() => {
    if (!detail) return 0;
    const sceneMonths = cycleToMonths(detail.billing_cycle);
    const todayStr = new Date().toISOString().slice(0, 10);
    return detail.subscriptions.reduce((sum, sub) => {
      // Skip expired and suspended
      if (sub.end_date && sub.end_date < todayStr) return sum;
      if (sub.is_suspended) return sum;
      const records = sub.effective_records ?? [];
      if (records.length > 0) {
        // Use effective records
        return sum + records.reduce((s, r) => {
          const months = cycleToMonths(r.billing_cycle || sub.billing_cycle);
          const monthly = convertCurrency(r.amount, r.currency, targetCurrency, exchangeRates) / months;
          return s + monthly * sceneMonths;
        }, 0);
      }
      // Fallback to base price
      const months = cycleToMonths(sub.billing_cycle);
      const monthly = convertCurrency(sub.price, sub.currency, targetCurrency, exchangeRates) / months;
      return sum + monthly * sceneMonths;
    }, 0);
  }, [detail, exchangeRates, targetCurrency]);

  const handleCreateScene = async () => {
    if (!newSceneName.trim()) {
      toast.error("请输入场景名称");
      return;
    }
    try {
      const scene = await api.createScene({
        name: newSceneName.trim(),
        billing_cycle: newSceneCycle,
      });
      toast.success("场景已创建");
      setCreateOpen(false);
      setNewSceneName("");
      onRefresh();
      setCurrentSceneId(scene.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    }
  };

  const handleUpdateScene = async () => {
    if (!currentSceneId) return;
    try {
      await api.updateScene(currentSceneId, {
        name: sceneName,
        billing_cycle: sceneCycle,
        show_sub_logos: sceneShowLogos,
      });
      toast.success("场景已更新");
      setSceneSettingsOpen(false);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    }
  };

  const handleDeleteScene = async () => {
    if (!currentSceneId) return;
    if (!confirm("删除此场景？场景内的订阅将移回主页。")) return;
    try {
      await api.deleteScene(currentSceneId);
      toast.success("场景已删除");
      onRefresh();
      const remaining = scenes.filter(s => s.id !== currentSceneId);
      if (remaining.length > 0) {
        setCurrentSceneId(remaining[0].id);
      } else {
        onBack();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const openSceneSettings = () => {
    if (!currentScene) return;
    setSceneName(currentScene.name);
    setSceneCycle(currentScene.billing_cycle);
    setSceneShowLogos(currentScene.show_sub_logos);
    setSceneSettingsOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!detail) return;
    setSelectedIds(new Set(detail.subscriptions.map(s => s.id)));
  };

  const releaseSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定将选中的 ${selectedIds.size} 项移出此场景？`)) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => api.updateSubscription(id, { scene_id: null }))
      );
      toast.success(`已释放 ${selectedIds.size} 项`);
      setSelectedIds(new Set());
      setSelectMode(false);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  const batchSetShowOnMain = async (value: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => api.updateSubscription(id, { show_on_main: value }))
      );
      toast.success(value ? `已设置 ${selectedIds.size} 项在主页显示` : `已取消 ${selectedIds.size} 项在主页显示`);
      setSelectedIds(new Set());
      setSelectMode(false);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // No scenes exist — show empty state with create prompt
  if (scenes.length === 0 && !loading) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <Layers className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-xl font-bold font-['MiSans'] mb-2">还没有场景</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              场景可以将一组订阅归类管理，例如：域名续费、云服务等
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              创建第一个场景
            </Button>
          </div>
        </div>

        {/* Create scene dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>新建场景</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>名称</Label>
                <Input
                  value={newSceneName}
                  onChange={(e) => setNewSceneName(e.target.value)}
                  placeholder="例如：域名"
                />
              </div>
              <div className="grid gap-2">
                <Label>展示周期</Label>
                <Select value={newSceneCycle} onValueChange={setNewSceneCycle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.filter(c => c !== "custom_days").map((c) => (
                      <SelectItem key={c} value={c}>
                        {BILLING_CYCLE_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button onClick={handleCreateScene}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 md:px-6 py-4 md:py-6 pb-20 md:pb-6">
            {/* Header */}
            <div className="mb-4 md:mb-6 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold font-['MiSans'] truncate">
                  {currentScene?.name ?? "场景"}
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">
                  共 {detail?.subscriptions.length ?? 0} 项
                  {totalNormalized > 0 && ` · 合计 ${formatCurrencyCompact(totalNormalized, targetCurrency)}${getBillingCycleShort(currentScene?.billing_cycle ?? "month_1", getCycleFormat())}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Mobile scene selector */}
                <Select value={currentSceneId ?? ""} onValueChange={setCurrentSceneId}>
                  <SelectTrigger className="md:hidden w-auto min-w-0 max-w-[120px] h-10">
                    <SelectValue placeholder="切换场景" />
                  </SelectTrigger>
                  <SelectContent>
                    {scenes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Sort dropdown */}
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-auto h-10 gap-1">
                    <ArrowUpDown className="h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billing_date">按日期</SelectItem>
                    <SelectItem value="name">按名称</SelectItem>
                    <SelectItem value="price_high">价格高→低</SelectItem>
                    <SelectItem value="price_low">价格低→高</SelectItem>
                  </SelectContent>
                </Select>
                {/* Select mode / batch actions */}
                {!selectMode ? (
                  <Button
                    size="icon"
                    variant="outline"
                    className="rounded-full h-10 w-10"
                    onClick={() => setSelectMode(true)}
                    title="批量操作"
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={selectAll}>全选</Button>
                    <Button size="sm" variant="outline" onClick={() => batchSetShowOnMain(true)} disabled={selectedIds.size === 0}>
                      主页显示
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => batchSetShowOnMain(false)} disabled={selectedIds.size === 0}>
                      取消主页
                    </Button>
                    <Button size="sm" variant="destructive" onClick={releaseSelected} disabled={selectedIds.size === 0}>
                      释放 ({selectedIds.size})
                    </Button>
                    <Button size="sm" variant="ghost" onClick={exitSelectMode}>取消</Button>
                  </>
                )}
                <Button size="icon" variant="outline" className="rounded-full h-10 w-10" onClick={openSceneSettings}>
                  <Settings2 className="h-4 w-4" />
                </Button>
                {!selectMode && (
                  <Button
                    size="icon"
                    className="rounded-full h-10 w-10 md:h-12 md:w-12 shadow-lg"
                    onClick={() => {
                      setEditingSub(null);
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="h-5 w-5 md:h-6 md:w-6" />
                  </Button>
                )}
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                加载中...
              </div>
            ) : !detail || detail.subscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p>暂无订阅</p>
                <p className="text-sm">点击 + 添加订阅到此场景</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 md:gap-3">
                {sortedSubs.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2">
                    {selectMode && (
                      <button
                        onClick={() => toggleSelect(sub.id)}
                        className="shrink-0 p-1"
                      >
                        {selectedIds.has(sub.id) ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <SubscriptionCard
                        subscription={sub}
                        onClick={() => selectMode ? toggleSelect(sub.id) : setDetailSubId(sub.id)}
                        exchangeRates={exchangeRates}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Right sidebar: scene list */}
        <div className="hidden md:block w-60 shrink-0 border-l bg-muted/10 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-3">所有场景</h3>
            <div className="space-y-1">
              {scenes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentSceneId(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    s.id === currentSceneId
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <div className="font-medium truncate">{s.name}</div>
                  <div className={`text-xs ${s.id === currentSceneId ? "opacity-80" : "text-muted-foreground"}`}>
                    {s.sub_count}个子项
                  </div>
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              新建场景
            </Button>
          </div>
        </div>
      </div>

      {/* Create/Edit subscription dialog */}
      <SubscriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subscription={editingSub}
        categories={categories}
        scenes={scenes}
        defaultSceneId={currentSceneId}
        onSaved={() => {
          setDialogOpen(false);
          refresh();
        }}
      />

      {/* Detail sheet */}
      <SubscriptionDetailSheet
        subscriptionId={detailSubId}
        onClose={() => setDetailSubId(null)}
        onEdit={(sub) => {
          setDetailSubId(null);
          setEditingSub(sub);
          setDialogOpen(true);
        }}
        onRefresh={refresh}
        exchangeRates={exchangeRates}
      />

      {/* Scene settings dialog */}
      <Dialog open={sceneSettingsOpen} onOpenChange={setSceneSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>场景设置</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>名称</Label>
              <Input value={sceneName} onChange={(e) => setSceneName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>展示周期</Label>
              <Select value={sceneCycle} onValueChange={setSceneCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.filter(c => c !== "custom_days").map((c) => (
                    <SelectItem key={c} value={c}>
                      {BILLING_CYCLE_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showLogos"
                checked={sceneShowLogos}
                onChange={(e) => setSceneShowLogos(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <Label htmlFor="showLogos">在主页卡片上显示子项Logo</Label>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={handleDeleteScene}>
              <Trash2 className="h-4 w-4 mr-1" />
              删除场景
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSceneSettingsOpen(false)}>取消</Button>
              <Button onClick={handleUpdateScene}>保存</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create scene dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新建场景</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>名称</Label>
              <Input
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                placeholder="例如：域名"
              />
            </div>
            <div className="grid gap-2">
              <Label>展示周期</Label>
              <Select value={newSceneCycle} onValueChange={setNewSceneCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.filter(c => c !== "custom_days").map((c) => (
                    <SelectItem key={c} value={c}>
                      {BILLING_CYCLE_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreateScene}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
