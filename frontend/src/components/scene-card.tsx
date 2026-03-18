"use client";

import { useMemo } from "react";
import type { SceneWithSummary } from "@/lib/types";
import { getBillingCycleShort, cycleToMonths } from "@/lib/types";
import { getCycleFormat, getTargetCurrency } from "@/components/settings-page";
import { formatCurrencyCompact, convertCurrency } from "@/lib/currency";
import { intToHex, getContrastColor } from "@/lib/color";
import { Layers } from "lucide-react";

interface Props {
  scene: SceneWithSummary;
  onClick: () => void;
  exchangeRates?: Record<string, number>;
}

export function SceneCard({ scene, onClick, exchangeRates = {} }: Props) {
  const bgColor = scene.color ? intToHex(scene.color) : "#6366f1";
  const textColor = getContrastColor(bgColor);

  // Compute currency-converted total using effective_records
  const displayCurrency = getTargetCurrency();
  const sceneMonths = cycleToMonths(scene.billing_cycle);
  const convertedTotal = useMemo(() => {
    return scene.sub_previews.reduce((sum, p) => {
      // Skip expired and suspended
      if (p.is_expired || p.is_suspended) return sum;

      const records = p.effective_records ?? [];
      if (records.length > 0) {
        // Use effective records for price
        return sum + records.reduce((s, r) => {
          const months = cycleToMonths(r.billing_cycle || p.billing_cycle);
          const monthly = convertCurrency(r.amount, r.currency, displayCurrency, exchangeRates) / months;
          return s + monthly * sceneMonths;
        }, 0);
      }
      // Fallback to base price
      const price = p.price ?? 0;
      const currency = p.currency ?? "CNY";
      const subMonths = cycleToMonths(p.billing_cycle);
      const monthly = price / subMonths;
      const normalized = monthly * sceneMonths;
      return sum + convertCurrency(normalized, currency, displayCurrency, exchangeRates);
    }, 0);
  }, [scene.sub_previews, sceneMonths, exchangeRates, displayCurrency]);

  const nextDateStr = scene.nearest_next_bill
    ? new Date(scene.nearest_next_bill).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : null;

  return (
    <div
      className="flex items-center gap-3 md:gap-4 rounded-xl p-3 md:p-4 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] shadow-sm"
      style={{ backgroundColor: bgColor, color: textColor }}
      onClick={onClick}
    >
      {/* Icon */}
      <div className="h-10 w-10 shrink-0 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden">
        {scene.icon ? (
          <img
            src={`data:${scene.icon_mime_type || "image/png"};base64,${scene.icon}`}
            alt={scene.name}
            className="h-8 w-8 object-contain"
          />
        ) : (
          <Layers className="h-5 w-5" style={{ color: textColor }} />
        )}
      </div>

      {/* Name + sub count + mini logos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-['MiSans'] font-bold text-lg truncate">{scene.name}</p>
          <span className="text-xs opacity-70 shrink-0">
            {scene.sub_count}个子项
          </span>
        </div>
        {/* Mini logos */}
        {scene.show_sub_logos && scene.sub_previews.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            {scene.sub_previews.slice(0, 6).map((p, i) => (
              <div key={i} className="h-5 w-5 rounded bg-white/20 flex items-center justify-center overflow-hidden">
                {p.icon ? (
                  <img
                    src={`data:${p.icon_mime_type || "image/png"};base64,${p.icon}`}
                    alt={p.name}
                    className="h-4 w-4 object-contain"
                  />
                ) : (
                  <span className="text-[8px] font-bold" style={{ color: textColor }}>
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            ))}
            {scene.sub_previews.length > 6 && (
              <span className="text-[10px] opacity-60">+{scene.sub_previews.length - 6}</span>
            )}
          </div>
        )}
      </div>

      {/* Right side: price + next payment */}
      <div className="text-right shrink-0">
        <p className="font-bold text-lg">
          {formatCurrencyCompact(convertedTotal, displayCurrency)}
          <span className="text-sm font-medium opacity-70">
            {getBillingCycleShort(scene.billing_cycle, getCycleFormat())}
          </span>
        </p>
        <p className="text-xs opacity-70">
          {nextDateStr ? `最近付款 ${nextDateStr}` : "—"}
        </p>
      </div>
    </div>
  );
}
