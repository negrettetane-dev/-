// ===== 智途云枢 · 无障碍路线服务 =====
// 职责：在公交/地铁候选方案（routePlanningService.planTransitCandidates 的真实输出）之上，
// 用无障碍设施数据增强并按无障碍目标重排。
// 数据真实性边界：
//   - 路线、耗时、距离、步行距离、换乘次数全部来自高德真实返回值（由 routePlanningService 解析）。
//   - 无障碍设施来自前端演示数据层（accessibilityFacilities.ts），未覆盖站点计为「待确认」，不伪造。
//   - 只对真实返回的方案做评分排序；不凭空生成「3 条路线」——真实方案不足时不伪造额外路线。

import type { PlannedRoute, SegmentData, TransitCandidate } from './routePlanningService';
import { getFacilityForStation, type FacilityEntrance, type StationFacility } from '../data/accessibilityFacilities';
import {
  calculateAccessibleScore, buildAccessibleTags,
  type AccessibleRouteMetrics, type AccessibleLevel, type AccessibleScoreResult,
  type AccessibleEntranceSummary, type AccessibleStationFacility,
} from '../utils/accessibilityScore';

export type AccessibilityPreference = 'wheelchair' | 'visual' | 'hearing' | 'elderly' | 'stroller';

export const ACCESSIBILITY_PREFERENCE_META: Record<AccessibilityPreference, { label: string; icon: string; hint: string }> = {
  wheelchair: { label: '轮椅出行', icon: '♿', hint: '必须有无障碍入口，避开楼梯' },
  visual: { label: '视障出行', icon: '🦯', hint: '分段文字提示，支持语音播报' },
  hearing: { label: '听障出行', icon: '🧏', hint: '强化文字、颜色和视觉提醒' },
  elderly: { label: '老年人', icon: '🧓', hint: '少换乘、少走路，提示更简短' },
  stroller: { label: '婴儿车', icon: '👶', hint: '优先坡道、电梯，避开台阶' },
};

export interface AccessibilityPreferenceRules {
  hardAvoidStairs: boolean;
  requireAccessibleEntrance: boolean;
  preferElevatorOrRamp: boolean;
  preferShortWalk: boolean;
  preferFewTransfers: boolean;
  textGuidance: boolean;
  visualAlerts: boolean;
  voiceGuidance: boolean;
}

export function getAccessibilityPreferenceRules(preferences: AccessibilityPreference[]): AccessibilityPreferenceRules {
  return {
    hardAvoidStairs: preferences.includes('wheelchair') || preferences.includes('stroller'),
    requireAccessibleEntrance: preferences.includes('wheelchair'),
    preferElevatorOrRamp: preferences.some(item => ['wheelchair', 'stroller'].includes(item)),
    preferShortWalk: preferences.some(item => ['elderly', 'stroller', 'wheelchair'].includes(item)),
    preferFewTransfers: preferences.includes('elderly'),
    textGuidance: preferences.includes('visual') || preferences.includes('hearing') || preferences.includes('elderly'),
    visualAlerts: preferences.includes('hearing') || preferences.includes('visual'),
    voiceGuidance: preferences.includes('visual'),
  };
}

export function getAccessibilityConditionLabels(preferences: AccessibilityPreference[]): string[] {
  const rules = getAccessibilityPreferenceRules(preferences);
  const labels: string[] = [];
  if (rules.requireAccessibleEntrance) labels.push('轮椅通行');
  if (rules.hardAvoidStairs) labels.push('避开楼梯和台阶');
  if (rules.preferElevatorOrRamp) labels.push('优先电梯和坡道');
  if (rules.preferShortWalk) labels.push('步行距离尽量少');
  if (rules.preferFewTransfers) labels.push('优先少换乘');
  if (rules.voiceGuidance) labels.push('分段语音提示');
  if (preferences.includes('hearing')) labels.push('文字和视觉提醒');
  return labels;
}

