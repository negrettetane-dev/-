import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bus, RefreshCw, Ticket, Plane } from 'lucide-react';
import {
  customBusReservationService,
  ReservationServiceError,
  type CustomBusReservation,
} from '../../services/customBusReservationService';
import { getMyPurchases } from '../../services/longDistanceBusService';
import type { LongDistancePurchase } from '@zhitu/shared';
import styles from './MyReservations.module.css';

/** 合并展示的统一记录：定制公交预约(reservation) 或 长途客运购票(purchase) */
interface TravelOrder {
  id: string;
  kind: 'reservation' | 'purchase';
  routeName: string;
  scheduleId: string;
  orderNo: string;
  departureTime: string;
  boardingPoint: string;
  destination: string;
  status: 'pending' | 'paid' | 'completed' | 'cancelled' | 'expired';
}

const STATUS_META: Record<TravelOrder['status'], { label: string; className: string }> = {
  pending: { label: '待乘车', className: styles.statusPending },
  paid: { label: '已购票', className: styles.statusCompleted },
  completed: { label: '已完成', className: styles.statusCompleted },
  cancelled: { label: '已取消', className: styles.statusCancelled },
  expired: { label: '已过期', className: styles.statusExpired },
};

const MyReservationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<TravelOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 取消预约：确认弹窗 + 提交状态（仅定制公交预约可取消）
  const [cancelTarget, setCancelTarget] = useState<TravelOrder | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 并行拉取：定制公交预约 + 长途客运购票，合并为统一记录
      const [reservations, purchasesResult] = await Promise.all([
        customBusReservationService.getMyReservations().catch(() => [] as CustomBusReservation[]),
        getMyPurchases().catch(() => ({ purchases: [] as LongDistancePurchase[], source: 'demo' as const })),
      ]);
      const resOrders: TravelOrder[] = reservations.map(r => ({
        id: r.id,
        kind: 'reservation' as const,
        routeName: r.routeName,
        scheduleId: r.scheduleId,
        orderNo: r.reservationNo,
        departureTime: r.departureTime,
        boardingPoint: r.boardingPoint,
        destination: r.destination,
        status: r.status === 'completed' ? 'completed' : r.status,
      }));
      const purchaseOrders: TravelOrder[] = purchasesResult.purchases.map(p => ({
        id: p.id,
        kind: 'purchase' as const,
        routeName: p.routeName,
        scheduleId: p.scheduleId,
        orderNo: p.purchaseNo,
        departureTime: `${p.date} ${p.departureTime}`,
        boardingPoint: p.originStation,
        destination: p.destinationStation,
        status: p.status === 'paid' ? 'paid' : p.status,
      }));
      // 按时间倒序（购票/预约先后）
      setOrders([...resOrders, ...purchaseOrders].sort((a, b) => b.departureTime.localeCompare(a.departureTime)));
    } catch (e) {
      if (e instanceof ReservationServiceError) {
        setError(e.code === 'SERVICE_UNAVAILABLE' ? '预约服务暂未接入' : e.message);
      } else {
        setError('记录加载失败，请稍后重试');
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
        setOrders(prev => prev.map(o =>
          o.id === cancelTarget.id ? { ...o, status: 'cancelled' as const } : o,
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
        <div><h1>我的预约/购票</h1><p>定制公交预约 · 长途客运购票</p></div>
      </header>

      {loading ? (
        <div className={styles.state}>正在加载记录...</div>
      ) : error ? (
        <div className={styles.state}>
          <p>{error}</p>
          <button className={styles.retryButton} onClick={() => void load()}><RefreshCw size={16} />重新加载</button>
        </div>
      ) : orders.length === 0 ? (
        <div className={styles.state}>
          <Ticket size={38} />
          <h2>暂无预约/购票记录</h2>
          <p>预约定制公交或购买长途客运票后，记录会显示在这里。</p>
          <button className={styles.primaryButton} onClick={() => navigate('/services')}>去便民服务</button>
        </div>
      ) : (
        <div className={styles.list}>
          {orders.map(o => {
            const status = STATUS_META[o.status] || STATUS_META.pending;
            const isPurchase = o.kind === 'purchase';
            const cancellable = o.kind === 'reservation' && o.status === 'pending';
            return (
              <div key={`${o.kind}-${o.id}`} className={styles.reservationItem}>
                <span className={styles.modeIcon}>{isPurchase ? <Plane size={22} /> : <Bus size={22} />}</span>
                <span className={styles.resBody}>
                  <span className={styles.resTop}>
                    <span className={isPurchase ? styles.orderTagPurchase : styles.orderTagReservation}>
                      {isPurchase ? '长途客运' : '定制公交'}
                    </span>
                    <strong>{o.routeName}</strong>
                    <span className={`${styles.status} ${status.className}`}>{status.label}</span>
                  </span>
                  <span className={styles.resMeta}>🕒 {o.departureTime} · {isPurchase ? `${o.boardingPoint} → ${o.destination}` : `🚏 ${o.boardingPoint} → ${o.destination}`}</span>
                  <span className={styles.resMeta}>{isPurchase ? '班次' : '班次'} {o.scheduleId} · 记录号 {o.orderNo}</span>
                </span>
                {cancellable && (
                  <button type="button" className={styles.cancelBtn} onClick={() => { setCancelTarget(o); setCancelError(''); }}>
                    取消预约
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 取消预约确认弹窗（仅定制公交） */}
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
