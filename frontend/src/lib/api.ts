import type { ApiResponse, Subscription, SubscriptionDetail, BillingRecord, Category, Scene, SceneWithSummary, SceneDetail } from "./types";

function getApiBase(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("sub_recorder_api_url");
    if (stored) return stored;
  }
  // 默认使用相对路径（通过 Next.js API 路由代理）
  // 开发时可设置 NEXT_PUBLIC_API_URL=http://localhost:3456 直连后端
  return process.env.NEXT_PUBLIC_API_URL || "";
}

// ========== 鉴权相关 ==========

const AUTH_TOKEN_KEY = "sub_recorder_auth_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers,
  });
  
  // 处理 401 未授权
  if (res.status === 401) {
    clearAuthToken();
    // 触发自定义事件通知前端需要登录
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth-required"));
    }
    throw new Error("未授权访问，请先登录");
  }
  
  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.error || "请求失败");
  }
  return json.data as T;
}

// ========== 鉴权 API ==========

export interface AuthCheckResponse {
  require_auth: boolean;
}

export interface LoginResponse {
  token: string;
  username: string;
  require_auth: boolean;
}

export interface UserInfo {
  username: string;
}

const USERNAME_KEY = "sub_recorder_username";

export function getStoredUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USERNAME_KEY);
}

export function setStoredUsername(username: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERNAME_KEY, username);
}

export async function checkAuth(): Promise<AuthCheckResponse> {
  const res = await fetch(`${getApiBase()}/api/auth/check`, {
    headers: { "Content-Type": "application/json" },
  });
  const json: ApiResponse<AuthCheckResponse> = await res.json();
  if (!json.success) {
    throw new Error(json.error || "请求失败");
  }
  return json.data as AuthCheckResponse;
}

export async function login(password: string): Promise<LoginResponse> {
  const res = await fetch(`${getApiBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const json: ApiResponse<LoginResponse> = await res.json();
  if (!json.success) {
    throw new Error(json.error || "登录失败");
  }
  if (json.data?.token) {
    setAuthToken(json.data.token);
  }
  if (json.data?.username) {
    setStoredUsername(json.data.username);
  }
  return json.data as LoginResponse;
}

export async function getUserInfo(): Promise<UserInfo> {
  return request<UserInfo>("/api/auth/user");
}

export async function updateUser(data: {
  username?: string;
  old_password?: string;
  new_password?: string;
}): Promise<{ username: string; token?: string }> {
  const result = await request<{ username: string; token?: string }>("/api/auth/user", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (result.username) {
    setStoredUsername(result.username);
  }
  if (result.token) {
    setAuthToken(result.token);
  }
  return result;
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

export async function fetchImage(url: string): Promise<{ data: string; mime_type: string }> {
  return request<{ data: string; mime_type: string }>("/api/fetch-image", {
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
  return `${getApiBase()}/api/subscriptions/${id}/icon`;
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
  converted_amount?: number;
  target_currency?: string;
  exchange_rate?: number;
  exchange_rate_date?: string;
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