export function getAccessibilityPreferenceHint(preferences: AccessibilityPreference[]): string {
  if (preferences.includes('wheelchair') || preferences.includes('stroller')) return '优先电梯和坡道，避开已知楼梯风险';
  if (preferences.includes('elderly')) return '优先少换乘、少步行的路线';
  if (preferences.includes('visual')) return '将提供更清晰的分段和语音提示';
  if (preferences.includes('hearing')) return '将提供更明显的视觉状态提醒';
  return '根据当前设施数据筛选无障碍路线';
}

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
  /** 当前偏好下的硬约束状态 */
  constraintStatus: 'pass' | 'risk' | 'blocked';
  constraintReasons: string[];
}

function entranceStatusRank(status: AccessibleEntranceSummary['status']): number {
  return status === 'verified' ? 3 : status === 'unknown' ? 2 : 1;
}

function summarizeEntrance(entrance: FacilityEntrance, recommended: boolean, reason: string): AccessibleEntranceSummary {
  return {
    name: entrance.name,
    status: entrance.status,
    elevator: Boolean(entrance.elevator),
    ramp: Boolean(entrance.ramp),
    stairsOnly: Boolean(entrance.stairsOnly),
    wheelchairAccessible: Boolean(entrance.wheelchairAccessible),
    recommended,
    reason,
  };
}

function chooseFacilityEntrance(facility: StationFacility | null): { summary: AccessibleStationFacility; hasRisk: boolean } {
  if (!facility || !facility.entrances.length) {
    return {
      summary: { stationName: facility?.stationName || '未收录站点', stationId: facility?.stationId, source: facility?.source || 'unavailable', updatedAt: facility?.updatedAt, lastVerifiedAt: facility?.lastVerifiedAt, missing: true, entrances: [], status: 'unknown' },
      hasRisk: true,
    };
  }
  const sorted = facility.entrances.slice().sort((a, b) => {
    const aBlocked = a.status === 'obstacle' || a.stairsOnly || !a.wheelchairAccessible;
    const bBlocked = b.status === 'obstacle' || b.stairsOnly || !b.wheelchairAccessible;
    return Number(aBlocked) - Number(bBlocked)
      || entranceStatusRank(b.status) - entranceStatusRank(a.status)
      || Number(b.elevator) - Number(a.elevator)
      || Number(b.ramp) - Number(a.ramp);
  });
  const recommended = sorted.find(entrance => entrance.status !== 'obstacle' && !entrance.stairsOnly && entrance.wheelchairAccessible);
  const summaries = facility.entrances.map(entrance => summarizeEntrance(
    entrance,
    entrance === recommended,
    entrance === recommended ? (entrance.elevator ? '已确认电梯入口，优先使用' : entrance.ramp ? '已确认坡道入口，优先使用' : '已确认无障碍入口') : entrance.status === 'obstacle' || entrance.stairsOnly ? '存在障碍或楼梯风险，避免使用' : '可作为备选入口',
  ));
  const status = recommended?.status === 'verified' ? 'verified' : recommended ? 'unknown' : 'obstacle';
  return {
    summary: { stationName: facility.stationName, stationId: facility.stationId, source: facility.source, updatedAt: facility.updatedAt, lastVerifiedAt: facility.lastVerifiedAt, missing: false, entrances: summaries, recommendedEntrance: recommended ? summaries.find(item => item.name === recommended.name) : undefined, status },
    hasRisk: !recommended || recommended.status !== 'verified' || summaries.some(item => item.status === 'unknown'),
  };
}

