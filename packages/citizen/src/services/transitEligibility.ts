// ===== 智途云枢 · 公交/地铁同城适用性判断 =====
// 公交/地铁定位为城市公共交通，暂未实现跨城市铁路/高铁/城际联程。
// 第一阶段规则：同城才允许公交规划；跨城市直接拒绝（不调公交接口）。
// 注意：当 city/adcode 缺失时返回 supported=true（不误拦），由 planAmapRoute 的段类型校验兜底。

import type { UnifiedLocation } from '../stores/travelLocationStore';

export interface TransitEligibility {
  supported: boolean;
  reason?: 'CROSS_CITY_TRANSIT_UNSUPPORTED' | 'DATA_INCOMPLETE';
  message?: string;
}

/** 提取市级标识：优先 adcode 前 4 位；否则城市名（去「市」后缀） */
function cityKey(loc: UnifiedLocation | null): { adcode4?: string; cityName?: string } {
  if (!loc) return {};
  const adcode4 = loc.adcode && loc.adcode.length >= 4 ? loc.adcode.slice(0, 4) : undefined;
  const cityName = (loc.city || '').replace(/市$/, '').trim() || undefined;
  return { adcode4, cityName };
}

export function isTransitSupported(
  origin: UnifiedLocation | null,
  destination: UnifiedLocation | null,
): TransitEligibility {
  if (!origin || !destination) {
    // 缺数据：不误拦，交给段类型校验兜底
    return { supported: true };
  }
  const o = cityKey(origin);
  const d = cityKey(destination);

  // 1) 双方都有 adcode：前 4 位不同 → 跨城市
  if (o.adcode4 && d.adcode4) {
    if (o.adcode4 !== d.adcode4) {
      return {
        supported: false,
        reason: 'CROSS_CITY_TRANSIT_UNSUPPORTED',
        message: '当前起终点不在同一城市，暂不支持跨城市公交/地铁规划。',
      };
    }
    return { supported: true };
  }

  // 2) 双方都有城市名且不同 → 跨城市
  if (o.cityName && d.cityName && o.cityName !== d.cityName) {
    return {
      supported: false,
      reason: 'CROSS_CITY_TRANSIT_UNSUPPORTED',
      message: '当前起终点不在同一城市，暂不支持跨城市公交/地铁规划。',
    };
  }

  // 3) 缺数据：不误拦
  return { supported: true };
}
