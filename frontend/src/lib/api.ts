// FlyJaya API client
const BASE_URL_KEY = "fj_base_url";
const TOKEN_KEY = "fj_token";
const USER_KEY = "fj_user";

export const DEFAULT_BASE_URL = "http://localhost:3000";

export function getBaseUrl(): string {
  return localStorage.getItem(BASE_URL_KEY) || DEFAULT_BASE_URL;
}
export function setBaseUrl(url: string) {
  localStorage.setItem(BASE_URL_KEY, url.replace(/\/$/, ""));
}
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function setStoredUser(user: AuthUser | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "crew" | string;
  crew_id: number | null;
  rank?: string | null;
  employee_id?: string | null;
}

export interface ApiError extends Error {
  status: number;
  payload?: any;
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}${path}`, { ...opts, headers });
  const text = await res.text();
  const payload = text ? safeJson(text) : null;

  if (!res.ok) {
    const err = new Error(
      (payload && (payload.message || payload.error)) || `Request failed (${res.status})`
    ) as ApiError;
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload as T;
}

function safeJson(text: string) {
  try { return JSON.parse(text); } catch { return text; }
}

// ---------- Auth ----------
// Crew login directly from crews table using email + employee_id as password
export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  // Crew direct login: hits same endpoint but password = employee_id
  crewLogin: (email: string, employeeId: string) =>
    request<{ token: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: employeeId }),
    }),
  me: () => request<{ user: AuthUser }>("/api/auth/me"),
  registerAdmin: (data: { name: string; email: string; password: string }) =>
    request("/api/auth/register-admin", { method: "POST", body: JSON.stringify(data) }),
};

// ---------- Crews ----------
export interface Crew {
  id: number;
  name: string;
  rank: string;
  employee_id: string;
  status?: string;
  overall_status: "valid" | "warning" | "expired" | string;
  cert_schema?: string;
  is_fa?: boolean;
  email?: string;
  phone?: string;
  license?: string;
  loa?: string;
  basic_indoc_conduct?: string;
  certs?: Record<string, { conduct: string | null; valid: string | null; status: string }>;
}

export interface CrewStats {
  total: number;
  valid: number;
  warning: number;
  expired: number;
  by_rank: Record<string, number>;
}

export interface CrewAlert {
  id: number;
  name: string;
  rank: string;
  employee_id: string;
  cert_name: string;
  valid_date: string;
  days_remaining: number;
}

export const crewsApi = {
  list: (params: { rank?: string; search?: string; status_filter?: string } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && q.append(k, String(v)));
    const qs = q.toString();
    return request<{ data: Crew[] }>(`/api/crews${qs ? `?${qs}` : ""}`);
  },
  stats: () => request<CrewStats>("/api/crews/stats"),
  alerts: (days: number = 90) => {
    const q = new URLSearchParams();
    q.append("days", String(days));
    return request<{ data: CrewAlert[]; days_threshold: number }>(`/api/crews/alerts?${q}`);
  },
  trainingSchema: () =>
    request<{
      pilot: { field: string; months: number }[];
      fa: { field: string; months: number }[];
      end_of_year_certs: string[];
    }>("/api/crews/training-schema"),
  me: () => request<{ data: Crew }>("/api/crews/me"),
  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>("/api/crews/me/password", {
      method: "PUT",
      body: JSON.stringify({ current_password, new_password }),
    }),
  get: (id: number) => request<{ data: Crew }>(`/api/crews/${id}`),
  create: (data: Partial<Crew> & Record<string, any>) =>
    request<{ message: string; data: Crew }>("/api/crews", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<Crew> & Record<string, any>) =>
    request<{ message: string; data: Crew }>(`/api/crews/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    request<{ message: string }>(`/api/crews/${id}`, { method: "DELETE" }),

  bulkImport: (crews: Partial<Crew>[]) =>
    request<{
      message: string;
      inserted: number;
      skipped: number;
      failed: number;
      skipped_detail: { employee_id: string; name: string; reason: string }[];
      failed_detail: { item: any; error: string }[];
    }>('/api/crews/bulk', {
      method: 'POST',
      body: JSON.stringify({ crews }),
    }),
};

// ---------- Schedules ----------
export interface Schedule {
  id: number;
  crew_id?: number | null;
  crew_name: string;
  crew_role: string;
  type: "flight" | "training" | "off" | "standby" | string;
  activity?: string | null;
  date_start: string;
  date_end?: string | null;
  detail?: string | null;
  created_at?: string;
}

export const schedulesApi = {
  list: (params: {
    year?: number;
    month?: number;
    crew_id?: number;
    role?: string;
    type?: string;
    activity?: string;
  } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && v !== "" && q.append(k, String(v)));
    const qs = q.toString();
    return request<{ data: Schedule[]; meta: any }>(`/api/schedules${qs ? `?${qs}` : ""}`);
  },
  summary: (year?: number, month?: number) => {
    const q = new URLSearchParams();
    if (year) q.append("year", String(year));
    if (month) q.append("month", String(month));
    return request<{
      data: {
        by_activity: { activity: string; type: string; crew_role: string; crew_count: string; crew_list: string[] }[];
        crews_active: { crew_name: string; crew_role: string; activities: string[]; total_events: string }[];
      };
      meta: any;
    }>(`/api/schedules/summary${q.toString() ? `?${q}` : ""}`);
  },
  byActivity: (activity: string, year?: number, month?: number) => {
    const q = new URLSearchParams();
    if (year) q.append("year", String(year));
    if (month) q.append("month", String(month));
    return request<{ activity: string; data: any[]; meta: any }>(
      `/api/schedules/activity/${encodeURIComponent(activity)}${q.toString() ? `?${q}` : ""}`
    );
  },
  get: (id: number) => request<{ data: Schedule }>(`/api/schedules/${id}`),
  create: (data: Partial<Schedule>) =>
    request<{ message: string; data: Schedule }>("/api/schedules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  bulk: (schedules: Partial<Schedule>[]) =>
    request<{ message: string; inserted: Schedule[]; failed: any[] }>("/api/schedules/bulk", {
      method: "POST",
      body: JSON.stringify({ schedules }),
    }),
  update: (id: number, data: Partial<Schedule>) =>
    request<{ message: string; data: Schedule }>(`/api/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    request<{ message: string }>(`/api/schedules/${id}`, { method: "DELETE" }),
};

export const healthApi = {
  check: () => request<{ status: string; ts: string }>("/health"),
};