// ===== 智途云枢 · API Client =====
import axios from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@zhitu/shared';

export class ApiError extends Error {
  constructor(message: string, public readonly code?: string | number, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function errorPayload(data: unknown): { message?: string; code?: string | number } {
  if (!data || typeof data !== 'object') return {};
  const payload = data as Record<string, unknown>;
  const detail = payload.detail;
  if (detail && typeof detail === 'object') {
    const nested = detail as Record<string, unknown>;
    return {
      message: typeof nested.message === 'string' ? nested.message : undefined,
      code: typeof nested.code === 'string' || typeof nested.code === 'number' ? nested.code : undefined,
    };
  }
  return {
    message: typeof payload.message === 'string' ? payload.message : undefined,
    code: typeof payload.code === 'string' || typeof payload.code === 'number' ? payload.code : undefined,
  };
}

async function fetchAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const query = config.params ? new URLSearchParams(Object.entries(config.params).flatMap(([key, value]) => value == null ? [] : [[key, String(value)]])).toString() : '';
  const url = `${config.baseURL || ''}${config.url || ''}${query ? `?${query}` : ''}`;
  const response = await window.fetch(url, {
    method: config.method?.toUpperCase(),
    headers: config.headers as HeadersInit,
    body: config.data,
  });
  const data = await response.json();
  return {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    config,
    request: null,
  };
}

const apiClient = axios.create({
  baseURL: '/api/admin',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  adapter: import.meta.env.VITE_ENABLE_MOCK === 'true'
    ? (config) => fetchAdapter(config)
    : undefined,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('zhitu_admin_token') || localStorage.getItem('zhitu_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponse;
    if (data.code !== 0) {
      return Promise.reject(new ApiError(data.message || '请求失败', data.code, response.status));
    }
    return response;
  },
  (error) => {
    const { message, code } = errorPayload(error?.response?.data);
    return Promise.reject(new ApiError(message || error?.message || '请求失败', code, error?.response?.status));
  },
);

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await apiClient.get<ApiResponse<T>>(url, { params });
  return response.data.data;
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.post<ApiResponse<T>>(url, data);
  return response.data.data;
}

export async function apiPut<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.put<ApiResponse<T>>(url, data);
  return response.data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await apiClient.delete<ApiResponse<T>>(url);
  return response.data.data;
}

export default apiClient;
