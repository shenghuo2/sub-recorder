export interface Subscription {
  id: string;
  name: string;
  price: number;
  currency: string;
  billing_cycle: string;
  billing_date: string;
  next_bill_date: string | null;
  end_date: string | null;
  is_one_time: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_until: string | null;
  color: number | null;
  icon: string | null;
  icon_mime_type: string | null;
  should_be_tinted: boolean;
  category_id: number | null;
  notes: string | null;
  link: string | null;
  is_reminder_enabled: boolean;
  reminder_type: string | null;
  scene_id: string | null;
  show_on_main: boolean;
  created_at: string;
  updated_at: string;
  effective_records: EffectiveRecord[];
}

export interface EffectiveRecord {
  amount: number;
  currency: string;
  billing_cycle: string;
}

export interface SubscriptionDetail {
  id: string;
  name: string;
  price: number;
  currency: string;
  billing_cycle: string;
  billing_date: string;
  next_bill_date: string | null;
  end_date: string | null;
  is_one_time: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_until: string | null;
  color: number | null;
  icon: string | null;
  icon_mime_type: string | null;
  should_be_tinted: boolean;
  category_id: number | null;
  notes: string | null;
  link: string | null;
  is_reminder_enabled: boolean;
  reminder_type: string | null;
  scene_id: string | null;
  show_on_main: boolean;
  created_at: string;
  updated_at: string;
  billing_records: BillingRecord[];
  effective_records: EffectiveRecord[];
}

export interface BillingRecord {
  id: number;
  subscription_id: string;
  period_start: string;
  period_end: string;
  amount: number;
  currency: string;
  billing_cycle: string | null;
  notes: string | null;
  paid_at: string | null;
  /** 转换后的金额（按创建时汇率） */
  converted_amount: number | null;
  /** 目标货币 */
  target_currency: string | null;
  /** 汇率（原货币 -> 目标货币） */
  exchange_rate: number | null;
  /** 汇率记录时间点 */
  exchange_rate_date: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: number | null;
  icon: string | null;
  icon_mime_type: string | null;
  fa_icon: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// ========== 场景 ==========

export interface Scene {
  id: string;
  name: string;
  color: number | null;
  icon: string | null;
  icon_mime_type: string | null;
  billing_cycle: string;
  show_sub_logos: boolean;
  notes: string | null;
  link: string | null;
  created_at: string;
}

export interface SubPreview {
  name: string;
  icon: string | null;
  icon_mime_type: string | null;
  price: number;
  currency: string;
  billing_cycle: string;
  effective_records: { amount: number; currency: string; billing_cycle: string }[];
  is_expired: boolean;
  is_suspended: boolean;
  show_on_main: boolean;
}

export interface SceneWithSummary extends Scene {
  sub_count: number;
  total_price: number;
  total_currency: string;
  nearest_next_bill: string | null;
  sub_previews: SubPreview[];
}

export interface SceneDetail extends Scene {
  subscriptions: Subscription[];
}

export const BILLING_CYCLE_LABELS: Record<string, string> = {
  daily: "每天",
  weekly: "每周",
  month_1: "每月",
  month_2: "每2个月",
  month_3: "每季度",
  month_6: "每半年",
  year_1: "每年",
  year_2: "每2年",
  year_3: "每3年",
  custom_days: "自定义",
};

export const BILLING_CYCLE_SHORT_ZH: Record<string, string> = {
  daily: "/天",
  weekly: "/周",
  month_1: "/月",
  month_2: "/2月",
  month_3: "/季",
  month_6: "/半年",
  year_1: "/年",
  year_2: "/2年",
  year_3: "/3年",
};

export const BILLING_CYCLE_SHORT_EN: Record<string, string> = {
  daily: "/d",
  weekly: "/w",
  month_1: "/mo",
  month_2: "/2mo",
  month_3: "/q",
  month_6: "/6mo",
  year_1: "/y",
  year_2: "/2y",
  year_3: "/3y",
};

/** Parse custom_days cycle string like "custom_days:30" and return the number of days */
export function parseCustomDays(cycle: string): number | null {
  if (!cycle) return null;
  if (cycle.startsWith("custom_days:")) {
    const days = parseInt(cycle.split(":")[1], 10);
    return isNaN(days) ? null : days;
  }
  return null;
}

/** Get short label for billing cycle, handling custom_days format */
export function getBillingCycleShort(cycle: string, format: "zh" | "en" = "zh"): string {
  const customDays = parseCustomDays(cycle);
  if (customDays !== null) {
    return format === "en" ? `/${customDays}d` : `/${customDays}天`;
  }
  return format === "en" 
    ? (BILLING_CYCLE_SHORT_EN[cycle] || "") 
    : (BILLING_CYCLE_SHORT_ZH[cycle] || "");
}

/** Get display label for billing cycle, handling custom_days format */
export function getBillingCycleLabel(cycle: string): string {
  const customDays = parseCustomDays(cycle);
  if (customDays !== null) {
    return `每${customDays}天`;
  }
  return BILLING_CYCLE_LABELS[cycle] || cycle;
}

export function cycleToMonths(cycle: string): number {
  if (!cycle) return 1; // default to monthly
  // Handle custom_days:XX format
  const customDays = parseCustomDays(cycle);
  if (customDays !== null) {
    return customDays / 30;
  }
  switch (cycle) {
    case "daily": return 1 / 30;
    case "weekly": return 7 / 30;
    case "month_1": return 1;
    case "month_2": return 2;
    case "month_3": return 3;
    case "month_6": return 6;
    case "year_1": return 12;
    case "year_2": return 24;
    case "year_3": return 36;
    default: return 1;
  }
}

/** List of standard billing cycles for select dropdowns */
export const BILLING_CYCLES = [
  "daily",
  "weekly", 
  "month_1",
  "month_2",
  "month_3",
  "month_6",
  "year_1",
  "year_2",
  "year_3",
  "custom_days",
] as const;

export { SUPPORTED_CURRENCIES as CURRENCIES, getSymbol, formatCurrency, formatCurrencyCompact } from "@/lib/currency";

// 保留旧的 CURRENCY_SYMBOLS 兼容性（从 currency 模块获取）
import { SUPPORTED_CURRENCIES, getSymbol } from "@/lib/currency";
export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c, getSymbol(c)])
);