/** 从解析后的段列表提取无障碍指标（匹配演示设施数据层） */
export function computeAccessibleMetrics(segments: SegmentData[], preferences: AccessibilityPreference[] = ['wheelchair']): AccessibleRouteMetrics {
  const transitSegments = segments.filter(s => s.type === 'bus' || s.type === 'metro');
  const walkingDistance = segments
    .filter(s => s.type === 'walk')
    .reduce((sum, s) => {
      // 结构化距离优先；兼容高德生成的「步行 300m」和「步行 0.3km」文案。
      const structuredDistance = Number((s as SegmentData & { distance?: number }).distance);
      if (Number.isFinite(structuredDistance) && structuredDistance >= 0) return sum + structuredDistance;
      const instruction = s.instruction || '';
      const m = /步行\s*([\d.]+)\s*(m|米|km|公里)/i.exec(instruction);
      if (!m) return sum;
      const value = Number(m[1]);
      if (!Number.isFinite(value)) return sum;
      return sum + (/km|公里/i.test(m[2]) ? value * 1000 : value);
    }, 0);
  const transferCount = Math.max(0, transitSegments.length - 1);
  const rules = getAccessibilityPreferenceRules(preferences);

  // 途经站点（去重）：各段 from/to 站名
  const stationNames = Array.from(new Set(
    transitSegments.flatMap(s => [s.fromStation, s.toStation]).filter(Boolean),
  ) as Set<string>);

  let elevatorCount = 0;
  let rampCount = 0;
  let accessibleEntranceCount = 0;
  let stairsRiskCount = 0;
  let unknownFacilityCount = 0;
  let verifiedStationCount = 0;
  const unknownFacilityNames: string[] = [];
  const stationFacilities: AccessibleStationFacility[] = [];
  const constraintReasons: string[] = [];

  stationNames.forEach(name => {
    const facility = getFacilityForStation(name);
    const { summary } = chooseFacilityEntrance(facility);
    const stationSummary = facility ? summary : { ...summary, stationName: name };
    stationFacilities.push(stationSummary);

    if (!facility || stationSummary.missing) {
      unknownFacilityCount += 1;
      unknownFacilityNames.push(name);
      constraintReasons.push(`${name}暂无完整无障碍设施数据`);
      return;
    }

    const recommended = stationSummary.recommendedEntrance;
    if (!recommended) {
      stairsRiskCount += 1;
      constraintReasons.push(`${name}没有已确认可通行入口`);
      return;
    }

    if (recommended.elevator) elevatorCount += 1;
    if (recommended.ramp) rampCount += 1;
    if (recommended.wheelchairAccessible) accessibleEntranceCount += 1;
    if (recommended.status === 'verified') verifiedStationCount += 1;
    if (recommended.status === 'unknown') {
      unknownFacilityCount += 1;
      unknownFacilityNames.push(name);
      constraintReasons.push(`${name}${recommended.name}设施状态待确认`);
    }
    if (recommended.status === 'obstacle' || recommended.stairsOnly) {
      stairsRiskCount += 1;
      constraintReasons.push(`${name}${recommended.name}存在楼梯或障碍风险`);
    }
  });

  if (rules.preferFewTransfers && transferCount > 1) constraintReasons.push(`换乘${transferCount}次，超过老年人出行建议`);
  if (rules.preferShortWalk && walkingDistance > 800) constraintReasons.push(`步行距离${Math.round(walkingDistance)}米，移动距离偏长`);

  const total = stationNames.length || 1;
  const blocked = (rules.hardAvoidStairs && stairsRiskCount > 0)
    || (rules.requireAccessibleEntrance && stationNames.length > 0 && accessibleEntranceCount === 0);
  const risk = unknownFacilityCount > 0 || constraintReasons.length > 0;

  return {
    walkingDistance,
    transferCount,
    stationNames,
    elevatorCoverage: elevatorCount / total,
    accessibleEntranceCoverage: accessibleEntranceCount / total,
    stairsRiskCount,
    unknownFacilityCount,
    unknownFacilityNames,
    stationFacilities,
    accessibleEntranceCount,
    elevatorCount,
    rampCount,
    verifiedStationCount,
    constraintStatus: blocked ? 'blocked' : risk ? 'risk' : 'pass',
    constraintReasons,
  };
}

