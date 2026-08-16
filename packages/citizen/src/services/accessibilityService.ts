// ===== 智途云枢 · 无障碍路线服务 =====
// 职责：在公交/地铁候选方案（routePlanningService.planTransitCandidates 的真实输出）之上，
// 用无障碍设施数据增强并按无障碍目标重排。
// 数据真实性边界：
//   - 路线、耗时、距离、步行距离、换乘次数全部来自高德真实返回值（由 routePlanningService 解析）。
//   - 无障碍设施来自前端演示数据层（accessibilityFacilities.ts），未覆盖站点计为「待确认」，不伪造。
//   - 只对真实返回的方案做评分排序；不凭空生成「3 条路线」——真实方案不足时不伪造额外路线。

import type { PlannedRoute, SegmentData, TransitCandidate } from './routePlanningService';
import { getFacilityForStation } from '../data/accessibilityFacilities';
import {
  calculateAccessibleScore, durationPenalty, buildAccessibleTags,
  type AccessibleRouteMetrics, type AccessibleLevel, type AccessibleScoreResult,
} from '../utils/accessibilityScore';

export interface AccessibleRouteOption {
  /** 方案标识：accessible / fastest / least-walk */
  id: 'accessible' | 'fastest' | 'least-walk';
  label: string;
  icon: string;
  route: PlannedRoute;
  metrics: AccessibleRouteMetrics;
  score: AccessibleScoreResult;
  tags: string[];
  walkingDistance: number;
  transferCount: number;
  duration: number;
  distance: number;
}

/** 从解析后的段列表提取无障碍指标（匹配演示设施数据层） */
export function computeAccessibleMetrics(segments: SegmentData[]): AccessibleRouteMetrics {
  const transitSegments = segments.filter(s => s.type === 'bus' || s.type === 'metro');
  const walkingDistance = segments
    .filter(s => s.type === 'walk')
    .reduce((sum, s) => {
      // 从 instruction 解析「步行 Xkm」（parseTransitPlan 内生成）
      const m = /步行\s*([\d.]+)\s*km/.exec(s.instruction || '');
      return sum + (m ? Number(m[1]) * 1000 : 0);
    }, 0);
  const transferCount = Math.max(0, transitSegments.length - 1);

  // 途经站点（去重）：各段 from/to 站名
  const stationNames = Array.from(new Set(
    transitSegments.flatMap(s => [s.fromStation, s.toStation]).filter(Boolean),
  ) as Set<string>);

  let elevatorCount = 0;
  let accessibleEntranceCount = 0;
  let stairsRiskCount = 0;
  let unknownFacilityCount = 0;

  stationNames.forEach(name => {
    const facility = getFacilityForStation(name);
    if (!facility) {
      // 未收录站点：设施信息待确认
      unknownFacilityCount += 1;
      return;
    }
    const best = facility.entrances
      .slice()
      .sort((a, b) =>
        Number(b.wheelchairAccessible && b.elevator) - Number(a.wheelchairAccessible && a.elevator) ||
        Number(b.wheelchairAccessible) - Number(a.wheelchairAccessible) ||
        Number(b.ramp) - Number(a.ramp),
      )[0];
    if (!best) { unknownFacilityCount += 1; return; }
    if (best.elevator) elevatorCount += 1;
    if (best.wheelchairAccessible) accessibleEntranceCount += 1;
    if (best.stairsOnly) stairsRiskCount += 1;
    if (best.status === 'unknown') unknownFacilityCount += 1;
  });

  const total = stationNames.length || 1;
  return {
    walkingDistance,
    transferCount,
    stationNames,
    elevatorCoverage: elevatorCount / total,
    accessibleEntranceCoverage: accessibleEntranceCount / total,
    stairsRiskCount,
    unknownFacilityCount,
  };
}

/**
 * 从 routePlanningService.planTransitCandidates() 的真实公交候选构建无障碍候选方案。
 * 每个候选按无障碍目标评分；按角色分配（同一真实方案可复用）：
 *   accessible（评分最高）/ fastest（耗时最短）/ least-walk（步行最短）
 */
export function buildAccessibleOptions(candidates: TransitCandidate[]): AccessibleRouteOption[] {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const parsed = candidates.map(candidate => {
    const metrics = computeAccessibleMetrics(candidate.segments);
    const scoreBase = calculateAccessibleScore(metrics);
    const score: AccessibleScoreResult = {
      ...scoreBase,
      score: Math.max(0, Math.min(100, scoreBase.score - durationPenalty(candidate.route.duration))),
    };
    return {
      candidate,
      route: candidate.route,
      metrics,
      score,
      duration: candidate.route.duration,
      walkingDistance: candidate.walkingDistance,
    };
  });

  // 角色分配
  const byScore = [...parsed].sort((a, b) => b.score.score - a.score.score);
  const accessible = byScore[0];
  const byTime = [...parsed].sort((a, b) => a.duration - b.duration)[0];
  const byWalk = [...parsed].sort((a, b) => a.walkingDistance - b.walkingDistance)[0];

  const pick = (item: typeof accessible, id: 'accessible' | 'fastest' | 'least-walk', label: string, icon: string): AccessibleRouteOption => ({
    id,
    label,
    icon,
    route: item.route,
    metrics: item.metrics,
    score: item.score,
    tags: buildAccessibleTags(item.metrics),
    walkingDistance: item.walkingDistance,
    transferCount: item.metrics.transferCount,
    duration: item.duration,
    distance: item.route.distance,
  });

  const options: AccessibleRouteOption[] = [pick(accessible, 'accessible', '无障碍推荐', '♿')];
  if (byTime && byTime !== accessible) {
    options.push(pick(byTime, 'fastest', '时间较短', '⏱'));
  }
  if (byWalk && byWalk !== accessible && byWalk !== byTime) {
    options.push(pick(byWalk, 'least-walk', '移动较少', '🚶'));
  }
  return options;
}

export type { AccessibleLevel };
