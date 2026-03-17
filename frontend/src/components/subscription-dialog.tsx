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
import { parseFaIcon, getFaClass } from "@/lib/fa-icons";
import { IconUpload } from "@/components/icon-upload";

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
  const [color, setColor] = useState("#ffffff");
  const [categoryId, setCategoryId] = useState<string>("");
  const [shouldBeTinted, setShouldBeTinted] = useState(false);
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [isReminderEnabled, setIsReminderEnabled] = useState(true);
  const [reminderType, setReminderType] = useState("one_day");
  const [saving, setSaving] = useState(false);
  const [icon, setIcon] = useState<string | null>(null);
  const [iconMimeType, setIconMimeType] = useState<string | null>(null);

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
        setCategoryId(subscription.category_id ? String(subscription.category_id) : "__none__");
        setNotes(subscription.notes || "");
        setLink(subscription.link || "");
        setIsReminderEnabled(subscription.is_reminder_enabled);
        setReminderType(subscription.reminder_type || "one_day");
        setIcon(subscription.icon || null);
        setIconMimeType(subscription.icon_mime_type || null);
      } else {
        setName("");
        setPrice("");
        setCurrency("CNY");
        setBillingCycle("month_1");
        setBillingDate(new Date().toISOString().split("T")[0]);
        setEndDate("");
        setIsOneTime(false);
        setColor("#ffffff");
        setShouldBeTinted(false);
        setCategoryId("__none__");
        setNotes("");
        setLink("");
        setIsReminderEnabled(true);
        setReminderType("one_day");
        setIcon(null);
        setIconMimeType(null);
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
        category_id: categoryId && categoryId !== "__none__" ? Number(categoryId) : null,
        notes: notes.trim() || null,
        link: link.trim() || null,
        is_reminder_enabled: isReminderEnabled,
        reminder_type: reminderType,
      };

      if (isEdit) {
        await api.updateSubscription(subscription!.id, data);
        // Upload icon if changed
        if (icon && iconMimeType && icon !== subscription?.icon) {
          await api.uploadIcon(subscription!.id, icon, iconMimeType);
        }
        toast.success("已更新");
      } else {
        const created = await api.createSubscription(data);
        // Upload icon for new subscription
        if (icon && iconMimeType && created?.id) {
          await api.uploadIcon(created.id, icon, iconMimeType);
        }
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
          {/* 图标 + 名称 */}
          <div className="flex gap-4 items-start">
            <div className="shrink-0">
              <Label className="text-xs text-muted-foreground mb-1 block">图标</Label>
              <IconUpload
                subscriptionId={subscription?.id}
                currentIcon={icon}
                currentMimeType={iconMimeType}
                onUpdated={(newIcon, newMime) => {
                  if (newIcon && newMime) {
                    setIcon(newIcon);
                    setIconMimeType(newMime);
                  }
                }}
              />
            </div>
            <div className="flex-1 grid gap-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：Netflix"
              />
            </div>
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
                  <SelectItem value="__none__">无分类</SelectItem>
                  {categories.map((cat) => {
                    const parsed = cat.fa_icon ? parseFaIcon(cat.fa_icon) : null;
                    const iconCls = parsed ? getFaClass(parsed.name, parsed.style) : (cat.fa_icon ? `fa-solid ${cat.fa_icon}` : null);
                    return (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        <span className="flex items-center gap-2">
                          {iconCls && <i className={`${iconCls} text-xs text-muted-foreground`} />}
                          {cat.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 提醒 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isReminderEnabled"
              checked={isReminderEnabled}
              onChange={(e) => setIsReminderEnabled(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="isReminderEnabled">到期提醒</Label>
          </div>

          {isReminderEnabled && (
            <div className="grid gap-2">
              <Label>提醒时间</Label>
              <Select value={reminderType} onValueChange={setReminderType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same_day">当天</SelectItem>
                  <SelectItem value="one_day">提前 1 天</SelectItem>
                  <SelectItem value="three_days">提前 3 天</SelectItem>
                  <SelectItem value="one_week">提前 1 周</SelectItem>
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
