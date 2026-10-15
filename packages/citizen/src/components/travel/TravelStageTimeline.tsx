import React from 'react';
import type { TravelStage, TravelStageStatus } from '../../types/travelStage';
import styles from './TravelStageTimeline.module.css';

import type { TransitRealtimeStatus } from '../../services/transitService';

interface TravelStageTimelineProps {
  stages: TravelStage[];
  currentStageIndex: number;
  navStatus: 'navigating' | 'paused' | 'completed' | 'ended';
  onComplete: () => void;
  onResume?: () => void;
  syncState?: 'synced' | 'pending' | 'offline' | 'error';
  transitStatus?: TransitRealtimeStatus | null;
  actionBusy?: boolean;
}

function formatDistance(meters: number | null) {
  if (meters == null) return '距离暂无数据';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}公里` : `${Math.round(meters)}米`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return '预计时间暂无数据';
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}秒`;
  return `${Math.round(seconds / 60)}分钟`;
}

function statusFor(stage: TravelStage, index: number, current: number): TravelStageStatus {
  if (stage.status === 'completed' || index < current) return 'completed';
  if (index === current) return 'current';
  return 'pending';
}

const TravelStageTimeline: React.FC<TravelStageTimelineProps> = ({ stages, currentStageIndex, navStatus, onComplete, onResume, syncState, transitStatus, actionBusy }) => (
  <section className={styles.timeline} aria-label="路线阶段">
    {syncState && <div className={styles.syncState}>{syncState === 'synced' ? '已同步' : syncState === 'pending' ? '同步中…' : syncState === 'offline' ? '离线模式' : '同步失败'}</div>}
    {stages.map((stage, index) => {
      const status = statusFor(stage, index, currentStageIndex);
      const current = status === 'current';
      return (
        <div className={`${styles.stage} ${styles[`stage${status[0].toUpperCase()}${status.slice(1)}`]}`} key={stage.id}>
          <div className={styles.rail}>
            <div className={styles.dot}>{status === 'completed' ? '✓' : index + 1}</div>
            {index < stages.length - 1 && <div className={styles.line} />}
          </div>
          <div className={styles.content}>
            <div className={styles.header}>
              <strong>{stage.name}</strong>
              <span className={styles.status}>{status === 'completed' ? '已完成' : status === 'current' ? '进行中' : '待开始'}</span>
            </div>
            <div className={styles.meta}>{formatDistance(stage.distanceMeters)} · {formatDuration(stage.durationSeconds)}</div>
            {current && (
              <>
                <div className={styles.action}>{stage.nextAction}</div>
                {stage.lineName && <div className={styles.transitInfo}>{stage.lineName}{stage.fromStation ? ` · ${stage.fromStation}` : ''}{stage.toStation ? ` → ${stage.toStation}` : ''}{stage.stationCount ? ` · ${stage.stationCount}站` : ''}</div>}
                {current && transitStatus && <div className={styles.transitStatus}>{transitStatus.status === 'normal' ? '线路正常' : transitStatus.status === 'delayed' ? `线路延误${transitStatus.delaySeconds ? ` ${Math.round(transitStatus.delaySeconds / 60)}分钟` : ''}` : transitStatus.status === 'suspended' ? '线路停运' : transitStatus.status === 'rerouted' ? '线路绕行' : '实时状态暂无数据'}{transitStatus.message ? ` · ${transitStatus.message}` : ''}</div>}
                {navStatus === 'paused' && onResume ? (
                  <button type="button" className={styles.button} disabled={actionBusy} onClick={onResume}>恢复当前阶段</button>
                ) : navStatus === 'navigating' ? (
                  <button type="button" className={styles.button} disabled={actionBusy} onClick={onComplete}>{stage.kind === 'arrive' ? '确认已到达' : stage.requiresConfirmation ? '确认已到站，进入下一阶段' : '下一阶段'}</button>
                ) : null}
              </>
            )}
          </div>
        </div>
      );
    })}
  </section>
);

export default TravelStageTimeline;
