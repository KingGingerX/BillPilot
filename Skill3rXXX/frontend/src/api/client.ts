/**
 * Axios API client with automatic JWT injection and token refresh.
 * On a 401 response (expired access token), it automatically calls /auth/refresh
 * and retries the original request with the new token.
 */
import axios, { AxiosRequestConfig } from "axios";
import { useAuthStore } from "../store";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ── Request interceptor — attach Bearer token ─────────────────

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor — auto refresh on 401 ───────────────

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      const { refreshToken, updateTokens, logout } = useAuthStore.getState();
      if (!refreshToken) {
        logout();
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken: newAccess, refreshToken: newRefresh } = data.data;
        updateTokens(newAccess, newRefresh);
        processQueue(null, newAccess);
        original.headers = { ...original.headers, Authorization: `Bearer ${newAccess}` };
        isRefreshing = false;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        logout();
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ── Typed endpoint helpers ────────────────────────────────────

export const authApi = {
  login:          (data: { email: string; password: string }) => api.post("/auth/login", data),
  register:       (data: object) => api.post("/auth/register", data),
  me:             () => api.get("/auth/me"),
  logout:         (refreshToken: string) => api.post("/auth/logout", { refreshToken }),
  forgotPassword: (email: string) => api.post("/auth/forgot-password", { email }),
  resetPassword:  (token: string, password: string) => api.post("/auth/reset-password", { token, password }),
};

export const productsApi = {
  list:       (status?: string) => api.get("/products", { params: { status } }),
  get:        (id: string)     => api.get(`/products/${id}`),
  getBySlug:  (slug: string)   => api.get(`/products/slug/${slug}`),
  create:     (data: object)   => api.post("/products", data),
  update:     (id: string, data: object) => api.patch(`/products/${id}`, data),
  delete:     (id: string)     => api.delete(`/products/${id}`),
  checkout:   (data: object)   => api.post("/products/checkout", data),
  revenue:    ()               => api.get("/products/admin/revenue"),
};

export const subscriptionsApi = {
  plans:      ()               => api.get("/subscriptions/plans"),
  me:         ()               => api.get("/subscriptions/me"),
  checkout:   (data: object)   => api.post("/subscriptions/checkout", data),
  cancel:     ()               => api.post("/subscriptions/cancel"),
  reactivate: ()               => api.post("/subscriptions/reactivate"),
  changePlan: (planId: string) => api.post("/subscriptions/change-plan", { planId }),
  revenue:    ()               => api.get("/subscriptions/admin/revenue"),
};

export const affiliatesApi = {
  apply:     ()               => api.post("/affiliates/apply"),
  me:        ()               => api.get("/affiliates/me"),
  stats:     ()               => api.get("/affiliates/me/stats"),
  payouts:   ()               => api.get("/affiliates/me/payouts"),
  requestPayout: (method: string) => api.post("/affiliates/me/payout", { method }),
  updatePayout:  (data: object)   => api.patch("/affiliates/me/payout", data),
  adminList: ()               => api.get("/affiliates/admin/all"),
};

export const analyticsApi = {
  revenue:    ()               => api.get("/analytics/revenue"),
  snapshots:  (days?: number)  => api.get("/analytics/snapshots", { params: { days } }),
  topProducts: (limit?: number) => api.get("/analytics/top-products", { params: { limit } }),
};

export const contentApi = {
  list:     ()             => api.get("/content"),
  get:      (id: string)   => api.get(`/content/${id}`),
  create:   (data: object) => api.post("/content", data),
  delete:   (id: string)   => api.delete(`/content/${id}`),
  generate: (data: object) => api.post("/content/generate", data),
  stats:    ()             => api.get("/content/stats"),
};
