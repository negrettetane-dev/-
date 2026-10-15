import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTrip } from '../../services/tripService';
import { getTripDisplayMeta, type Trip } from '../../types/trip';
import styles from './Carbon.module.css';

type SettlementState = 'calculating' | 'settled' | 'failed';

const FEEDBACK_OPTIONS = ['推荐准确', '时间不准确', '步行过长', '无障碍信息有误', '路线体验良好'];

function modeEmissionFactor(trip: Trip): number {
  if (trip.mode === 'bus') return 0.07;
  if (trip.mode === 'bike') return 0.015;
  if (trip.mode === 'walk') return 0;
  return trip.profile === 'ev' ? 0.08 : 0.192;
}

const TripSettlementPage: React.FC = () => {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<string[]>([]);

  useEffect(() => {
    getTrip(tripId).then(setTrip).catch(() => setError('暂时无法读取本次出行结算信息'));
  }, [tripId]);

  const summary = useMemo(() => {
    if (!trip) return null;
    const distanceKm = (trip.actualDistance ?? trip.estimatedDistance) / 1000;
    const baselineKg = distanceKm * 0.192;
    const estimatedKg = distanceKm * modeEmissionFactor(trip);
    return { distanceKm, baselineKg, estimatedKg, savedKg: Math.max(trip.carbonSaved / 1000, baselineKg - estimatedKg) };
  }, [trip]);

  if (error) return <div className={styles.settlementPage}><div className={styles.settlementState}><p>{error}</p><button onClick={() => navigate('/profile/trips')}>返回我的出行</button></div></div>;
  if (!trip || !summary) return <div className={styles.settlementPage}><div className={styles.settlementState}>正在计算本次绿色出行结果...</div></div>;

  const serverState = (trip as Trip & { settlementStatus?: SettlementState }).settlementStatus;
  const settlementState: SettlementState = serverState || (trip.status === 'completed' ? 'calculating' : 'failed');
  const stateMeta = settlementState === 'settled'
    ? { label: '已结算', note: '后端已确认本次积分与碳核算结果', className: styles.settled }
    : settlementState === 'failed'
      ? { label: '结算失败', note: '本次出行尚未完成，暂不能发放积分', className: styles.failed }
      : { label: '计算中', note: '当前展示模型估算，后端结算后将自动替换为最终结果', className: styles.calculating };
  const mode = getTripDisplayMeta(trip);

  return (
    <main className={styles.settlementPage}>
      <button className={styles.backButton} onClick={() => navigate(`/profile/trips/${trip.id}`)}>← 返回出行详情</button>
      <section className={styles.settlementHero}>
        <span>{mode.icon}</span>
        <div><p>本次出行已完成</p><h1>{trip.origin.name} → {trip.destination.name}</h1><small>{mode.label} · {summary.distanceKm.toFixed(1)} km</small></div>
      </section>
      <section className={`${styles.settlementStatus} ${stateMeta.className}`}>
        <strong>{stateMeta.label}</strong><span>{stateMeta.note}</span>
      </section>
      <section className={styles.settlementGrid}>
        <div><span>本次估算碳排放</span><b>{summary.estimatedKg.toFixed(2)} kg</b><small>按交通方式与距离模型估算</small></div>
        <div><span>驾车基准碳排放</span><b>{summary.baselineKg.toFixed(2)} kg</b><small>同距离燃油驾车基准</small></div>
        <div><span>预计减少碳排放</span><b>{summary.savedKg.toFixed(2)} kg</b><small>模型估算，仅供参考</small></div>
        <div><span>本次碳积分</span><b>{trip.earnedPoints} 分</b><small>{settlementState === 'settled' ? '已计入积分账户' : '待后端确认'}</small></div>
      </section>
      <p className={styles.factorNote}>碳排放为模型估算值，使用距离 × 交通方式排放因子计算；最终积分和碳核算以服务端结算结果为准。</p>
      <section className={styles.feedbackSection}>
        <h2>这次推荐怎么样？</h2>
        <div className={styles.feedbackOptions}>{FEEDBACK_OPTIONS.map(option => <button key={option} type="button" className={feedback.includes(option) ? styles.feedbackSelected : ''} onClick={() => setFeedback(current => current.includes(option) ? current.filter(item => item !== option) : [...current, option])}>{option}</button>)}</div>
        <small>{feedback.length ? '反馈已记录。' : '请选择最符合本次出行体验的项目。'}</small>
      </section>
      <div className={styles.settlementActions}><button className={styles.secondarySettlementButton} onClick={() => navigate(`/profile/trips/${trip.id}`)}>查看出行详情</button><button className={styles.primarySettlementButton} onClick={() => navigate('/carbon/points-detail')}>查看积分流水</button></div>
    </main>
  );
};

export default TripSettlementPage;
