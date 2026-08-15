import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, MapPinned, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../../stores/tripStore';
import { getTripDisplayMeta, type Trip } from '../../types/trip';
import styles from './MyTrips.module.css';

type Filter = 'all' | 'drive' | 'bus' | 'bike' | 'walk' | 'ev' | 'accessible';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' }, { key: 'drive', label: '驾车' },
  { key: 'bus', label: '公交地铁' }, { key: 'bike', label: '骑行' },
  { key: 'walk', label: '步行' }, { key: 'ev', label: '新能源' },
  { key: 'accessible', label: '无障碍' },
];

const STATUS_META = {
  in_progress: { label: '进行中', className: styles.statusProgress },
  completed: { label: '已完成', className: styles.statusCompleted },
  cancelled: { label: '已取消', className: styles.statusCancelled },
};

function matchesFilter(trip: Trip, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'ev' || filter === 'accessible') return trip.profile === filter;
  return trip.mode === filter && trip.profile === 'standard';
}

const formatDuration = (seconds: number | null) => seconds ? `${Math.max(1, Math.round(seconds / 60))}分钟` : '--';

const MyTripsPage: React.FC = () => {
  const navigate = useNavigate();
  const { trips, loading, error, loadTrips } = useTripStore();
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => { void loadTrips(); }, [loadTrips]);
  const visibleTrips = useMemo(() => trips.filter(trip => matchesFilter(trip, filter)), [trips, filter]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.iconButton} onClick={() => navigate('/profile')} aria-label="返回个人中心" title="返回个人中心"><ArrowLeft size={20} /></button>
        <div><h1>我的出行</h1><p>导航记录 · 公交地铁 · 骑行步行</p></div>
      </header>

      <div className={styles.filters} role="tablist" aria-label="出行方式筛选">
        {FILTERS.map(item => (
          <button key={item.key} role="tab" aria-selected={filter === item.key} className={filter === item.key ? styles.filterActive : ''} onClick={() => setFilter(item.key)}>{item.label}</button>
        ))}
      </div>

      {loading ? <div className={styles.state}>正在加载出行记录...</div>
        : error ? <div className={styles.state}><p>{error}</p><button className={styles.retryButton} onClick={() => void loadTrips()}><RefreshCw size={16} />重新加载</button></div>
        : visibleTrips.length === 0 ? (
          <div className={styles.state}><MapPinned size={38} /><h2>{filter === 'all' ? '暂无出行记录' : '暂无此类出行'}</h2><p>开始一次导航后，记录会显示在这里。</p><button className={styles.primaryButton} onClick={() => navigate('/travel')}>去规划路线</button></div>
        ) : (
          <div className={styles.list}>
            {visibleTrips.map(trip => {
              const mode = getTripDisplayMeta(trip);
              const status = STATUS_META[trip.status];
              const duration = trip.actualDuration ?? trip.estimatedDuration;
              const distance = trip.actualDistance ?? trip.estimatedDistance;
              return (
                <button key={trip.id} className={styles.tripItem} onClick={() => navigate(`/profile/trips/${trip.id}`)}>
                  <span className={styles.modeIcon}>{mode.icon}</span>
                  <span className={styles.tripBody}>
                    <span className={styles.tripTop}><strong>{mode.label}</strong><span className={`${styles.status} ${status.className}`}>{status.label}</span></span>
                    <span className={styles.route}>{trip.origin.name} → {trip.destination.name}</span>
                    <span className={styles.meta}>{new Date(trip.startedAt).toLocaleString('zh-CN')} · {(distance / 1000).toFixed(1)}km · {formatDuration(duration)}</span>
                    {trip.status === 'completed' && (trip.carbonSaved > 0 || trip.earnedPoints > 0) && <span className={styles.reward}>减少碳排放 {trip.carbonSaved}g · +{trip.earnedPoints}积分</span>}
                  </span>
                  <ChevronRight size={18} className={styles.chevron} />
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
};

export default MyTripsPage;
