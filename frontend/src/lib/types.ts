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
  created_at: string;
  updated_at: string;
  effective_price: number;
  effective_currency: string;
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
  created_at: string;
  updated_at: string;
  billing_records: BillingRecord[];
  effective_price: number;
  effective_currency: string;
}

export interface BillingRecord {
  id: number;
  subscription_id: string;
  period_start: string;
  period_end: string;
  amount: number;
  currency: string;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: number | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export const BILLING_CYCLES: Record<string, string> = {
  daily: "每天",
  weekly: "每周",
  month_1: "每月",
  month_2: "每2个月",
  month_3: "每季度",
  month_6: "每半年",
  year_1: "每年",
  year_2: "每2年",
  year_3: "每3年",
};

export { SUPPORTED_CURRENCIES as CURRENCIES, getSymbol, formatCurrency, formatCurrencyCompact } from "@/lib/currency";

// 保留旧的 CURRENCY_SYMBOLS 兼容性（从 currency 模块获取）
import { SUPPORTED_CURRENCIES, getSymbol } from "@/lib/currency";
export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c, getSymbol(c)])
);
