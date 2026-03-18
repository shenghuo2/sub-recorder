"use client";

import { useState, useEffect } from "react";
import type { Subscription } from "@/lib/types";
import { getBillingCycleShort, cycleToMonths } from "@/lib/types";
import { intToHex, getContrastColor } from "@/lib/color";
import { formatCurrencyCompact, formatCurrencyWithDecimals, convertCurrency, fetchExchangeRates } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Pause } from "lucide-react";
import { getCurrencyConvertEnabled, getTargetCurrency, getCurrencyDecimals, getCycleFormat, getNormalizeCycle } from "@/components/settings-page";

interface Props {
  subscription: Subscription;
  onClick: () => void;
  exchangeRates?: Record<string, number>;
}

export function SubscriptionCard({ subscription: sub, onClick, exchangeRates }: Props) {
  const bgColor = intToHex(sub.color);
  const textColor = getContrastColor(bgColor);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpired = sub.end_date ? new Date(sub.end_date) < today : false;

  // Currency conversion
  const convertEnabled = getCurrencyConvertEnabled();
  const targetCurrency = getTargetCurrency();
  const decimals = getCurrencyDecimals();

  // Compute display price from effective_records
  // If there are effective records, sum them all normalized to month;
  // otherwise fall back to subscription default
  const records = sub.effective_records ?? [];
  const hasRecords = records.length > 0;

  // For display: if only 1 record, show its raw price + cycle;
  // if multiple, show sum normalized to /mo
  let displayPrice: number;
  let displayCurrency: string;
  let displayCycle: string;

  if (!hasRecords) {
    displayPrice = sub.price;
    displayCurrency = sub.currency;
    displayCycle = sub.billing_cycle;
  } else if (records.length === 1) {
    displayPrice = records[0].amount;
    displayCurrency = records[0].currency;
    displayCycle = records[0].billing_cycle || sub.billing_cycle;
  } else {
    // Multiple records: normalize all to monthly and sum (converted to same currency)
    displayCycle = "month_1";
    displayCurrency = sub.currency; // normalize to subscription's base currency
    displayPrice = records.reduce((sum, r) => {
      const months = cycleToMonths(r.billing_cycle || sub.billing_cycle);
      const amountInBase = exchangeRates
        ? (convertCurrency(r.amount, r.currency, sub.currency, exchangeRates, "CNY") ?? r.amount)
        : r.amount;
      return sum + amountInBase / months;
    }, 0);
  }

  // Normalize cycle setting
  const normSetting = getNormalizeCycle();
  const cycleFmt = getCycleFormat();

  // Determine the estimate cycle and converted amount
  let convertedAmount: number | null = null;
  let estimateCycle: string = displayCycle; // cycle for the estimate display

  const needsConversion = convertEnabled && displayCurrency !== targetCurrency && exchangeRates;
  if (needsConversion && exchangeRates) {
    if (normSetting !== "auto" && !sub.is_one_time) {
      // Normalize to the chosen cycle
      const displayMonths = cycleToMonths(displayCycle);
      const targetMonths = cycleToMonths(normSetting);
      const monthly = convertCurrency(displayPrice, displayCurrency, targetCurrency, exchangeRates, "CNY") / displayMonths;
      convertedAmount = monthly * targetMonths;
      estimateCycle = normSetting;
    } else {
      // Keep original cycle
      convertedAmount = convertCurrency(displayPrice, displayCurrency, targetCurrency, exchangeRates, "CNY");
    }
  }

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
      className={`flex items-center gap-3 md:gap-4 rounded-xl p-3 md:p-4 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] shadow-sm ${isExpired ? "opacity-60" : ""}`}
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
          {formatCurrencyCompact(displayPrice, displayCurrency)}
          {!sub.is_one_time && (
            <span className="text-sm font-medium opacity-70">{getBillingCycleShort(displayCycle, getCycleFormat())}</span>
          )}
          {convertedAmount !== null && (
            <span className="opacity-60 ml-1">
              ≈ {formatCurrencyWithDecimals(convertedAmount, targetCurrency, decimals)}
              {!sub.is_one_time && (
                <span className="text-sm">{getBillingCycleShort(estimateCycle, cycleFmt)}</span>
              )}
            </span>
          )}
        </p>
        {hasRecords && (displayPrice !== sub.price || displayCurrency !== sub.currency) && (
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
