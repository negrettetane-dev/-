import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadAMap } from '../../lib/amap';
import { getTrip } from '../../services/tripService';
import { getTripDisplayMeta, type Trip } from '../../types/trip';
import styles from './MyTrips.module.css';

const STATUS_LABEL = { in_progress: '进行中', completed: '已完成', cancelled: '已取消' };

const TripDetailPage: React.FC = () => {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState('');
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    getTrip(tripId).then(data => { if (alive) setTrip(data); }).catch(() => { if (alive) setError('出行记录不存在或您无权查看'); });
    return () => { alive = false; };
  }, [tripId]);

  useEffect(() => {
    if (!trip?.path?.length || !mapContainer.current || mapRef.current) return;
    let alive = true;
    loadAMap().then(AMap => {
      if (!alive || !mapContainer.current) return;
      const map = new AMap.Map(mapContainer.current, { zoom: 13, viewMode: '2D', resizeEnable: true });
      const route = new AMap.Polyline({ path: trip.path, strokeColor: '#1677ff', strokeWeight: 6, lineJoin: 'round', lineCap: 'round' });
      map.add(route);
      map.setFitView([route], false, [48, 48, 48, 48]);
      mapRef.current = map;
    }).catch(() => undefined);
    return () => { alive = false; mapRef.current?.destroy(); mapRef.current = null; };
  }, [trip]);

  if (error) return <div className={styles.page}><div className={styles.state}><p>{error}</p><button className={styles.primaryButton} onClick={() => navigate('/profile/trips')}>返回我的出行</button></div></div>;
  if (!trip) return <div className={styles.page}><div className={styles.state}>正在加载出行详情...</div></div>;

  const mode = getTripDisplayMeta(trip);
  const distance = trip.actualDistance ?? trip.estimatedDistance;
  const duration = trip.actualDuration ?? trip.estimatedDuration;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.iconButton} onClick={() => navigate('/profile/trips')} aria-label="返回我的出行" title="返回我的出行"><ArrowLeft size={20} /></button>
        <div><h1>出行详情</h1><p>{mode.icon} {mode.label} · {STATUS_LABEL[trip.status]}</p></div>
      </header>
      {trip.path?.length ? <div ref={mapContainer} className={styles.map} /> : null}
      <section className={styles.detailSection}>
        <div className={styles.routeSummary}><strong>{trip.origin.name}</strong><span>→</span><strong>{trip.destination.name}</strong></div>
        <dl className={styles.detailGrid}>
          <div><dt>出发时间</dt><dd>{new Date(trip.startedAt).toLocaleString('zh-CN')}</dd></div>
          <div><dt>结束时间</dt><dd>{trip.endedAt ? new Date(trip.endedAt).toLocaleString('zh-CN') : '--'}</dd></div>
          <div><dt>距离</dt><dd>{(distance / 1000).toFixed(1)}km</dd></div>
          <div><dt>耗时</dt><dd>{Math.max(1, Math.round(duration / 60))}分钟</dd></div>
          <div><dt>碳减排</dt><dd>{trip.carbonSaved}g</dd></div>
          <div><dt>获得积分</dt><dd>{trip.earnedPoints}</dd></div>
          <div><dt>路线来源</dt><dd>高德地图</dd></div>
          <div><dt>数据性质</dt><dd>{trip.dataSource === 'demo' ? '模拟导航数据' : trip.dataSource === 'estimated' ? '估算数据' : '真实数据'}</dd></div>
        </dl>
      </section>
    </div>
  );
};

export default TripDetailPage;
