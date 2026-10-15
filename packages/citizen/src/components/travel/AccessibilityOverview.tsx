import React from 'react';
import type { AccessibleRouteOption } from '../../services/accessibilityService';
import styles from './AccessibilityOverview.module.css';

function statusText(option: AccessibleRouteOption) {
  if (option.constraintStatus === 'blocked') return { label: '不可通行', className: styles.statusBlocked, prefix: '×' };
  if (option.constraintStatus === 'risk' || option.metrics.unknownFacilityCount > 0) return { label: '有风险', className: styles.statusRisk, prefix: '⚠' };
  return { label: '可通行', className: styles.statusPass, prefix: '✓' };
}

interface AccessibilityOverviewProps {
  option: AccessibleRouteOption;
  sourceLabel: string;
}

const AccessibilityOverview: React.FC<AccessibilityOverviewProps> = ({ option, sourceLabel }) => {
  const status = statusText(option);
  const reasons = option.constraintReasons.length ? option.constraintReasons : option.metrics.constraintReasons || [];
  return (
    <section className={styles.panel} aria-live="polite" aria-labelledby="accessibility-overview-title">
      <div className={styles.header}>
        <div>
          <div id="accessibility-overview-title" className={styles.title}>无障碍概览</div>
          <div className={styles.scoreRow}>
            <span className={styles.score}>{Math.round(option.score.score)}</span>
            <span className={styles.scoreLabel}>分适配度</span>
          </div>
        </div>
        <span className={`${styles.status} ${status.className}`}>{status.prefix} {status.label}</span>
      </div>
      <div className={styles.grid}>
        <div className={styles.item}><span>步行距离</span><b>{Math.round(option.walkingDistance)}米</b></div>
        <div className={styles.item}><span>换乘次数</span><b>{option.transferCount}次</b></div>
        <div className={styles.item}><span>电梯</span><b>{option.metrics.elevatorCount}处</b></div>
        <div className={styles.item}><span>坡道</span><b>{option.metrics.rampCount}处</b></div>
        <div className={styles.item}><span>无障碍入口</span><b>{option.metrics.accessibleEntranceCount}处</b></div>
        <div className={styles.item}><span>楼梯风险</span><b>{option.metrics.stairsRiskCount}处</b></div>
        <div className={styles.item}><span>待确认设施</span><b>{option.metrics.unknownFacilityCount}处</b></div>
        <div className={styles.item}><span>已确认站点</span><b>{option.metrics.verifiedStationCount}/{option.metrics.stationNames.length || 0}</b></div>
      </div>
      {reasons.length > 0 && (
        <div className={styles.notice}>{reasons.slice(0, 2).join('；')}</div>
      )}
      <div className={styles.source}>设施数据来源：{sourceLabel}。未收录站点不会标记为全程无障碍。</div>
    </section>
  );
};

export default AccessibilityOverview;
