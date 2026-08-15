import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLineDetail, getArrivalInfo } from '../../services/transitService';
import type { TransitLine, ArrivalInfo } from '../../types/transit';
import styles from './MetroDetail.module.css';

const CROWD: Record<string, { emoji: string; label: string; color: string }> = {
  empty: { emoji: '🟢', label: '空闲', color: '#52c41a' },
  normal: { emoji: '🟡', label: '适中', color: '#faad14' },
  crowded: { emoji: '🟠', label: '拥挤', color: '#ff7a00' },
  full: { emoji: '🔴', label: '满载', color: '#f5222d' },
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '即将到站';
  if (seconds < 60) return `${seconds}秒`;
  return `${Math.floor(seconds / 60)}分${seconds % 60 ? `${seconds % 60}秒` : ''}`;
}

const MetroDetailPage: React.FC = () => {
  const { lineId = 'm1' } = useParams<{ lineId: string }>();
  const navigate = useNavigate();
  const [line, setLine] = useState<TransitLine | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [arrival, setArrival] = useState<ArrivalInfo | null>(null);
  const [nextSec, setNextSec] = useState(0);
  const [followSec, setFollowSec] = useState(0);
  const [currentStationIdx, setCurrentStationIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    getLineDetail('metro', lineId).then(d => {
      if (d) { setLine(d); setNotFound(false); }
      else setNotFound(true);
    });
  }, [lineId]);

  // 到站倒计时（每秒递减，归零重新拉取）
  useEffect(() => {
    const loadArrival = () => {
      getArrivalInfo(lineId, `station_${lineId}`).then(a => {
        setArrival(a);
        setNextSec(a.nextArrivalSeconds);
        setFollowSec(a.followingArrivalSeconds);
      });
    };
    loadArrival();
    timerRef.current = setInterval(() => {
      setNextSec(prev => {
        if (prev <= 1) { loadArrival(); return 999; }
        return prev - 1;
      });
      setFollowSec(prev => prev <= 1 ? 999 : prev - 1);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lineId]);

  if (notFound) {
    return <div className={styles.page}><div style={{ textAlign: 'center', padding: 60, color: 'var(--text-hint)' }}>该线路暂未收录</div></div>;
  }
  if (!line) {
    return <div className={styles.page}><div style={{ textAlign: 'center', padding: 60, color: 'var(--text-hint)' }}>加载中...</div></div>;
  }

  const crowd = arrival ? CROWD[arrival.crowdLevel] : CROWD.normal;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.back} onClick={() => navigate('/travel')}>← 返回</span>
        <span className={styles.title}>🚇 {line.name} 线路详情</span>
      </div>

      {/* 线路信息卡 */}
      <div className={styles.lineCard} style={{ borderLeft: `6px solid ${line.color || '#c23a30'}` }}>
        <div className={styles.lineName}>{line.name}</div>
        <div className={styles.lineMeta}>
          <span>方向：{line.direction}</span>
          <span>首班 {line.first} · 末班 {line.last}</span>
        </div>
        <div className={styles.lineStatus}>
          <span className={styles.statusDot} style={{ background: '#52c41a' }} />
          正常运营
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 4 }}>演示数据 · 非官方实时</div>
      </div>

      {/* 实时到站 */}
      <div className={styles.arrivalCard}>
        <div className={styles.arrivalTitle}>🚉 当前站：{line.stations[currentStationIdx]?.name || line.stations[0]?.name}</div>
        <div className={styles.arrivalRow}>
          <div className={styles.arrivalItem}>
            <span className={styles.arrivalLabel}>下一班</span>
            <span className={styles.arrivalVal}>{formatCountdown(nextSec)}</span>
            <span className={styles.arrivalCrowd} style={{ color: crowd.color }}>{crowd.emoji} {crowd.label}</span>
          </div>
          <div className={styles.arrivalItem}>
            <span className={styles.arrivalLabel}>再下一班</span>
            <span className={styles.arrivalVal}>{formatCountdown(followSec)}</span>
          </div>
        </div>
      </div>

      {/* 完整站点列表 */}
      <div className={styles.stationsCard}>
        <div className={styles.stationsTitle}>📍 全线站点（{line.stations.length}站）</div>
        <div className={styles.stationsList}>
          {line.stations.map((s, i) => {
            const isTransfer = s.transferLines && s.transferLines.length > 0;
            return (
              <div key={s.id} className={`${styles.stationRow} ${i === currentStationIdx ? styles.stationCurrent : ''}`} onClick={() => setCurrentStationIdx(i)}>
                <div className={styles.stationDot} style={{ background: line.color || '#c23a30' }} />
                <div className={styles.stationBody}>
                  <span className={styles.stationName}>
                    {s.name}
                    {isTransfer && <span className={styles.transferBadge}>换乘 {s.transferLines!.join('/')}</span>}
                  </span>
                </div>
                <span className={styles.stationSeq}>{i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ height: 32 }} />
    </div>
  );
};

export default MetroDetailPage;
