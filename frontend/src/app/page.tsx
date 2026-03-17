"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { Subscription, Category } from "@/lib/types";
import { cycleToMonths } from "@/lib/types";
import { SubscriptionCard } from "@/components/subscription-card";
import { SubscriptionDialog } from "@/components/subscription-dialog";
import { SubscriptionDetailSheet } from "@/components/subscription-detail-sheet";
import { NavSidebar, type NavPage } from "@/components/nav-sidebar";
import { SubscriptionCalendar } from "@/components/subscription-calendar";
import { CategoryFilter } from "@/components/category-filter";
import { SortOptions, type SortField } from "@/components/sort-options";
import { CategoryPanel } from "@/components/category-panel";
import { SettingsPage } from "@/components/settings-page";
import { fetchExchangeRates, convertCurrency } from "@/lib/currency";

export default function Home() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [detailSubId, setDetailSubId] = useState<string | null>(null);
  const [navPage, setNavPage] = useState<NavPage>("subscriptions");

  // Filter & sort state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<SortField>("billing_date");
  const [sortReversed, setSortReversed] = useState(false);

  const [rates, setRates] = useState<Record<string, number>>({});
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [subs, cats] = await Promise.all([
        api.listSubscriptions(),
        api.listCategories(),
      ]);
      setSubscriptions(subs);
      setCategories(cats);
    } catch (e: unknown) {
      toast.error("加载失败: " + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExchangeRates("CNY").then((r) => setRates(r.rates));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const toCNY = useCallback((amount: number, cur: string) =>
    cur === "CNY" ? amount : convertCurrency(amount, cur, "CNY", rates, "CNY"),
    [rates]
  );

  // Helper: compute monthly CNY cost for a subscription from its effective_records
  const subMonthlyCNY = useCallback((s: Subscription) => {
    const records = s.effective_records ?? [];
    if (records.length === 0) {
      // No active billing records, use subscription default
      return toCNY(s.price, s.currency) / cycleToMonths(s.billing_cycle);
    }
    // Sum all effective records, each normalized to monthly
    return records.reduce((sum, r) => {
      const months = cycleToMonths(r.billing_cycle || s.billing_cycle);
      return sum + toCNY(r.amount, r.currency) / months;
    }, 0);
  }, [toCNY]);

  // Find smallest billing cycle among active recurring subscriptions and normalize total to that unit
  const { totalNormalized, baseCycleMonths, baseCycleLabel } = useMemo(() => {
    const active = subscriptions.filter(
      (s) => !s.is_suspended && !s.is_one_time && !(s.end_date && new Date(s.end_date) < today)
    );
    if (active.length === 0) return { totalNormalized: 0, baseCycleMonths: 1, baseCycleLabel: "/月" };

    // Collect all effective billing cycles to find the smallest
    const allCycleMonths: number[] = [];
    for (const s of active) {
      const records = s.effective_records ?? [];
      if (records.length === 0) {
        allCycleMonths.push(cycleToMonths(s.billing_cycle));
      } else {
        for (const r of records) {
          allCycleMonths.push(cycleToMonths(r.billing_cycle || s.billing_cycle));
        }
      }
    }
    const smallestMonths = Math.min(...allCycleMonths);

    // Map smallestMonths back to a label
    const cycleLabels: [number, string][] = [
      [1 / 30, "/天"], [7 / 30, "/周"], [1, "/月"], [2, "/2月"],
      [3, "/季"], [6, "/半年"], [12, "/年"], [24, "/2年"], [36, "/3年"],
    ];
    const label = cycleLabels.find(([m]) => Math.abs(m - smallestMonths) < 0.01)?.[1] || "/月";

    // Sum: each sub's monthly CNY * smallestMonths
    const total = active.reduce((sum, s) => sum + subMonthlyCNY(s) * smallestMonths, 0);

    return { totalNormalized: total, baseCycleMonths: smallestMonths, baseCycleLabel: label };
  }, [subscriptions, today, subMonthlyCNY]);

  // 月支出：本月已到账单日期的订阅 + 本月付款的账单
  const monthlySpending = useMemo(() => subscriptions
    .filter((s) => {
      if (s.is_suspended) return false;
      if (s.end_date && new Date(s.end_date) < today) return false;
      if (s.is_one_time) {
        const bd = new Date(s.billing_date);
        return bd.getFullYear() === currentYear && bd.getMonth() === currentMonth;
      }
      if (s.next_bill_date) {
        const nbd = new Date(s.next_bill_date);
        const nbdMonth = nbd.getFullYear() * 12 + nbd.getMonth();
        const curMonth = currentYear * 12 + currentMonth;
        if (nbdMonth === curMonth) return true;
        if (nbdMonth === curMonth + 1 || (nbd <= today && nbdMonth <= curMonth)) return true;
      }
      return false;
    })
    .reduce((sum, s) => {
      // For monthly spending, use the sub's effective monthly price * 1 month
      const records = s.effective_records ?? [];
      if (records.length > 0) {
        return sum + records.reduce((rSum, r) => {
          const months = cycleToMonths(r.billing_cycle || s.billing_cycle);
          return rSum + toCNY(r.amount, r.currency) / months;
        }, 0);
      }
      return sum + toCNY(s.price, s.currency) / cycleToMonths(s.billing_cycle);
    }, 0),
    [subscriptions, today, currentYear, currentMonth, toCNY]);

  // Filter + Sort
  const filteredAndSorted = useMemo(() => {
    let list = [...subscriptions];

    // Calendar date filter
    if (selectedDate) {
      list = list.filter((s) => s.next_bill_date === selectedDate);
    }

    // Category filter
    if (selectedCategoryIds.size > 0) {
      list = list.filter((s) => {
        if (selectedCategoryIds.has(-1) && !s.category_id) return true;
        return s.category_id != null && selectedCategoryIds.has(s.category_id);
      });
    }

    // Sort: always put expired last
    const isExpired = (s: Subscription) => s.end_date ? new Date(s.end_date) < today : false;

    list.sort((a, b) => {
      const ae = isExpired(a);
      const be = isExpired(b);
      if (ae !== be) return ae ? 1 : -1;

      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name, "zh-CN");
          break;
        case "category":
          cmp = (a.category_id ?? 999999) - (b.category_id ?? 999999);
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
      return sortReversed ? -cmp : cmp;
    });

    return list;
  }, [subscriptions, selectedDate, selectedCategoryIds, sortBy, sortReversed, today, subMonthlyCNY]);

  const filterContent = (
    <div className="p-4 space-y-4">
      <SubscriptionCalendar
        subscriptions={subscriptions}
        selectedDate={selectedDate}
        onSelectDate={(d) => { setSelectedDate(d); }}
      />
      {selectedDate && (
        <div className="text-xs text-center text-primary">
          已选择 {selectedDate}
          <button
            onClick={() => setSelectedDate(null)}
            className="ml-2 underline text-muted-foreground hover:text-foreground"
          >
            清除
          </button>
        </div>
      )}
      <div className="border-t pt-3">
        <CategoryFilter
          categories={categories}
          selectedIds={selectedCategoryIds}
          onChange={setSelectedCategoryIds}
        />
      </div>
      <div className="border-t pt-3">
        <SortOptions
          sortBy={sortBy}
          reversed={sortReversed}
          onChange={(s, r) => { setSortBy(s); setSortReversed(r); }}
        />
      </div>
    </div>
  );

  // Render the subscriptions page content
  const renderSubscriptionsPage = () => (
    <>
      {/* Desktop Sidebar: Calendar + Filter + Sort */}
      <div className="hidden md:block w-72 shrink-0 border-r bg-muted/10 overflow-y-auto">
        {filterContent}
      </div>

      {/* Mobile filter drawer */}
      {mobileFilterOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFilterOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[85vw] max-w-xs bg-background overflow-y-auto shadow-xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">筛选与排序</h2>
              <Button size="icon" variant="ghost" onClick={() => setMobileFilterOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {filterContent}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 md:px-6 py-4 md:py-6 pb-20 md:pb-6">
          {/* Header */}
          <div className="mb-4 md:mb-6 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold font-['MiSans']">所有订阅</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1 truncate">
                共 {subscriptions.length} 项
                {totalNormalized > 0 && ` · 均 ≈ ¥${totalNormalized.toFixed(0)}${baseCycleLabel}`}
                {monthlySpending > 0 && ` · 本月 ¥${monthlySpending.toFixed(0)}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile filter toggle */}
              <Button
                size="icon"
                variant="outline"
                className="md:hidden rounded-full h-10 w-10"
                onClick={() => setMobileFilterOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
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
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              加载中...
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              {subscriptions.length === 0 ? (
                <>
                  <p>还没有订阅</p>
                  <p className="text-sm">点击右上角 + 添加</p>
                </>
              ) : (
                <p>没有匹配的订阅</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 md:gap-3">
              {filteredAndSorted.map((sub) => (
                <SubscriptionCard
                  key={sub.id}
                  subscription={sub}
                  onClick={() => setDetailSubId(sub.id)}
                  exchangeRates={rates}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Right: Category Panel */}
      <div className="hidden md:block w-60 shrink-0 border-l bg-muted/10 overflow-y-auto">
        <CategoryPanel
          categories={categories}
          subscriptions={subscriptions}
          selectedCategoryIds={selectedCategoryIds}
          onFilterChange={setSelectedCategoryIds}
          onRefresh={refresh}
        />
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Navigation */}
      <NavSidebar current={navPage} onChange={setNavPage} />

      {navPage === "subscriptions" && renderSubscriptionsPage()}

      {navPage === "categories" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 md:px-0 py-4 md:py-6 pb-20 md:pb-6">
            <CategoryPanel
              categories={categories}
              subscriptions={subscriptions}
              selectedCategoryIds={selectedCategoryIds}
              onFilterChange={setSelectedCategoryIds}
              onRefresh={refresh}
            />
          </div>
        </div>
      )}

      {navPage === "settings" && (
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <SettingsPage />
        </div>
      )}

      {/* 创建/编辑弹窗 */}
      <SubscriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subscription={editingSub}
        categories={categories}
        onSaved={() => {
          setDialogOpen(false);
          refresh();
        }}
      />

      {/* 详情侧边栏 */}
      <SubscriptionDetailSheet
        subscriptionId={detailSubId}
        onClose={() => setDetailSubId(null)}
        onEdit={(sub) => {
          setDetailSubId(null);
          setEditingSub(sub);
          setDialogOpen(true);
        }}
        onRefresh={refresh}
      />
    </div>
  );
}
