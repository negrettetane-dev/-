// ===== 交通资讯 =====

export interface TrafficNews {
  id: string;
  category: 'construction' | 'control' | 'policy' | 'safety' | 'holiday';
  title: string;
  summary: string;
  content: string;
  coverImage?: string;
  source: string;
  publishTime: number;
  tags: string[];
}

export const NEWS_CATEGORIES: { value: string; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'construction', label: '道路施工' },
  { value: 'control', label: '交通管制' },
  { value: 'policy', label: '政策法规' },
  { value: 'safety', label: '安全科普' },
  { value: 'holiday', label: '出行提示' },
];
