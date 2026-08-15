import axios from 'axios';
import type { ApiResponse } from '@zhitu/shared';

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
    if (body.code !== 0) return Promise.reject(new Error(body.message || '请求失败'));
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
