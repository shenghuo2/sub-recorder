"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Pencil,
  Trash2,
  Pause,
  Play,
  Plus,
  Receipt,
  Calendar,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import type { Subscription, SubscriptionDetail, BillingRecord } from "@/lib/types";
import { BILLING_CYCLES, BILLING_CYCLE_LABELS, parseCustomDays, getBillingCycleLabel, getBillingCycleShort } from "@/lib/types";
import { getCycleFormat } from "@/components/settings-page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyCompact, convertCurrency } from "@/lib/currency";
import { getTargetCurrency } from "@/components/settings-page";
import { intToHex, getContrastColor } from "@/lib/color";
import { IconUpload } from "@/components/icon-upload";
import * as api from "@/lib/api";

interface Props {
  subscriptionId: string | null;
  onClose: () => void;
  onEdit: (sub: Subscription) => void;
  onRefresh: () => void;
  exchangeRates?: Record<string, number>;
}

export function SubscriptionDetailSheet({
  subscriptionId,
  onClose,
  onEdit,
  onRefresh,
  exchangeRates = {},
}: Props) {
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // 暂停/恢复 dialog
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendDate, setSuspendDate] = useState("");
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeDate, setResumeDate] = useState("");

  // 添加/编辑账单记录 dialog
  const [billingOpen, setBillingOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null);
  const [brStart, setBrStart] = useState("");
  const [brEnd, setBrEnd] = useState("");
  const [brAmount, setBrAmount] = useState("");
  const [brCurrency, setBrCurrency] = useState("");
  const [brCycle, setBrCycle] = useState("__default__");
  const [brCustomEndDate, setBrCustomEndDate] = useState("");
  const [brNotes, setBrNotes] = useState("");
  const [brPaidAt, setBrPaidAt] = useState("");

  const loadDetail = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const d = await api.getSubscription(subscriptionId);
      setDetail(d);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    if (subscriptionId) {
      loadDetail();
    } else {
      setDetail(null);
    }
  }, [subscriptionId, loadDetail]);

  const handleDelete = async () => {
    if (!detail) return;
    if (!confirm(`确定删除「${detail.name}」？所有账单记录也会一起删除。`)) return;
    try {
      await api.deleteSubscription(detail.id);
      toast.success("已删除");
      onClose();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleSuspend = async () => {
    if (!detail) return;
    try {
      await api.suspendSubscription(detail.id, suspendDate || undefined);
      toast.success("已暂停");
      setSuspendOpen(false);
      loadDetail();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "暂停失败");
    }
  };

  const handleResume = async () => {
    if (!detail) return;
    try {
      await api.resumeSubscription(detail.id, resumeDate || undefined);
      toast.success("已恢复");
      setResumeOpen(false);
      loadDetail();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "恢复失败");
    }
  };

  const handleAddBilling = async () => {
    if (!detail) return;
    if (!brStart || !brEnd) {
      toast.error("请填写周期开始和结束日期");
      return;
    }
    try {
      // Construct billing_cycle value - use custom_days:XX format if custom
      let effectiveCycle: string | undefined = brCycle === "__default__" ? undefined : (brCycle || undefined);
      if (brCycle === "custom_days" && brCustomEndDate && brStart) {
        const start = new Date(brStart);
        const end = new Date(brCustomEndDate);
        const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        effectiveCycle = `custom_days:${diffDays}`;
      }
      
      if (editingRecord) {
        await api.updateBillingRecord(editingRecord.id, {
          period_start: brStart,
          period_end: brEnd,
          amount: brAmount ? Number(brAmount) : undefined,
          currency: brCurrency || undefined,
          billing_cycle: effectiveCycle,
          notes: brNotes || null,
          paid_at: brPaidAt || null,
        });
        toast.success("账单记录已更新");
      } else {
        // Calculate exchange rate info for new billing record
        const recordAmount = brAmount ? Number(brAmount) : detail.price;
        const recordCurrency = brCurrency || detail.currency;
        const targetCurrency = getTargetCurrency();
        let convertedAmount: number | undefined;
        let exchangeRate: number | undefined;
        
        console.log('[BillingRecord] Creating with:', {
          recordAmount,
          recordCurrency,
          targetCurrency,
          exchangeRatesAvailable: Object.keys(exchangeRates).length,
          exchangeRates,
        });
        
        // Always save conversion info if currencies differ, even if rates not loaded yet
        if (recordCurrency !== targetCurrency) {
          if (Object.keys(exchangeRates).length > 0) {
            // Use actual exchange rates
            convertedAmount = convertCurrency(recordAmount, recordCurrency, targetCurrency, exchangeRates);
            exchangeRate = convertedAmount / recordAmount;
            console.log('[BillingRecord] Converted:', { convertedAmount, exchangeRate });
          } else {
            // Rates not loaded yet, save placeholder (will show original amount)
            convertedAmount = recordAmount;
            exchangeRate = 1.0;
            console.log('[BillingRecord] No rates, using placeholder');
          }
        } else {
          console.log('[BillingRecord] Same currency, no conversion needed');
        }

        // Save current date as exchange rate date if conversion happened
        const exchangeRateDate = convertedAmount !== undefined ? new Date().toISOString().split('T')[0] : undefined;

        await api.createBillingRecord(detail.id, {
          period_start: brStart,
          period_end: brEnd,
          amount: brAmount ? Number(brAmount) : undefined,
          currency: brCurrency || undefined,
          billing_cycle: effectiveCycle,
          notes: brNotes || null,
          paid_at: brPaidAt || null,
          converted_amount: convertedAmount,
          target_currency: convertedAmount !== undefined ? targetCurrency : undefined,
          exchange_rate: exchangeRate,
          exchange_rate_date: exchangeRateDate,
        });
        toast.success("账单记录已添加");
      }
      setBillingOpen(false);
      loadDetail();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "添加失败");
    }
  };

  const handleDeleteBilling = async (record: BillingRecord) => {
    if (!confirm("确定删除此账单记录？")) return;
    try {
      await api.deleteBillingRecord(record.id);
      toast.success("已删除");
      loadDetail();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const openAddBilling = () => {
    if (!detail) return;
    const today = new Date().toISOString().split("T")[0];
    setEditingRecord(null);
    setBrStart(detail.billing_date);
    setBrEnd(detail.next_bill_date || today);
    setBrAmount("");
    setBrCurrency(detail.currency);
    setBrCycle("__default__");
    setBrCustomEndDate("");
    setBrNotes("");
    setBrPaidAt(today);
    setBillingOpen(true);
  };

  const openEditBilling = (record: BillingRecord) => {
    if (!detail) return;
    setEditingRecord(record);
    setBrStart(record.period_start);
    setBrEnd(record.period_end);
    setBrAmount(String(record.amount));
    setBrCurrency(record.currency);
    // Handle billing_cycle
    if (record.billing_cycle) {
      const parsedDays = parseCustomDays(record.billing_cycle);
      if (parsedDays !== null) {
        setBrCycle("custom_days");
        const bd = new Date(record.period_start);
        bd.setDate(bd.getDate() + parsedDays);
        setBrCustomEndDate(bd.toISOString().split("T")[0]);
      } else {
        setBrCycle(record.billing_cycle);
        setBrCustomEndDate("");
      }
    } else {
      setBrCycle("__default__");
      setBrCustomEndDate("");
    }
    setBrNotes(record.notes || "");
    setBrPaidAt(record.paid_at || "");
    setBillingOpen(true);
  };

  if (!subscriptionId) return null;

  const bgColor = detail ? intToHex(detail.color) : "#6366f1";
  const textColor = getContrastColor(bgColor);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpired = detail?.end_date ? new Date(detail.end_date) < today : false;

  const tintFilter = detail?.should_be_tinted
    ? textColor === "#000000"
      ? "brightness(0)"
      : "brightness(0) invert(1)"
    : undefined;

  return (
    <>
      <Sheet open={!!subscriptionId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 pb-16 md:pb-0">
          {loading || !detail ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <SheetHeader className="sr-only"><SheetTitle>加载中</SheetTitle></SheetHeader>
              加载中...
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Header with color */}
              <div
                className="p-6 pb-4"
                style={{ backgroundColor: bgColor, color: textColor }}
              >
                <SheetHeader>
                  <div className="flex items-center gap-3">
                    <IconUpload
                      subscriptionId={detail.id}
                      currentIcon={detail.icon}
                      currentMimeType={detail.icon_mime_type}
                      onUpdated={() => { loadDetail(); onRefresh(); }}
                      tintFilter={tintFilter}
                    />
                    <div className="flex-1">
                      <SheetTitle style={{ color: textColor }} className="text-xl">
                        {detail.name}
                      </SheetTitle>
                      <p className="text-sm opacity-80">
                        {getBillingCycleLabel(detail.billing_cycle)}
                        {detail.is_one_time && " · 一次性"}
                      </p>
                    </div>
                  </div>
                </SheetHeader>

                <div className="mt-4 flex items-baseline gap-1 flex-wrap">
                  {(detail.effective_records ?? []).length > 0 ? (
                    <>
                      {detail.effective_records.map((r, i) => (
                        <span key={i} className="text-3xl font-bold">
                          {i > 0 && <span className="text-lg opacity-50 mx-1">+</span>}
                          {formatCurrencyCompact(r.amount, r.currency)}
                          {!detail.is_one_time && (
                            <span className="text-sm font-medium opacity-70">
                              {getBillingCycleShort(r.billing_cycle || detail.billing_cycle, getCycleFormat())}
                            </span>
                          )}
                        </span>
                      ))}
                      <span className="text-sm opacity-70 ml-2 line-through">
                        {formatCurrencyCompact(detail.price, detail.currency)}
                      </span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold">
                      {formatCurrencyCompact(detail.price, detail.currency)}
                      {!detail.is_one_time && (
                        <span className="text-sm font-medium opacity-70">
                          {getBillingCycleShort(detail.billing_cycle, getCycleFormat())}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {detail.is_suspended && (
                  <Badge className="mt-2 bg-white/20 border-0" style={{ color: textColor }}>
                    <Pause className="h-3 w-3 mr-1" />
                    已暂停
                    {detail.suspended_until && ` · 有效至 ${detail.suspended_until}`}
                  </Badge>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 p-4 border-b">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(detail as unknown as Subscription)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  编辑
                </Button>
                {detail.is_suspended ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setResumeDate(new Date().toISOString().split("T")[0]);
                      setResumeOpen(true);
                    }}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    恢复
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSuspendDate(new Date().toISOString().split("T")[0]);
                      setSuspendOpen(true);
                    }}
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    暂停
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive ml-auto"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                {isExpired ? (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">下次账单</span>
                    <span className="text-sm font-medium text-destructive">已过期</span>
                  </div>
                ) : (
                  <InfoRow label="下次账单" value={
                    detail.next_bill_date
                      ? new Date(detail.next_bill_date).toLocaleDateString("zh-CN")
                      : detail.is_suspended ? "已暂停" : "—"
                  } />
                )}
                <InfoRow label="开始日期" value={new Date(detail.billing_date).toLocaleDateString("zh-CN")} />
                {detail.end_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">结束日期</span>
                    <span className={`text-sm font-medium ${isExpired ? "text-destructive" : ""}`}>
                      {new Date(detail.end_date).toLocaleDateString("zh-CN")}
                      {isExpired && " (已过期)"}
                    </span>
                  </div>
                )}
                {detail.notes && <InfoRow label="备注" value={detail.notes} />}
                {detail.link && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">链接</span>
                    <a
                      href={detail.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary flex items-center gap-1 hover:underline"
                    >
                      打开 <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              <Separator />

              {/* Billing Records */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-1.5">
                    <Receipt className="h-4 w-4" />
                    账单记录
                  </h3>
                  <Button size="sm" variant="outline" onClick={openAddBilling}>
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>

                {detail.billing_records.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    暂无账单记录，默认使用订阅价格
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detail.billing_records.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {formatCurrencyCompact(record.amount, record.currency)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {record.billing_cycle ? getBillingCycleLabel(record.billing_cycle) : "默认周期"}
                            </span>
                            {record.notes && (
                              <span className="text-xs text-muted-foreground">
                                · {record.notes}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {record.period_start} → {record.period_end}
                            </p>
                            {record.converted_amount && record.target_currency && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <span>≈ {formatCurrencyCompact(record.converted_amount, record.target_currency)}</span>
                                {record.exchange_rate && (
                                  <span className="opacity-70">
                                    (汇率 {record.exchange_rate.toFixed(4)}
                                    {record.exchange_rate_date && ` @ ${record.exchange_rate_date}`})
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditBilling(record)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteBilling(record)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 暂停 Dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>暂停订阅</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            暂停后，已有的账单记录保留不变，从指定日期起不再计算新的账单周期。
          </p>
          <div className="grid gap-2">
            <Label>暂停生效日期</Label>
            <Input
              type="date"
              value={suspendDate}
              onChange={(e) => setSuspendDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSuspend}>确认暂停</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 恢复 Dialog */}
      <Dialog open={resumeOpen} onOpenChange={setResumeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>恢复订阅</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            恢复后，将从指定日期开始重新计算账单周期。
          </p>
          <div className="grid gap-2">
            <Label>恢复起始日期</Label>
            <Input
              type="date"
              value={resumeDate}
              onChange={(e) => setResumeDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResumeOpen(false)}>
              取消
            </Button>
            <Button onClick={handleResume}>确认恢复</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加账单记录 Dialog */}
      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "编辑账单记录" : "添加账单记录"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>周期开始</Label>
                <Input
                  type="date"
                  value={brStart}
                  onChange={(e) => setBrStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>周期结束</Label>
                <Input
                  type="date"
                  value={brEnd}
                  onChange={(e) => setBrEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 grid gap-2">
                <Label>金额（留空用默认价格）</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={brAmount}
                  onChange={(e) => setBrAmount(e.target.value)}
                  placeholder={detail?.price.toString()}
                />
              </div>
              <div className="grid gap-2">
                <Label>货币</Label>
                <Input
                  value={brCurrency}
                  onChange={(e) => setBrCurrency(e.target.value)}
                  placeholder={detail?.currency}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>计费周期（留空用默认周期）</Label>
              <div className="flex gap-2">
                <Select value={brCycle} onValueChange={setBrCycle}>
                  <SelectTrigger className={brCycle === "custom_days" ? "w-[120px]" : "w-full"}>
                    <SelectValue placeholder={detail ? getBillingCycleLabel(detail.billing_cycle) : "默认"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">默认</SelectItem>
                    {BILLING_CYCLES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {BILLING_CYCLE_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {brCycle === "custom_days" && (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      type="date"
                      value={brCustomEndDate}
                      onChange={(e) => setBrCustomEndDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>付款日期</Label>
              <Input
                type="date"
                value={brPaidAt}
                onChange={(e) => setBrPaidAt(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>备注</Label>
              <Input
                value={brNotes}
                onChange={(e) => setBrNotes(e.target.value)}
                placeholder="如：活动优惠"
              />
            </div>
            
            {/* 汇率信息 - 仅在编辑时显示 */}
            {editingRecord && (
              <div className="grid gap-2 p-3 rounded-lg border bg-muted/50">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">汇率信息</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const recordAmount = brAmount ? Number(brAmount) : editingRecord.amount;
                      const recordCurrency = brCurrency || editingRecord.currency;
                      const targetCurrency = getTargetCurrency();
                      
                      if (recordCurrency === targetCurrency) {
                        toast.info("货币相同，无需换算");
                        return;
                      }
                      
                      if (Object.keys(exchangeRates).length === 0) {
                        toast.error("汇率数据未加载");
                        return;
                      }
                      
                      const convertedAmount = convertCurrency(recordAmount, recordCurrency, targetCurrency, exchangeRates);
                      const exchangeRate = convertedAmount / recordAmount;
                      const exchangeRateDate = new Date().toISOString().split('T')[0];
                      
                      try {
                        await api.updateBillingRecord(editingRecord.id, {
                          converted_amount: convertedAmount,
                          target_currency: targetCurrency,
                          exchange_rate: exchangeRate,
                          exchange_rate_date: exchangeRateDate,
                        });
                        toast.success("汇率已更新");
                        loadDetail();
                        onRefresh();
                        setBillingOpen(false);
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "更新失败");
                      }
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    获取汇率
                  </Button>
                </div>
                {editingRecord.converted_amount && editingRecord.target_currency && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>换算金额: {formatCurrencyCompact(editingRecord.converted_amount, editingRecord.target_currency)}</div>
                    {editingRecord.exchange_rate && (
                      <div>汇率: {editingRecord.exchange_rate.toFixed(4)}</div>
                    )}
                    {editingRecord.exchange_rate_date && (
                      <div>记录时间: {editingRecord.exchange_rate_date}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillingOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddBilling}>{editingRecord ? "保存" : "添加"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