/**
 * 从 routePlanningService.planTransitCandidates() 的真实公交候选构建无障碍候选方案。
 * 每个候选按无障碍目标评分；按角色分配（同一真实方案可复用）：
 *   accessible（评分最高）/ fastest（耗时最短）/ least-walk（步行最短）
 */
export function buildAccessibleOptions(
  candidates: TransitCandidate[],
  preferences: AccessibilityPreference[] = ['wheelchair'],
): AccessibleRouteOption[] {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const rules = getAccessibilityPreferenceRules(preferences);
  const parsed = candidates.map(candidate => {
    const metrics = computeAccessibleMetrics(candidate.segments, preferences);
    const score = calculateAccessibleScore(metrics, candidate.route.duration);
    const blocked = metrics.constraintStatus === 'blocked';
    return {
      candidate,
      route: candidate.route,
      metrics,
      score,
      duration: candidate.route.duration,
      walkingDistance: candidate.walkingDistance,
      constraintStatus: blocked ? 'blocked' as const : metrics.constraintStatus || 'pass' as const,
      constraintReasons: metrics.constraintReasons || [],
    };
  });

  const viable = parsed.filter(item => item.constraintStatus !== 'blocked');
  const pool = viable.length ? viable : parsed;

  const preferenceAdjusted = pool.map(item => ({
    ...item,
    preferenceScore: item.score.score
      + (rules.preferFewTransfers ? (item.metrics.transferCount <= 1 ? 12 : -item.metrics.transferCount * 8) : 0)
      + (preferences.includes('visual') ? (item.metrics.transferCount <= 1 ? 8 : -item.metrics.transferCount * 3) : 0)
      + (preferences.includes('hearing') ? (item.metrics.unknownFacilityCount === 0 ? 8 : -item.metrics.unknownFacilityCount * 2) : 0)
      + (rules.preferElevatorOrRamp ? (item.metrics.elevatorCoverage + item.metrics.accessibleEntranceCoverage) * 12 + item.metrics.rampCount * 2 : 0)
      + (rules.preferShortWalk ? -Math.min(18, item.metrics.walkingDistance / 80) : 0)
      - (item.constraintStatus === 'risk' ? 10 : 0)
      - (item.constraintStatus === 'blocked' ? 80 : 0),
  }));

  // 角色分配
  const byScore = [...preferenceAdjusted].sort((a, b) => b.preferenceScore - a.preferenceScore);
  const accessible = byScore[0];
  const byTime = [...preferenceAdjusted].sort((a, b) => a.duration - b.duration)[0];
  const byWalk = [...preferenceAdjusted].sort((a, b) => a.walkingDistance - b.walkingDistance)[0];

  const pick = (item: typeof accessible, id: 'accessible' | 'fastest' | 'least-walk', label: string, icon: string): AccessibleRouteOption => ({
    id,
    label: item.constraintStatus === 'blocked' && id === 'accessible' ? '不可通行' : label,
    icon,
    route: item.route,
    metrics: item.metrics,
    score: item.score,
    tags: buildAccessibleTags(item.metrics),
    walkingDistance: item.walkingDistance,
    transferCount: item.metrics.transferCount,
    duration: item.duration,
    distance: item.route.distance,
    constraintStatus: item.constraintStatus,
    constraintReasons: item.constraintReasons,
  });

  const options: AccessibleRouteOption[] = [pick(accessible, 'accessible', '无障碍推荐', '♿')];
  if (byTime && byTime !== accessible && byTime.constraintStatus !== 'blocked') {
    options.push(pick(byTime, 'fastest', '时间较短', '⏱'));
  }
  if (byWalk && byWalk !== accessible && byWalk !== byTime && byWalk.constraintStatus !== 'blocked') {
    options.push(pick(byWalk, 'least-walk', '移动较少', '🚶'));
  }
  return options;
}

export type { AccessibleLevel };
