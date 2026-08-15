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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyReservationsPage;
