// ===== 智途云枢 · 设施目的地类型 =====
// 停车场 / 充电站的 position:[lng,lat] 在页面边界统一转成 UnifiedLocation（source='facility'）。

import type { UnifiedLocation } from '../stores/travelLocationStore';

export type PlaceType = 'parking' | 'charging';

export interface PlaceDestination extends UnifiedLocation {
  id: string;
  type: PlaceType;
  dataSource: 'backend' | 'third-party' | 'demo';
}
