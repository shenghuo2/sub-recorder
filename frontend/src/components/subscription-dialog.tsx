"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Subscription, Category } from "@/lib/types";
import { BILLING_CYCLES } from "@/lib/types";
import { SUPPORTED_CURRENCIES as CURRENCIES, getSymbol } from "@/lib/currency";
import { PRESET_COLORS } from "@/lib/color";
import { intToHex, hexToInt } from "@/lib/color";
import * as api from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription | null;
  categories: Category[];
  onSaved: () => void;
}

export function SubscriptionDialog({
  open,
  onOpenChange,
  subscription,
  categories,
  onSaved,
}: Props) {
  const isEdit = !!subscription;

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("CNY");
  const [billingCycle, setBillingCycle] = useState("month_1");
  const [billingDate, setBillingDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isOneTime, setIsOneTime] = useState(false);
  const [color, setColor] = useState("#6366f1");
  const [categoryId, setCategoryId] = useState<string>("");
  const [shouldBeTinted, setShouldBeTinted] = useState(false);
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (subscription) {
        setName(subscription.name);
        setPrice(String(subscription.price));
        setCurrency(subscription.currency);
        setBillingCycle(subscription.billing_cycle);
        setBillingDate(subscription.billing_date);
        setEndDate(subscription.end_date || "");
        setIsOneTime(subscription.is_one_time);
        setColor(intToHex(subscription.color));
        setShouldBeTinted(subscription.should_be_tinted ?? false);
        setCategoryId(subscription.category_id ? String(subscription.category_id) : "");
        setNotes(subscription.notes || "");
        setLink(subscription.link || "");
      } else {
        setName("");
        setPrice("");
        setCurrency("CNY");
        setBillingCycle("month_1");
        setBillingDate(new Date().toISOString().split("T")[0]);
        setEndDate("");
        setIsOneTime(false);
        setColor("#6366f1");
        setShouldBeTinted(false);
        setCategoryId("");
        setNotes("");
        setLink("");
      }
    }
  }, [open, subscription]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("请输入名称");
      return;
    }
    if (!price || isNaN(Number(price))) {
      toast.error("请输入有效价格");
      return;
    }
    if (!billingDate) {
      toast.error("请选择账单日期");
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        price: Number(price),
        currency,
        billing_cycle: billingCycle,
        billing_date: billingDate,
        end_date: endDate || null,
        is_one_time: isOneTime,
        color: hexToInt(color),
        should_be_tinted: shouldBeTinted,
        category_id: categoryId ? Number(categoryId) : null,
        notes: notes.trim() || null,
        link: link.trim() || null,
      };

      if (isEdit) {
        await api.updateSubscription(subscription!.id, data);
        toast.success("已更新");
      } else {
        await api.createSubscription(data);
        toast.success("已创建");
      }
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑订阅" : "添加订阅"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* 名称 */}
          <div className="grid gap-2">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：Netflix"
            />
          </div>

          {/* 价格 + 货币 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 grid gap-2">
              <Label htmlFor="price">价格</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label>货币</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {getSymbol(c)} {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 计费周期 */}
          <div className="grid gap-2">
            <Label>计费周期</Label>
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BILLING_CYCLES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 账单日期 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="billingDate">开始日期</Label>
              <Input
                id="billingDate"
                type="date"
                value={billingDate}
                onChange={(e) => setBillingDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* 一次性 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isOneTime"
              checked={isOneTime}
              onChange={(e) => setIsOneTime(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="isOneTime">一次性付费</Label>
          </div>

          {/* 颜色 */}
          <div className="grid gap-2">
            <Label>颜色</Label>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                    boxShadow: color === c ? `0 0 0 2px ${c}` : "none",
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
              {/* 自定义颜色选择器 */}
              <label className="h-7 w-7 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform overflow-hidden relative">
                <span className="text-xs text-muted-foreground">+</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-6 w-6 rounded border" style={{ backgroundColor: color }} />
              <Input
                value={color}
                onChange={(e) => {
                  let v = e.target.value;
                  if (!v.startsWith("#")) v = "#" + v;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v);
                }}
                className="w-28 h-8 text-xs font-mono"
                placeholder="#6366f1"
              />
            </div>
          </div>

          {/* 图标着色 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="shouldBeTinted"
              checked={shouldBeTinted}
              onChange={(e) => setShouldBeTinted(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="shouldBeTinted">图标着色（自动黑/白对比）</Label>
          </div>

          {/* 分类 */}
          {categories.length > 0 && (
            <div className="grid gap-2">
              <Label>分类</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="无分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">无分类</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 备注 */}
          <div className="grid gap-2">
            <Label htmlFor="notes">备注</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="可选"
            />
          </div>

          {/* 链接 */}
          <div className="grid gap-2">
            <Label htmlFor="link">链接</Label>
            <Input
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="可选"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : isEdit ? "更新" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
