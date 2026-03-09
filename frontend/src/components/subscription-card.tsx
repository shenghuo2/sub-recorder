"use client";

import type { Subscription } from "@/lib/types";
import { CURRENCY_SYMBOLS, BILLING_CYCLES } from "@/lib/types";
import { intToHex, getContrastColor } from "@/lib/color";
import { Badge } from "@/components/ui/badge";
import { Pause } from "lucide-react";

interface Props {
  subscription: Subscription;
  onClick: () => void;
}

export function SubscriptionCard({ subscription: sub, onClick }: Props) {
  const bgColor = intToHex(sub.color);
  const textColor = getContrastColor(bgColor);
  const symbol = CURRENCY_SYMBOLS[sub.currency] || sub.currency;
  const cycleName = BILLING_CYCLES[sub.billing_cycle] || sub.billing_cycle;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpired = sub.end_date ? new Date(sub.end_date) < today : false;

  const nextDate = isExpired
    ? null
    : sub.next_bill_date
    ? new Date(sub.next_bill_date).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : sub.is_one_time
    ? "一次性"
    : "—";

  const tintFilter = sub.should_be_tinted
    ? textColor === "#000000"
      ? "brightness(0)"
      : "brightness(0) invert(1)"
    : undefined;

  return (
    <div
      className={`flex items-center gap-4 rounded-xl p-4 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] shadow-sm ${isExpired ? "opacity-70" : ""}`}
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

      {/* Name & cycle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-base truncate">{sub.name}</p>
          {isExpired && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-black/20 border-0" style={{ color: textColor }}>
              已过期
            </Badge>
          )}
          {sub.is_suspended && !isExpired && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-white/20 border-0" style={{ color: textColor }}>
              <Pause className="h-3 w-3 mr-0.5" />
              已暂停
            </Badge>
          )}
        </div>
        {isExpired ? (
          <p className="text-sm opacity-50 blur-[2px] select-none">
            {sub.end_date ? new Date(sub.end_date).toLocaleDateString("zh-CN") : "—"}
          </p>
        ) : (
          <p className="text-sm opacity-80">{nextDate}</p>
        )}
      </div>

      {/* Price */}
      <div className="text-right shrink-0">
        <p className="font-bold text-lg">
          {symbol}
          {sub.price % 1 === 0 ? sub.price : sub.price.toFixed(2)}
        </p>
        <p className="text-xs opacity-70">{cycleName}</p>
      </div>
    </div>
  );
}
