"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { Subscription, Category } from "@/lib/types";
import { SubscriptionCard } from "@/components/subscription-card";
import { SubscriptionDialog } from "@/components/subscription-dialog";
import { SubscriptionDetailSheet } from "@/components/subscription-detail-sheet";
import { CURRENCY_SYMBOLS, BILLING_CYCLES } from "@/lib/types";

export default function Home() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [detailSubId, setDetailSubId] = useState<string | null>(null);

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

  useEffect(() => { refresh(); }, [refresh]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const totalMonthly = subscriptions
    .filter((s) => !s.is_suspended && !(s.end_date && new Date(s.end_date) < today))
    .reduce((sum, s) => {
      if (s.currency !== "CNY") return sum;
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
      return sum + (s.is_one_time ? 0 : s.price / months);
    }, 0);

  // 月支出：本月已到账单日期的订阅 + 本月付款的账单
  const monthlySpending = subscriptions
    .filter((s) => {
      if (s.currency !== "CNY") return false;
      if (s.is_suspended) return false;
      // 已过期的不计入
      if (s.end_date && new Date(s.end_date) < today) return false;
      // 一次性付费：账单日期在本月
      if (s.is_one_time) {
        const bd = new Date(s.billing_date);
        return bd.getFullYear() === currentYear && bd.getMonth() === currentMonth;
      }
      // 周期性订阅：next_bill_date 在本月之前或本月内，意味着本月需要付款
      // 更准确地说，billing_date 或者某个周期日落在本月
      if (s.next_bill_date) {
        const nbd = new Date(s.next_bill_date);
        // 如果 next_bill_date 在本月或之前本月，说明本周期已开始
        // 我们需要判断「上一个账单日」是否在本月
        // 上一个账单日 = next_bill_date 减去一个周期
        // 简化：如果 next_bill_date 在本月内，说明上个周期刚结束，本周期开始于本月
        // 如果 next_bill_date 已过（< today），说明已经到了
        // 如果 next_bill_date 在本月但还没到，也算本月支出
        const nbdMonth = nbd.getFullYear() * 12 + nbd.getMonth();
        const curMonth = currentYear * 12 + currentMonth;
        // next_bill_date 在本月：说明本月需要续费
        if (nbdMonth === curMonth) return true;
        // next_bill_date 已经过了本月（即在未来月份），检查上一次是否在本月
        // 但如果 next_bill_date 就是下个月或更远，说明当前周期跨过了本月
        if (nbdMonth === curMonth + 1 || (nbd <= today && nbdMonth <= curMonth)) return true;
      }
      return false;
    })
    .reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">所有订阅</h1>
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
        ) : subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p>还没有订阅</p>
            <p className="text-sm">点击右上角 + 添加</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {subscriptions.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                onClick={() => setDetailSubId(sub.id)}
              />
            ))}
          </div>
        )}
      </div>

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
