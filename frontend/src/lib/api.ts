import type { ApiResponse, Subscription, SubscriptionDetail, BillingRecord, Category, Scene, SceneWithSummary, SceneDetail } from "./types";

function getApiBase(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("sub_recorder_api_url");
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";
}

const API_BASE = typeof window !== "undefined" ? getApiBase() : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456");

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.error || "请求失败");
  }
  return json.data as T;
}

// ========== 订阅 ==========

export async function listSubscriptions(): Promise<Subscription[]> {
  return request<Subscription[]>("/api/subscriptions");
}

export async function getSubscription(id: string): Promise<SubscriptionDetail> {
  return request<SubscriptionDetail>(`/api/subscriptions/${id}`);
}

export async function createSubscription(data: {
  name: string;
  price: number;
  currency: string;
  billing_cycle: string;
  billing_date: string;
  end_date?: string | null;
  is_one_time: boolean;
  color?: number | null;
  icon?: string | null;
  should_be_tinted?: boolean;
  category_id?: number | null;
  notes?: string | null;
  link?: string | null;
  is_reminder_enabled?: boolean;
  reminder_type?: string;
}): Promise<Subscription> {
  return request<Subscription>("/api/subscriptions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSubscription(id: string, data: Record<string, unknown>): Promise<Subscription> {
  return request<Subscription>(`/api/subscriptions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSubscription(id: string): Promise<void> {
  return request<void>(`/api/subscriptions/${id}`, { method: "DELETE" });
}

// ========== 暂停/恢复 ==========

export async function suspendSubscription(id: string, suspendFrom?: string): Promise<Subscription> {
  return request<Subscription>(`/api/subscriptions/${id}/suspend`, {
    method: "POST",
    body: JSON.stringify({ suspend_from: suspendFrom || null }),
  });
}

export async function resumeSubscription(id: string, resumeFrom?: string): Promise<Subscription> {
  return request<Subscription>(`/api/subscriptions/${id}/resume`, {
    method: "POST",
    body: JSON.stringify({ resume_from: resumeFrom || null }),
  });
}

// ========== Icon ==========

export async function uploadIcon(id: string, iconBase64: string, mimeType?: string): Promise<void> {
  return request<void>(`/api/subscriptions/${id}/icon`, {
    method: "PUT",
    body: JSON.stringify({ icon: iconBase64, mime_type: mimeType || "image/png" }),
  });
}

export async function uploadIconFromUrl(id: string, url: string): Promise<void> {
  return request<void>(`/api/subscriptions/${id}/icon-from-url`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function importData(data: unknown[]): Promise<string> {
  return request<string>("/api/import", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getIconUrl(id: string): string {
  return `${API_BASE}/api/subscriptions/${id}/icon`;
}

// ========== 账单记录 ==========

export async function listBillingRecords(subId: string): Promise<BillingRecord[]> {
  return request<BillingRecord[]>(`/api/subscriptions/${subId}/billing-records`);
}

export async function createBillingRecord(subId: string, data: {
  period_start: string;
  period_end: string;
  amount?: number;
  currency?: string;
  billing_cycle?: string;
  notes?: string | null;
  paid_at?: string | null;
}): Promise<BillingRecord> {
  return request<BillingRecord>(`/api/subscriptions/${subId}/billing-records`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBillingRecord(id: number, data: Record<string, unknown>): Promise<BillingRecord> {
  return request<BillingRecord>(`/api/billing-records/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteBillingRecord(id: number): Promise<void> {
  return request<void>(`/api/billing-records/${id}`, { method: "DELETE" });
}

// ========== 分类 ==========

export async function listCategories(): Promise<Category[]> {
  return request<Category[]>("/api/categories");
}

export async function createCategory(data: { name: string; color?: number | null }): Promise<Category> {
  return request<Category>("/api/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCategory(id: number, data: { name?: string; color?: number | null; icon?: string | null; icon_mime_type?: string | null; fa_icon?: string | null }): Promise<Category> {
  return request<Category>(`/api/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: number): Promise<void> {
  return request<void>(`/api/categories/${id}`, { method: "DELETE" });
}

// ========== 场景 ==========

export async function listScenes(): Promise<SceneWithSummary[]> {
  return request<SceneWithSummary[]>("/api/scenes");
}

export async function getScene(id: string): Promise<SceneDetail> {
  return request<SceneDetail>(`/api/scenes/${id}`);
}

export async function createScene(data: {
  name: string;
  color?: number | null;
  billing_cycle?: string;
  show_sub_logos?: boolean;
}): Promise<Scene> {
  return request<Scene>("/api/scenes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateScene(id: string, data: Record<string, unknown>): Promise<Scene> {
  return request<Scene>(`/api/scenes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteScene(id: string): Promise<void> {
  return request<void>(`/api/scenes/${id}`, { method: "DELETE" });
}
