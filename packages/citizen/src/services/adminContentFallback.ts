export interface FallbackNews {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  publishTime: number;
  tags: string[];
}

interface ManagedNewsRecord {
  id?: string;
  title?: string;
  category?: string;
  summary?: string;
  content?: string;
  status?: string;
  updatedAt?: number;
  createdAt?: number;
}

const CATEGORY_MAP: Record<string, string> = {
  '道路施工': 'construction',
  '交通管制': 'control',
  '政策法规': 'policy',
  '安全科普': 'safety',
  '出行提醒': 'holiday',
  '地铁通知': 'metro',
  '公交调整': 'bus',
};

/**
 * 同源演示部署的回退数据。生产环境仍应由 /api/news 提供数据；端口不同的本地开发服务
 * 不共享 localStorage，因此不会把它误判成跨端同步方案。
 */
export function getManagedNewsFallback(): FallbackNews[] {
  try {
    const raw = localStorage.getItem('zhitu_admin_news');
    const records = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(records)) return [];
    return records
      .filter((record: ManagedNewsRecord) => record?.status === 'published' && record.id && record.title)
      .map((record: ManagedNewsRecord): FallbackNews => ({
        id: String(record.id),
        category: CATEGORY_MAP[record.category || ''] || 'all',
        title: String(record.title),
        summary: String(record.summary || ''),
        content: String(record.content || record.summary || ''),
        source: '智途云枢',
        publishTime: Number(record.updatedAt || record.createdAt || Date.now()),
        tags: record.category ? [record.category] : [],
      }))
      .sort((a: FallbackNews, b: FallbackNews) => b.publishTime - a.publishTime);
  } catch {
    return [];
  }
}
