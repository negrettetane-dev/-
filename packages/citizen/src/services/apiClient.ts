import axios from 'axios';
import type { ApiResponse } from '@zhitu/shared';

/** 业务错误：保留后端返回的 code（字符串业务码或数字）与 HTTP status，供上层做友好映射 */
export class ApiError extends Error {
  constructor(message: string, public readonly code?: string | number, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  adapter: import.meta.env.VITE_ENABLE_MOCK === 'true' ? 'fetch' : undefined,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('zhitu_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse;
    // 后端成功响应用 code=0；非 0（含字符串业务码）为业务错误，保留 code 供上层映射
    if (body.code !== 0) {
      return Promise.reject(new ApiError(body.message || '请求失败', body.code, response.status));
    }
    return response;
  },
  (error) => {
    const config = error?.config;
    console.error('API request failed', {
      url: config ? `${config.baseURL || ''}${config.url || ''}` : undefined,
      method: config?.method?.toUpperCase(),
      payload: config?.data,
      status: error?.response?.status,
      response: error?.response?.data,
      error,
    });
    return Promise.reject(error);
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

export default apiClient;
