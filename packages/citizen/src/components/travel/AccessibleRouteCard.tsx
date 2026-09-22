import React from 'react';
import type { AccessibleRouteOption } from '../../services/accessibilityService';
import styles from './AccessibleRouteCard.module.css';

const LEVEL_TONE_TEXT: Record<string, string> = {
  green: '#52c41a',
  blue: '#1677ff',
  orange: '#fa8c16',
  red: '#f5222d',
};

const LEVEL_BG: Record<string, string> = {
  green: '#f6ffed',
  blue: '#f0f5ff',
  orange: '#fff7e6',
  red: '#fff1f0',
};

const RISK_COLOR: Record<'低' | '中' | '高', string> = {
  低: '#389e0d',
  中: '#d48806',
  高: '#cf1322',
};

interface AccessibleRouteCardProps {
  option: AccessibleRouteOption;
  active: boolean;
  onSelect: () => void;
  onStart: () => void;
}

function getAccessibleRiskLabel(option: AccessibleRouteOption): '低' | '中' | '高' {
  if (option.constraintStatus === 'blocked' || option.score.level === 'not_recommended' || option.metrics.stairsRiskCount > 0) return '高';
  if (option.constraintStatus === 'risk' || option.score.level === 'caution' || option.metrics.unknownFacilityCount > 0) return '中';
  return '低';
}

function getAccessibleOverallScore(option: AccessibleRouteOption): number {
  const durationPenalty = Math.min(18, option.duration / 60 * 0.25);
  const walkingPenalty = Math.min(14, option.walkingDistance / 90);
  const transferPenalty = option.transferCount * 4;
  const carbonBonus = 3;
  return Math.max(60, Math.min(98, Math.round(option.score.score - durationPenalty - walkingPenalty - transferPenalty + carbonBonus)));
}

/** ♿ 无障碍路线卡片：显示推荐角色、无障碍条件评级、设施标签、移动/换乘/耗时 */
const AccessibleRouteCard: React.FC<AccessibleRouteCardProps> = ({ option, active, onSelect, onStart }) => {
  const tone = option.score.levelTone;
  const fmtDuration = (s: number) => (s < 3600 ? `${Math.floor(s / 60)}分钟` : `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}min`);
  const carbonKg = option.distance / 1000 * 0.045;
  const congestionRisk = getAccessibleRiskLabel(option);
  const overallScore = getAccessibleOverallScore(option);

  const riskMessage = option.constraintStatus === 'blocked'
    ? `该路线不满足本次无障碍硬约束：${option.constraintReasons.join('；') || '存在不可通行设施'}。`
    : option.metrics.stairsRiskCount > 0
      ? `存在 ${option.metrics.stairsRiskCount} 处楼梯风险，可能影响轮椅或婴儿车通行，建议更换方案。`
    : option.score.level === 'caution'
      ? option.metrics.unknownFacilityCount > 0
        ? `未发现明确楼梯风险，但步行距离较长，且有 ${option.metrics.unknownFacilityCount} 个站点设施状态待确认。`
        : '未发现明确楼梯风险，但步行距离较长，请结合现场情况选择。'
      : option.metrics.unknownFacilityCount > 0
        ? `部分无障碍设施信息待确认（${option.metrics.unknownFacilityCount} 个站点未覆盖），请根据现场标识通行。`
        : '';
  const confirmedCount = Math.max(0, option.metrics.stationNames.length - option.metrics.unknownFacilityCount - option.metrics.stairsRiskCount);

  return (
    <div className={`${styles.card} ${active ? styles.cardActive : ''}`} onClick={onSelect}>
      {/* 方案名 + 角色 */}
      <div className={styles.head}>
        <span className={styles.role}>{option.icon} {option.label}</span>
        <span className={styles.level} style={{ background: LEVEL_BG[tone], color: LEVEL_TONE_TEXT[tone] }}>
          {option.score.levelLabel}
        </span>
      </div>

      {/* 耗时 / 距离 */}
      <div className={styles.stats}>
        <span className={styles.duration}>{fmtDuration(option.duration)}</span>
        <span className={styles.distance}>{(option.distance / 1000).toFixed(1)}km</span>
      </div>

      {/* 移动 / 换乘 */}
      <div className={styles.metrics}>
        <span>🚶 轮椅/步行移动 {Math.round(option.walkingDistance)}m</span>
        <span>🔄 换乘 {option.transferCount} 次</span>
      </div>

      <div className={styles.metricGrid} aria-label={`${option.label}方案指标`}>
        <div className={styles.metricItem}>
          <span>预计时间</span>
          <b>{fmtDuration(option.duration)}</b>
        </div>
        <div className={styles.metricItem}>
          <span>预计费用</span>
          <b>{Math.round(option.route.cost || 0)}元</b>
        </div>
        <div className={styles.metricItem}>
          <span>步行距离</span>
          <b>{Math.round(option.walkingDistance)}米</b>
        </div>
        <div className={styles.metricItem}>
          <span>换乘次数</span>
          <b>{option.transferCount}次</b>
        </div>
        <div className={styles.metricItem}>
          <span>碳排放</span>
          <b>{carbonKg.toFixed(1)}kg</b>
        </div>
        <div className={styles.metricItem}>
          <span>拥堵风险</span>
          <b style={{ color: RISK_COLOR[congestionRisk] }}>{congestionRisk}</b>
        </div>
        <div className={styles.metricItem}>
          <span>无障碍评分</span>
          <b>{Math.round(option.score.score)}</b>
        </div>
        <div className={styles.metricItem}>
          <span>综合评分</span>
          <b>{overallScore}</b>
        </div>
      </div>

      {/* 无障碍特征标签 */}
      {option.tags.length > 0 && (
        <div className={styles.tags}>
          {option.tags.map((tag, i) => (
            <span key={i} className={styles.tag}>{tag}</span>
          ))}
        </div>
      )}

      <div className={styles.statusList} aria-label="无障碍设施状态">
        {confirmedCount > 0 && <span className={`${styles.statusTag} ${styles.statusVerified}`}>已确认可用 {confirmedCount}</span>}
        {option.metrics.unknownFacilityCount > 0 && <span className={`${styles.statusTag} ${styles.statusUnknown}`}>状态未知 {option.metrics.unknownFacilityCount}</span>}
        {option.metrics.stairsRiskCount > 0 && <span className={`${styles.statusTag} ${styles.statusObstacle}`}>当前障碍 {option.metrics.stairsRiskCount}</span>}
        {!confirmedCount && !option.metrics.unknownFacilityCount && !option.metrics.stairsRiskCount && <span className={`${styles.statusTag} ${styles.statusUnknown}`}>状态未知</span>}
      </div>

      {riskMessage && (
        <div className={styles.unknown} style={{ color: '#ad6800' }}>
          ⚠ {riskMessage}
          {option.metrics.unknownFacilityNames?.length ? (
            <div style={{ marginTop: 4, fontSize: 12 }}>待确认站点：{option.metrics.unknownFacilityNames.join('、')}</div>
          ) : null}
        </div>
      )}

      <button
        type="button"
        className={styles.navBtn}
        disabled={option.constraintStatus === 'blocked'}
        onClick={(e) => { e.stopPropagation(); onStart(); }}
      >
        {option.constraintStatus === 'blocked' ? '该路线不可通行' : '♿ 开始无障碍导航'}
      </button>
    </div>
  );
};

export default AccessibleRouteCard;
