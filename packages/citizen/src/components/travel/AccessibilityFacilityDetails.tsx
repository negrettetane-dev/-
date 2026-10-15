import React, { useState } from 'react';
import type { AccessibleRouteOption } from '../../services/accessibilityService';
import styles from './AccessibilityFacilityDetails.module.css';

function statusLabel(status: 'verified' | 'unknown' | 'obstacle') {
  if (status === 'verified') return '已确认';
  if (status === 'obstacle') return '存在障碍';
  return '待确认';
}

interface AccessibilityFacilityDetailsProps {
  option: AccessibleRouteOption;
  onUseAlternative?: (stationName: string) => void;
}

const AccessibilityFacilityDetails: React.FC<AccessibilityFacilityDetailsProps> = ({ option, onUseAlternative }) => {
  const [open, setOpen] = useState(true);
  const facilities = option.metrics.stationFacilities || [];
  return (
    <section className={styles.details} aria-labelledby="accessibility-facility-title">
      <button type="button" className={styles.summaryBtn} aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span id="accessibility-facility-title">站点与入口设施</span>
        <span className={styles.count}>{facilities.length} 个站点 {open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className={styles.list}>
          {facilities.length === 0 ? (
            <div className={styles.warn}>当前路线没有可展示的站点设施数据，系统无法确认电梯、坡道和楼梯情况。</div>
          ) : facilities.map((facility, index) => {
            const recommended = facility.recommendedEntrance;
            const alternatives = facility.entrances.filter(item => !item.recommended && item.status !== 'obstacle' && !item.stairsOnly);
            return (
              <div key={`${facility.stationName}-${index}`} className={styles.station}>
                <div className={styles.stationHead}>
                  <div className={styles.stationName}>{index + 1}. {facility.stationName}</div>
                  <span className={`${styles.badge} ${styles[facility.status]}`}>{statusLabel(facility.status)}</span>
                </div>
                {facility.missing ? (
                  <div className={styles.warn}>该站点暂无完整无障碍设施数据。系统无法确认电梯、坡道和楼梯情况，建议出行前核实或选择其他路线。</div>
                ) : recommended ? (
                  <div className={styles.entrance}>
                    推荐使用 <strong>{recommended.name}</strong>：{recommended.reason}
                    <div>设施：{recommended.elevator ? '有电梯' : '无电梯数据'} · {recommended.ramp ? '有坡道' : '无坡道数据'} · {recommended.wheelchairAccessible ? '轮椅可通行' : '轮椅通行待确认'}</div>
                    <div>数据：{facility.source === 'backend' ? '后端设施数据' : '演示设施数据'}{facility.lastVerifiedAt ? ` · ${new Date(facility.lastVerifiedAt).toLocaleDateString()}` : ''}</div>
                  </div>
                ) : (
                  <div className={styles.warn}>未找到已确认可通行入口，该路线不应标记为全程无障碍。</div>
                )}
                {facility.entrances.length > 0 && (
                  <div className={styles.entranceList}>
                    {facility.entrances.map(entrance => (
                      <span key={entrance.name} className={styles.chip}>{entrance.name} · {statusLabel(entrance.status)}{entrance.stairsOnly ? ' · 楼梯' : ''}{entrance.elevator ? ' · 电梯' : ''}{entrance.ramp ? ' · 坡道' : ''}</span>
                    ))}
                  </div>
                )}
                {alternatives.length > 0 && recommended?.status === 'obstacle' && (
                  <button type="button" className={styles.action} onClick={() => onUseAlternative?.(facility.stationName)}>使用替代入口</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default AccessibilityFacilityDetails;
