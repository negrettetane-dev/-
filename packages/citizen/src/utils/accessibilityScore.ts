// ===== 智途云枢 · 无障碍路线评分 =====
// 规则（V1 固定偏好，用户不必设置；后续做成「无障碍偏好」配置）：
//   无障碍设施 35% > 移动距离 25% > 换乘次数 20% > 路线耗时 10% > 信息可靠程度 10%
// 硬性规则：仅楼梯 → 不建议；步行/轮椅移动 > 1000m → 大幅扣分。
// 展示规则：不直接显示数字分，转换为「无障碍条件优秀/较好/部分设施待确认/不建议」。

export interface AccessibleRouteMetrics {
  /** 步行 / 轮椅移动距离（米） */
  walkingDistance: number;
  /** 换乘次数 */
  transferCount: number;
  /** 途经站点（去重） */
  stationNames: string[];
  /** 电梯覆盖比例 0~1 */
  elevatorCoverage: number;
  /** 无障碍入口覆盖比例 0~1 */
  accessibleEntranceCoverage: number;
  /** 存在楼梯风险（仅楼梯入口）的站点数 */
  stairsRiskCount: number;
  /** 设施信息未知的站点数 */
  unknownFacilityCount: number;
}

export type AccessibleLevel = 'excellent' | 'good' | 'partial' | 'not_recommended';

export interface AccessibleScoreResult {
  score: number;
  level: AccessibleLevel;
  levelLabel: string;
  levelTone: 'green' | 'blue' | 'orange' | 'red';
}

/** 满分 100，按权重计算无障碍评分（V1 固定权重） */
export function calculateAccessibleScore(metrics: AccessibleRouteMetrics): AccessibleScoreResult {
  let score = 100;

  // —— 硬性规则 ——
  // 仅楼梯（任一站点只能走楼梯）→ 直接不建议，不靠扣分勉强
  const hasStairsOnly = metrics.stairsRiskCount > 0;
  // 步行/轮椅移动过长 → 大幅扣分
  if (metrics.walkingDistance > 1000) score -= 30;
  else if (metrics.walkingDistance > 500) score -= 15;

  // —— 权重项 ——
  // 无障碍设施 35%（电梯覆盖 15 + 无障碍入口覆盖 15 + 楼梯风险 -5/站 由下方体现）
  score += metrics.elevatorCoverage * 15;
  score += metrics.accessibleEntranceCoverage * 15;
  // 移动距离 25%（每 40m 扣 1 分，封顶 25）
  score -= Math.min(Math.floor(metrics.walkingDistance / 40), 25);
  // 换乘次数 20%（每次换乘扣 10 分，封顶 20）
  score -= Math.min(metrics.transferCount * 10, 20);
  // 路线耗时 10%（每 10 分钟扣 1 分，封顶 10；由调用方传入折算后的 minutesPenalty）
  // 信息可靠程度 10%（每个设施未知站点扣 2 分，封顶 10）
  score -= Math.min(metrics.unknownFacilityCount * 2, 10);
  // 楼梯风险（每站 -5）
  score -= metrics.stairsRiskCount * 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (hasStairsOnly || score < 60) {
    return { score, level: 'not_recommended', levelLabel: '不建议', levelTone: 'red' };
  }
  if (score >= 90) return { score, level: 'excellent', levelLabel: '无障碍条件优秀', levelTone: 'green' };
  if (score >= 75) return { score, level: 'good', levelLabel: '无障碍条件较好', levelTone: 'blue' };
  return { score, level: 'partial', levelLabel: '部分设施待确认', levelTone: 'orange' };
}

/** 耗时折算扣分（供评分用），10 分钟内不扣，超过后每 10 分钟 1 分，封顶 10 */
export function durationPenalty(durationSeconds: number): number {
  const minutes = durationSeconds / 60;
  return Math.min(Math.max(0, Math.floor((minutes - 10) / 10)), 10);
}

/** 无障碍推荐标签（V1 固定偏好：避免楼梯 / 优先电梯 / 减少换乘 / 减少步行） */
export function buildAccessibleTags(metrics: AccessibleRouteMetrics): string[] {
  const tags: string[] = [];
  if (metrics.elevatorCoverage >= 0.5) tags.push('🛗 电梯优先');
  if (metrics.accessibleEntranceCoverage >= 0.5) tags.push('♿ 无障碍入口优先');
  if (metrics.walkingDistance <= 400) tags.push('🚶 少步行');
  if (metrics.transferCount <= 1) tags.push('🔄 少换乘');
  if (metrics.unknownFacilityCount > 0) tags.push('⚠ 部分无障碍设施信息待确认');
  return tags;
}
