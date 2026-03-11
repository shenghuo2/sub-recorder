"use client";

import type { Subscription } from "@/lib/types";
import { intToHex, getContrastColor } from "@/lib/color";
import { formatCurrencyCompact } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Pause } from "lucide-react";

interface Props {
  subscription: Subscription;
  onClick: () => void;
}

export function SubscriptionCard({ subscription: sub, onClick }: Props) {
  const bgColor = intToHex(sub.color);
  const textColor = getContrastColor(bgColor);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpired = sub.end_date ? new Date(sub.end_date) < today : false;

  const nextDateStr = sub.next_bill_date
    ? new Date(sub.next_bill_date).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : null;

  const tintFilter = sub.should_be_tinted
    ? textColor === "#000000"
      ? "brightness(0)"
      : "brightness(0) invert(1)"
    : undefined;

  return (
    <div
      className={`flex items-center gap-4 rounded-xl p-4 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] shadow-sm ${isExpired ? "opacity-60" : ""}`}
      style={{ backgroundColor: bgColor, color: textColor }}
      onClick={onClick}
    >
      {/* Icon */}
      <div className="h-10 w-10 shrink-0 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden">
        {sub.icon ? (
          <img
            src={`data:${sub.icon_mime_type || "image/png"};base64,${sub.icon}`}
            alt={sub.name}
            className="h-8 w-8 object-contain"
            style={tintFilter ? { filter: tintFilter } : undefined}
          />
        ) : (
          <span className="text-lg font-bold" style={{ color: textColor }}>
            {sub.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Name (vertically centered) */}
      <div className="flex-1 min-w-0 flex items-center">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-['MiSans'] font-bold text-lg truncate">{sub.name}</p>
          {isExpired && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-black/20 border-0 shrink-0" style={{ color: textColor }}>
              已过期
            </Badge>
          )}
          {sub.is_suspended && !isExpired && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-white/20 border-0 shrink-0" style={{ color: textColor }}>
              <Pause className="h-3 w-3 mr-0.5" />
              已暂停
            </Badge>
          )}
        </div>
      </div>

      {/* Right side: price + next payment / expired */}
      <div className="text-right shrink-0">
        <p className="font-bold text-lg">
          {formatCurrencyCompact(sub.effective_price ?? sub.price, sub.effective_currency ?? sub.currency)}
        </p>
        {sub.effective_price != null && (sub.effective_price !== sub.price || sub.effective_currency !== sub.currency) && (
          <p className="text-xs opacity-50 line-through">
            {formatCurrencyCompact(sub.price, sub.currency)}
          </p>
        )}
        {isExpired ? (
          <div className="relative inline-block">
            <span className="text-xs opacity-40 blur-[1.5px] select-none">
              {sub.end_date ? new Date(sub.end_date).toLocaleDateString("zh-CN") : "—"}
            </span>
            <span className="absolute inset-0 flex items-center justify-end text-xs font-medium opacity-80">已过期</span>
          </div>
        ) : (
          <p className="text-xs opacity-70">
            {nextDateStr
              ? `下次付款 ${nextDateStr}`
              : sub.is_one_time
              ? "一次性"
              : "—"}
          </p>
        )}
      </div>
    </div>
  );
}
