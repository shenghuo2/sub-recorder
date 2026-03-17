"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { Subscription, Category } from "@/lib/types";
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

  const totalMonthly = useMemo(() => subscriptions
    .filter((s) => !s.is_suspended && !(s.end_date && new Date(s.end_date) < today))
    .reduce((sum, s) => {
      const priceCNY = toCNY(s.effective_price ?? s.price, s.effective_currency ?? s.currency);
      const cycle = s.billing_cycle;
      let months = 1;
      if (cycle === "daily") months = 1 / 30;
      else if (cycle === "weekly") months = 7 / 30;
      else if (cycle === "month_1") months = 1;
      else if (cycle === "month_2") months = 2;
      else if (cycle === "month_3") months = 3;
      else if (cycle === "month_6") months = 6;
      else if (cycle === "year_1") months = 12;
      else if (cycle === "year_2") months = 24;
      else if (cycle === "year_3") months = 36;
      return sum + (s.is_one_time ? 0 : priceCNY / months);
    }, 0), [subscriptions, today, toCNY]);

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
    .reduce((sum, s) => sum + toCNY(s.effective_price ?? s.price, s.effective_currency ?? s.currency), 0),
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
          cmp = (b.effective_price ?? b.price) - (a.effective_price ?? a.price);
          break;
        case "price_low":
          cmp = (a.effective_price ?? a.price) - (b.effective_price ?? b.price);
          break;
      }
      return sortReversed ? -cmp : cmp;
    });

    return list;
  }, [subscriptions, selectedDate, selectedCategoryIds, sortBy, sortReversed, today]);

  // Render the subscriptions page content
  const renderSubscriptionsPage = () => (
    <>
      {/* Sidebar: Calendar + Filter + Sort */}
      <div className="w-72 shrink-0 border-r bg-muted/10 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Calendar */}
          <SubscriptionCalendar
            subscriptions={subscriptions}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
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
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-['MiSans']">所有订阅</h1>
              <p className="text-sm text-muted-foreground mt-1">
                共 {subscriptions.length} 项
                {totalMonthly > 0 && ` · 月均 ≈ ¥${totalMonthly.toFixed(0)}`}
                {monthlySpending > 0 && ` · 本月 ¥${monthlySpending.toFixed(0)}`}
              </p>
            </div>
            <Button
              size="icon"
              className="rounded-full h-12 w-12 shadow-lg"
              onClick={() => {
                setEditingSub(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-6 w-6" />
            </Button>
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
            <div className="flex flex-col gap-3">
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

      {/* Right: Category Panel */}
      <div className="w-60 shrink-0 border-l bg-muted/10 overflow-y-auto">
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
          <div className="max-w-lg mx-auto py-6">
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
        <div className="flex-1 overflow-y-auto">
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
