export interface AdminIncidentUpload {
  uploadId: string;
  url: string;
  thumbnailUrl?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: 'uploaded' | string;
  expiresAt?: string;
}

interface ApiEnvelope<T> {
  code: string | number;
  message?: string;
  data?: T;
  detail?: { code?: string | number; message?: string };
}

export class IncidentImageUploadError extends Error {
  constructor(message: string, public readonly code?: string | number, public readonly status?: number) {
    super(message);
    this.name = 'IncidentImageUploadError';
  }
}

const statusMessage = (status: number): string | undefined => {
  if (status === 401) return '管理员登录状态已失效，请重新登录';
  if (status === 403) return '当前管理员无权更新该事件';
  if (status === 404) return '事件不存在或已被删除';
  if (status === 413) return '单张处理后图片不能超过 10MB';
  if (status === 415) return '仅支持 JPG、PNG、WebP 图片';
  if (status === 429) return '上传过于频繁，请稍后重试';
  return undefined;
};

export async function uploadIncidentAfterImage(incidentId: string, file: File): Promise<AdminIncidentUpload> {
  const token = localStorage.getItem('zhitu_admin_token');
  if (!token) throw new IncidentImageUploadError('管理员登录状态已失效，请重新登录', 'ADMIN_AUTH_REQUIRED', 401);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'incident_after_image');
  formData.append('incidentId', incidentId);

  let response: Response;
  try {
    response = await fetch('/api/admin/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  } catch {
    throw new IncidentImageUploadError(`“${file.name}”上传失败，请检查网络后重试`);
  }

  let body: ApiEnvelope<AdminIncidentUpload> | null = null;
  try {
    body = await response.json() as ApiEnvelope<AdminIncidentUpload>;
  } catch {
    // 非 JSON 响应由下方统一映射。
  }

  const detail = body?.detail;
  const code = detail?.code ?? body?.code;
  const message = detail?.message || body?.message || statusMessage(response.status);
  if (!response.ok || (body && body.code !== 0)) {
    throw new IncidentImageUploadError(message || `“${file.name}”上传失败，请稍后重试`, code, response.status);
  }

  const data = body?.data;
  if (!data?.uploadId || !data.url) {
    throw new IncidentImageUploadError('图片上传响应缺少 uploadId 或 url');
  }
  return data;
}
