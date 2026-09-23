import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';
export type ContentStatus = 'draft' | 'scheduled' | 'published';
export interface ContentNews { id: string; title: string; category: string; summary: string; content: string; status: ContentStatus; scheduledAt?: string | null; publishedAt?: string | null; createdAt: string; updatedAt: string; }
export interface ContentNewsInput { title: string; category: string; summary: string; content: string; status: ContentStatus; scheduledAt?: string | null; }
interface ListResponse { list: ContentNews[]; total: number; }
export const contentService = {
  list: (params?: { status?: ContentStatus }) => apiGet<ListResponse>('/content/news', params),
  create: (data: ContentNewsInput) => apiPost<ContentNews>('/content/news', data),
  update: (id: string, data: ContentNewsInput) => apiPut<ContentNews>(`/content/news/${id}`, data),
  removeDraft: (id: string) => apiDelete<{ success: boolean }>(`/content/news/${id}`),
};
