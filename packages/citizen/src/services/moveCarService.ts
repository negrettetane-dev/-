// ===== 智途云枢 · 挪车求助提交服务 =====
// 后端 OpenAPI 目前未提供 POST /api/move-car/requests，
// 因此本服务以「演示模式」提交：上传图片到 /api/upload（后端存在），
// 生成演示请求号，但不会发送真实短信/APP 通知。

export interface MoveCarRequestPayload {
  plateNumber: string;
  lng: number;
  lat: number;
  address: string;
  description: string;
  images: string[];
  locationSource: 'geolocation' | 'map';
}

export interface MoveCarRequestResult {
  id: string | number;
  requestNo: string;
  status: string;
  createTime?: string;
  isDemo: true;
}

/** 上传单张图片到后端，返回 URL */
export async function uploadMoveCarImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('图片上传失败');
  const body = await res.json();
  const url = body?.data?.url || body?.url || body?.data?.path;
  if (!url) throw new Error('图片上传返回无效地址');
  return url;
}

/**
 * 演示提交（后端暂无挪车接口）。
 * 真实接口就绪后，将此处替换为 apiPost('/move-car/requests', payload)。
 */
export async function submitMoveCarRequest(
  payload: MoveCarRequestPayload,
): Promise<MoveCarRequestResult> {
  // 演示模式：不调用后端挪车接口，仅生成演示请求号
  await new Promise(r => setTimeout(r, 600));
  return {
    id: Date.now(),
    requestNo: 'MCR-DEMO-' + Date.now().toString(36).toUpperCase(),
    status: 'demo',
    createTime: new Date().toISOString(),
    isDemo: true,
  };
}
