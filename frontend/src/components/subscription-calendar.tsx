"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Subscription } from "@/lib/types";
import { intToHex } from "@/lib/color";
import { cn } from "@/lib/utils";

interface Props {
  subscriptions: Subscription[];
  selectedDate: string | null; // "YYYY-MM-DD" or null
  onSelectDate: (date: string | null) => void;
}

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  // Monday = 0, Sunday = 6
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];

  // Previous month padding
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, prevMonthDays - i), inMonth: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  // Next month padding (fill to complete last week row)
  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - startWeekday - daysInMonth + 1;
    cells.push({ date: new Date(year, month + 1, nextDay), inMonth: false });
  }

  return cells;
}

export function SubscriptionCalendar({ subscriptions, selectedDate, onSelectDate }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const cells = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);

  // Build map: "YYYY-MM-DD" -> subscriptions renewing that day
  const renewMap = useMemo(() => {
    const map: Record<string, Subscription[]> = {};
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    for (const sub of subscriptions) {
      if (sub.is_suspended) continue;
      if (sub.end_date && new Date(sub.end_date) < todayDate) continue;
      if (!sub.next_bill_date) continue;
      const key = sub.next_bill_date; // already "YYYY-MM-DD"
      if (!map[key]) map[key] = [];
      map[key].push(sub);
    }
    return map;
  }, [subscriptions]);

  const todayKey = dateKey(today);

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const monthLabel = `${viewYear}年${viewMonth + 1}月`;

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{monthLabel}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] text-muted-foreground font-medium py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0">
        {cells.map((cell, i) => {
          const key = dateKey(cell.date);
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const subs = renewMap[key] || [];
          const hasSubs = subs.length > 0;

          return (
            <button
              key={i}
              onClick={() => {
                if (isSelected) onSelectDate(null);
                else if (hasSubs) onSelectDate(key);
              }}
              className={cn(
                "relative flex flex-col items-center justify-center aspect-square rounded-lg transition-colors text-xs",
                !cell.inMonth && "text-muted-foreground/40",
                cell.inMonth && !isToday && !isSelected && "text-foreground",
                isToday && !isSelected && "bg-primary/10 text-primary font-bold",
                isSelected && "bg-primary text-primary-foreground font-bold",
                hasSubs && cell.inMonth && "cursor-pointer hover:bg-accent",
                !hasSubs && "cursor-default"
              )}
            >
              {/* Date number */}
              <span className="leading-none">{cell.date.getDate()}</span>

              {/* Subscription icon or dot indicator */}
              {hasSubs && cell.inMonth && (
                <div className="absolute bottom-0.5 flex items-center justify-center">
                  {subs.length === 1 && subs[0].icon ? (
                    <img
                      src={`data:${subs[0].icon_mime_type || "image/png"};base64,${subs[0].icon}`}
                      alt=""
                      className="h-3 w-3 rounded-sm object-contain"
                    />
                  ) : subs.length === 1 ? (
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: intToHex(subs[0].color) }}
                    />
                  ) : (
                    <span
                      className={cn(
                        "text-[8px] font-bold leading-none rounded-full min-w-[14px] h-[14px] flex items-center justify-center",
                        isSelected ? "bg-primary-foreground text-primary" : "bg-primary/80 text-primary-foreground"
                      )}
                    >
                      {subs.length}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
