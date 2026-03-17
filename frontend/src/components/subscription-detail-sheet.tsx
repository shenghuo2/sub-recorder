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
} from "lucide-react";
import type { Subscription, SubscriptionDetail, BillingRecord } from "@/lib/types";
import { BILLING_CYCLES } from "@/lib/types";
import { formatCurrencyCompact } from "@/lib/currency";
import { intToHex, getContrastColor } from "@/lib/color";
import { IconUpload } from "@/components/icon-upload";
import * as api from "@/lib/api";

interface Props {
  subscriptionId: string | null;
  onClose: () => void;
  onEdit: (sub: Subscription) => void;
  onRefresh: () => void;
}

export function SubscriptionDetailSheet({
  subscriptionId,
  onClose,
  onEdit,
  onRefresh,
}: Props) {
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // 暂停/恢复 dialog
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendDate, setSuspendDate] = useState("");
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeDate, setResumeDate] = useState("");

  // 添加账单记录 dialog
  const [billingOpen, setBillingOpen] = useState(false);
  const [brStart, setBrStart] = useState("");
  const [brEnd, setBrEnd] = useState("");
  const [brAmount, setBrAmount] = useState("");
  const [brCurrency, setBrCurrency] = useState("");
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
      await api.createBillingRecord(detail.id, {
        period_start: brStart,
        period_end: brEnd,
        amount: brAmount ? Number(brAmount) : undefined,
        currency: brCurrency || undefined,
        notes: brNotes || null,
        paid_at: brPaidAt || null,
      });
      toast.success("账单记录已添加");
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
    setBrStart(detail.billing_date);
    setBrEnd(detail.next_bill_date || today);
    setBrAmount("");
    setBrCurrency(detail.currency);
    setBrNotes("");
    setBrPaidAt(today);
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
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
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
                        {BILLING_CYCLES[detail.billing_cycle] || detail.billing_cycle}
                        {detail.is_one_time && " · 一次性"}
                      </p>
                    </div>
                  </div>
                </SheetHeader>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    {formatCurrencyCompact(detail.effective_price, detail.effective_currency)}
                  </span>
                  {(detail.effective_price !== detail.price ||
                    detail.effective_currency !== detail.currency) && (
                    <span className="text-sm opacity-70 ml-2 line-through">
                      {formatCurrencyCompact(detail.price, detail.currency)}
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
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {formatCurrencyCompact(record.amount, record.currency)}
                            </span>
                            {record.notes && (
                              <span className="text-xs text-muted-foreground">
                                {record.notes}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {record.period_start} → {record.period_end}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteBilling(record)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
            <DialogTitle>添加账单记录</DialogTitle>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillingOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddBilling}>添加</Button>
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
