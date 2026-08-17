import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bus, RefreshCw, Ticket } from 'lucide-react';
import {
  customBusReservationService,
  ReservationServiceError,
  type CustomBusReservation,
} from '../../services/customBusReservationService';
import styles from './MyReservations.module.css';

const STATUS_META: Record<CustomBusReservation['status'], { label: string; className: string }> = {
  pending: { label: '待乘车', className: styles.statusPending },
  completed: { label: '已完成', className: styles.statusCompleted },
  cancelled: { label: '已取消', className: styles.statusCancelled },
  expired: { label: '已过期', className: styles.statusExpired },
};

const MyReservationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<CustomBusReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 取消预约：确认弹窗 + 提交状态
  const [cancelTarget, setCancelTarget] = useState<CustomBusReservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await customBusReservationService.getMyReservations();
      setReservations(list);
    } catch (e) {
      if (e instanceof ReservationServiceError) {
        // 未接入后端时显示明确提示，绝不展示静态演示预约。
        setError(e.code === 'SERVICE_UNAVAILABLE' ? '预约服务暂未接入' : e.message);
      } else {
        setError('预约记录加载失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const confirmCancel = () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    setCancelError('');
    customBusReservationService.cancelReservation(cancelTarget.id)
      .then(() => {
        // 取消成功：本地更新该条状态 + 关闭弹窗，无需整页刷新
        setReservations(prev => prev.map(r =>
          r.id === cancelTarget.id ? { ...r, status: 'cancelled' as const } : r,
        ));
        setCancelTarget(null);
        setCancelling(false);
      })
      .catch((e) => {
        setCancelling(false);
        setCancelError(e instanceof ReservationServiceError ? e.message : '取消失败，请稍后重试');
      });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.iconButton} onClick={() => navigate('/profile')} aria-label="返回个人中心" title="返回个人中心"><ArrowLeft size={20} /></button>
        <div><h1>我的预约</h1><p>定制公交预约记录</p></div>
      </header>

      {loading ? (
        <div className={styles.state}>正在加载预约记录...</div>
      ) : error ? (
        <div className={styles.state}>
          <p>{error}</p>
          <button className={styles.retryButton} onClick={() => void load()}><RefreshCw size={16} />重新加载</button>
        </div>
      ) : reservations.length === 0 ? (
        <div className={styles.state}>
          <Ticket size={38} />
          <h2>暂无预约记录</h2>
          <p>预约定制公交后，记录会显示在这里。</p>
          <button className={styles.primaryButton} onClick={() => navigate('/travel/custom-bus')}>去定制公交</button>
        </div>
      ) : (
        <div className={styles.list}>
          {reservations.map(r => {
            const status = STATUS_META[r.status] || STATUS_META.pending;
            const cancellable = r.status === 'pending';
            return (
              <div key={r.id} className={styles.reservationItem}>
                <span className={styles.modeIcon}><Bus size={22} /></span>
                <span className={styles.resBody}>
                  <span className={styles.resTop}>
                    <strong>{r.routeName}</strong>
                    <span className={`${styles.status} ${status.className}`}>{status.label}</span>
                  </span>
                  <span className={styles.resMeta}>🕒 {r.departureTime} · 🚏 {r.boardingPoint} → {r.destination}</span>
                  <span className={styles.resMeta}>班次 {r.scheduleId} · 预约编号 {r.reservationNo}</span>
                </span>
                {cancellable && (
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => { setCancelTarget(r); setCancelError(''); }}
                  >
                    取消预约
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 取消预约确认弹窗 */}
      {cancelTarget && (
        <div className={styles.modalMask} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="cancel-title">
            <h2 id="cancel-title">取消预约</h2>
            <p>
              确认取消「{cancelTarget.routeName}」？
              <br />
              <span className={styles.resMeta}>班次 {cancelTarget.scheduleId} · {cancelTarget.departureTime}</span>
            </p>
            {cancelError && <p className={styles.cancelError}>{cancelError}</p>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} disabled={cancelling} onClick={() => setCancelTarget(null)}>返回</button>
              <button type="button" className={styles.dangerBtn} disabled={cancelling} onClick={confirmCancel}>
                {cancelling ? '取消中...' : '确认取消'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyReservationsPage;
