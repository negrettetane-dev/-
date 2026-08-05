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
