// ===== 碳普惠 =====

export interface CarbonRecord {
  id: string;
  type: 'bus' | 'metro' | 'bike' | 'walk';
  date: string;
  distance: number;   // 米
  duration: number;   // 秒
  carbonSaved: number; // 克
  points: number;     // 碳积分
  route?: string;
}

export interface CarbonStats {
  totalPoints: number;
  totalCarbonSaved: number; // 克
  treeEquivalent: number;   // 等效植树棵数
  carDistanceSaved: number; // 等效减少驾车里程(km)
  rankPercent: number;      // 排名百分比 0-100
  records: CarbonRecord[];
}

/** 可兑换权益 */
export interface CarbonReward {
  id: string;
  name: string;
  description: string;
  cost: number;      // 所需积分
  type: 'coupon' | 'ticket' | 'discount' | 'physical';
  image: string;
  stock: number;
}

/** 碳积分出行记录的可出行方式（统一英文 key；后端可能返回中文，需归一化） */
export type CarbonTripType = 'bus' | 'metro' | 'bike' | 'walk';

/**
 * 归一化碳积分记录 type：兼容后端返回的中文（"步行"/"公交"）与英文（"walk"/"bus"）。
 * mock 返回英文（trip.mode），真实后端返回中文（"步行"），前端渲染需统一。
 */
export function normalizeCarbonType(raw: unknown): CarbonTripType {
  const s = String(raw || '').toLowerCase().trim();
  if (s.includes('bus') || s.includes('公交') || s.includes('地铁') || s.includes('metro') || s.includes('subway')) {
    return s.includes('地铁') || s.includes('metro') || s.includes('subway') ? 'metro' : 'bus';
  }
  if (s.includes('bike') || s.includes('骑') || s.includes('cycle')) return 'bike';
  if (s.includes('walk') || s.includes('步') || s.includes('foot')) return 'walk';
  return 'walk';
}

/** 碳积分记录类型 → 中文名 + 图标 */
export function carbonTypeMeta(type: CarbonTripType): { label: string; icon: string } {
  switch (type) {
    case 'bus': return { label: '公交', icon: '🚌' };
    case 'metro': return { label: '地铁', icon: '🚇' };
    case 'bike': return { label: '骑行', icon: '🚲' };
    case 'walk': return { label: '步行', icon: '🚶' };
  }
}
