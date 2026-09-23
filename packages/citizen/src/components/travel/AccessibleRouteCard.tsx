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

interface AccessibleRouteCardProps {
  option: AccessibleRouteOption;
  active: boolean;
  onSelect: () => void;
  onStart: () => void;
}

/** ♿ 无障碍路线卡片：显示推荐角色、无障碍条件评级、设施标签、移动/换乘/耗时 */
const AccessibleRouteCard: React.FC<AccessibleRouteCardProps> = ({ option, active, onSelect, onStart }) => {
  const tone = option.score.levelTone;
  const fmtDuration = (s: number) => (s < 3600 ? `${Math.floor(s / 60)}分钟` : `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}min`);

  const riskMessage = option.metrics.stairsRiskCount > 0
    ? `存在 ${option.metrics.stairsRiskCount} 处楼梯风险，可能影响轮椅或婴儿车通行，建议更换方案。`
    : option.score.level === 'caution'
      ? '未发现明确楼梯风险，但步行距离较长，请结合现场情况选择。'
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
        {option.metrics.stairsRiskCount > 0 && <span className={`${styles.statusTag} ${styles.statusObstacle}`}>当前障碍 {option.metrics.stairsRiskCount}</span>}
      </div>

      {riskMessage && (
        <div className={styles.unknown} style={{ color: '#ad6800' }}>
          ⚠ {riskMessage}
        </div>
      )}

      <button
        type="button"
        className={styles.navBtn}
        onClick={(e) => { e.stopPropagation(); onStart(); }}
      >
        ♿ 开始无障碍导航
      </button>
    </div>
  );
};

export default AccessibleRouteCard;
