import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTrip, getTripFeedback, submitTripFeedback } from '../../services/tripService';
import { getTripDisplayMeta, type Trip, type TripFeedback, type TripFeedbackTag, type TripSettlementStatus } from '../../types/trip';
import styles from './Carbon.module.css';

type SettlementState = TripSettlementStatus;

const FEEDBACK_OPTIONS: Array<{ value: TripFeedbackTag; label: string }> = [
  { value: 'accurate_recommendation', label: '推荐准确' },
  { value: 'time_inaccurate', label: '时间不准确' },
  { value: 'walking_too_long', label: '步行过长' },
  { value: 'accessibility_wrong', label: '无障碍信息有误' },
  { value: 'good_experience', label: '路线体验良好' },
];

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
  const [feedback, setFeedback] = useState<TripFeedbackTag[]>([]);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [savedFeedback, setSavedFeedback] = useState<TripFeedback | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  useEffect(() => {
    getTrip(tripId).then(setTrip).catch(() => setError('暂时无法读取本次出行结算信息'));
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    getTripFeedback(tripId).then(item => {
      if (!item) return;
      setSavedFeedback(item);
      setFeedback(item.tags);
      setFeedbackComment(item.comment || '');
    }).catch(() => undefined);
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

  const serverState = trip.settlementStatus;
  const settlementState: SettlementState = serverState || (trip.status === 'completed' ? 'calculating' : 'failed');
  const stateMeta = settlementState === 'settled'
    ? { label: '已结算', note: '后端已确认本次积分与碳核算结果', className: styles.settled }
    : settlementState === 'failed'
      ? { label: '结算失败', note: '本次出行尚未完成，暂不能发放积分', className: styles.failed }
      : { label: '计算中', note: '当前展示模型估算，后端结算后将自动替换为最终结果', className: styles.calculating };
  const mode = getTripDisplayMeta(trip);
  const canSubmitFeedback = Boolean(feedback.length || feedbackComment.trim()) && !feedbackSubmitting;
  const handleSubmitFeedback = async () => {
    if (!canSubmitFeedback) return;
    setFeedbackSubmitting(true);
    setFeedbackError('');
    setFeedbackMessage('');
    try {
      const item = await submitTripFeedback(trip.id, { tags: feedback, comment: feedbackComment.trim() || undefined });
      setSavedFeedback(item);
      setFeedback(item.tags);
      setFeedbackComment(item.comment || '');
      setFeedbackMessage('反馈已提交，感谢帮助我们优化路线推荐。');
    } catch {
      setFeedbackError('反馈提交失败，请稍后重试。');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

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
        <div className={styles.feedbackOptions}>{FEEDBACK_OPTIONS.map(option => <button key={option.value} type="button" className={feedback.includes(option.value) ? styles.feedbackSelected : ''} onClick={() => setFeedback(current => current.includes(option.value) ? current.filter(item => item !== option.value) : [...current, option.value])}>{option.label}</button>)}</div>
        <textarea className={styles.feedbackTextarea} value={feedbackComment} maxLength={300} onChange={event => setFeedbackComment(event.target.value)} placeholder="补充说明，可选。例如：哪一段时间不准、哪段步行过长。" />
        <div className={styles.feedbackFooter}>
          <small>{savedFeedback ? `已提交于 ${new Date(savedFeedback.updatedAt).toLocaleString('zh-CN')}` : '请选择标签或填写补充说明后提交。'}</small>
          <button type="button" className={styles.feedbackSubmit} disabled={!canSubmitFeedback} onClick={handleSubmitFeedback}>{feedbackSubmitting ? '提交中...' : savedFeedback ? '更新反馈' : '提交反馈'}</button>
        </div>
        {feedbackMessage && <div className={styles.feedbackSuccess}>{feedbackMessage}</div>}
        {feedbackError && <div className={styles.feedbackError}>{feedbackError}</div>}
      </section>
      <div className={styles.settlementActions}><button className={styles.secondarySettlementButton} onClick={() => navigate(`/profile/trips/${trip.id}`)}>查看出行详情</button><button className={styles.primarySettlementButton} onClick={() => navigate('/carbon/points-detail')}>查看积分流水</button></div>
    </main>
  );
};

export default TripSettlementPage;
