import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useReservationStore, type PendingReservation } from '../../stores/reservationStore';
import {
  customBusReservationService,
  ReservationServiceError,
} from '../../services/customBusReservationService';
import styles from './CustomBus.module.css';

interface CustomBusRoute {
  id: string;
  scheduleId: string;
  from: string;
  boardingPointId: string;
  to: string;
  departTime: string;
  arriveTime: string;
  price: number;
  seats: number;
  type: string;
}

const ROUTES: CustomBusRoute[] = [
  { id: 'cb-001', scheduleId: 'cb-001-0730', from: '回龙观', boardingPointId: 'stop-hlg', to: '中关村', departTime: '07:30', arriveTime: '08:30', price: 8, seats: 12, type: '早高峰通勤' },
  { id: 'cb-002', scheduleId: 'cb-002-0700', from: '天通苑', boardingPointId: 'stop-tty', to: '国贸 CBD', departTime: '07:00', arriveTime: '08:15', price: 12, seats: 5, type: '早高峰通勤' },
  { id: 'cb-003', scheduleId: 'cb-003-0715', from: '通州北苑', boardingPointId: 'stop-tzby', to: '建国门', departTime: '07:15', arriveTime: '08:10', price: 10, seats: 18, type: '早高峰通勤' },
  { id: 'cb-004', scheduleId: 'cb-004-1800', from: '中关村', boardingPointId: 'stop-zgc', to: '回龙观', departTime: '18:00', arriveTime: '18:55', price: 8, seats: 20, type: '晚高峰通勤' },
  { id: 'cb-005', scheduleId: 'cb-005-1830', from: '国贸 CBD', boardingPointId: 'stop-gm', to: '天通苑', departTime: '18:30', arriveTime: '19:40', price: 12, seats: 3, type: '晚高峰通勤' },
  { id: 'cb-006', scheduleId: 'cb-006-0745', from: '亦庄', boardingPointId: 'stop-yz', to: '西二旗', departTime: '07:45', arriveTime: '09:00', price: 15, seats: 0, type: '跨区通勤' },
];

const CustomBusPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const markSessionExpired = useAuthStore(state => state.markSessionExpired);
  const {
    pendingReservation,
    setPendingReservation,
    clearPendingReservation,
    lastReservation,
    setLastReservation,
    clearLastReservation,
  } = useReservationStore();

  const initialRouteId = searchParams.get('route');
  const [selectedRoute, setSelectedRoute] = useState<string | null>(
    initialRouteId && ROUTES.some(route => route.id === initialRouteId) ? initialRouteId : null,
  );
  const [passengers, setPassengers] = useState(1);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const resumedRef = useRef(false);
  const verifiedRef = useRef(false);

  const route = useMemo(() => ROUTES.find(item => item.id === selectedRoute), [selectedRoute]);

  useEffect(() => {
    if (!isAuthenticated || !pendingReservation || resumedRef.current) return;
    const restoredRoute = ROUTES.find(item => item.id === pendingReservation.routeId);
    if (!restoredRoute) {
      clearPendingReservation();
      return;
    }
    resumedRef.current = true;
    setSelectedRoute(restoredRoute.id);
    setPassengers(pendingReservation.passengerCount || 1);
    setSearchParams({ route: restoredRoute.id }, { replace: true });
    setMessage('登录成功，请确认刚才选择的预约班次。');
    setConfirmOpen(true);
  }, [clearPendingReservation, isAuthenticated, pendingReservation, setSearchParams]);

  // 成功页刷新后：根据预约编号重新校验，避免依赖一次性本地状态。
  useEffect(() => {
    if (!lastReservation || verifiedRef.current) return;
    verifiedRef.current = true;
    customBusReservationService.getMyReservations()
      .then(list => {
        const found = list.find(item => item.reservationNo === lastReservation.reservationNo);
        if (found) setLastReservation(found);
        else { clearLastReservation(); navigate('/profile/reservations', { replace: true }); }
      })
      .catch(() => { /* 预约服务未接入：保留已创建成功的预约信息 */ });
  }, [lastReservation, clearLastReservation, navigate, setLastReservation]);

  const selectRoute = (routeId: string) => {
    setSelectedRoute(routeId);
    setPassengers(1);
    setMessage('');
    setSearchParams({ route: routeId }, { replace: true });
  };

  const buildPending = (): PendingReservation | null => {
    if (!route) return null;
    return {
      routeId: route.id,
      scheduleId: route.scheduleId,
      routeName: `${route.from} → ${route.to}`,
      departureTime: route.departTime,
      boardingPoint: route.from,
      boardingPointId: route.boardingPointId,
      destination: route.to,
      price: route.price * passengers,
      passengerCount: passengers,
      redirect: `${location.pathname}?route=${encodeURIComponent(route.id)}`,
    };
  };

  const handleBook = () => {
    if (!route || route.seats <= 0) return;
    const pending = buildPending();
    if (!pending) return;
    setPendingReservation(pending);
    setMessage('');
    if (!isAuthenticated) {
      setLoginPromptOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const goToLogin = () => {
    const pending = useReservationStore.getState().pendingReservation;
    setLoginPromptOpen(false);
    navigate('/login', {
      state: {
        from: pending?.redirect || location.pathname,
        notice: '预约定制公交需要登录',
      },
    });
  };

  const submitReservation = async () => {
    const pending = useReservationStore.getState().pendingReservation;
    if (!pending || submitting) return;
    setSubmitting(true);
    setMessage('');
    try {
      const created = await customBusReservationService.createReservation({
        routeId: pending.routeId,
        scheduleId: pending.scheduleId,
        boardingPointId: pending.boardingPointId,
        passengerCount: pending.passengerCount,
      });
      setLastReservation(created);
      setConfirmOpen(false);
      clearPendingReservation();
    } catch (error) {
      const serviceError = error instanceof ReservationServiceError ? error : null;
      if (serviceError?.code === 'UNAUTHORIZED') {
        markSessionExpired();
        setConfirmOpen(false);
        navigate('/login', {
          state: {
            from: pending.redirect,
            notice: '登录状态已过期，请重新登录',
          },
        });
        return;
      }
      setMessage(serviceError?.message || '预约提交失败，请稍后重试');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (lastReservation) {
    return (
      <div className={styles.page}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <div className={styles.successTitle}>预约成功</div>
          <div className={styles.successInfo}>
            <div><b>线路：</b>{lastReservation.routeName}</div>
            <div><b>班次：</b>{lastReservation.scheduleId}</div>
            <div><b>上车地点：</b>{lastReservation.boardingPoint}</div>
            <div><b>发车时间：</b>{lastReservation.departureTime}</div>
            <div><b>预约编号：</b>{lastReservation.reservationNo}</div>
          </div>
          <div className={styles.successActions}>
            <button className={styles.secondaryBtn} onClick={() => navigate('/profile/reservations')}>查看我的预约</button>
            <button className={styles.backBtn} onClick={() => { clearLastReservation(); setSelectedRoute(null); setSearchParams({}, { replace: true }); }}>返回公交定制</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>← 返回</button>
        <span className={styles.title}>🚌 定制公交预约</span>
      </div>

      <div className={styles.intro}>
        <div className={styles.introIcon}>💡</div>
        <div className={styles.introText}>
          <b>一人一座 · 直达通勤 · 准时发车</b><br />
          未登录也可以浏览线路、班次、价格和剩余名额；提交预约时需要登录。
        </div>
      </div>

      {message && <div className={styles.notice} role="status">{message}</div>}

      <div className={styles.routeList}>
        {ROUTES.map(item => (
          <button
            type="button"
            key={item.id}
            className={`${styles.routeCard} ${selectedRoute === item.id ? styles.routeActive : ''}`}
            onClick={() => selectRoute(item.id)}
          >
            <div className={styles.routeHeader}>
              <span className={styles.routeTag}>{item.type}</span>
              <span className={item.seats > 0 ? styles.routeSeats : styles.routeFull}>{item.seats > 0 ? `余 ${item.seats} 座` : '已满员'}</span>
            </div>
            <div className={styles.routeStations}>
              <span>{item.from}</span><span className={styles.routeArrow}>→</span><span>{item.to}</span>
            </div>
            <div className={styles.routeMeta}>
              <span>🕒 {item.departTime} - {item.arriveTime}</span>
              <span>¥{item.price}/人</span>
            </div>
            {item.seats > 0 && item.seats <= 5 && <div className={styles.seatsLow}>仅剩 {item.seats} 座，请尽快预约</div>}
          </button>
        ))}
      </div>

      {route && (
        <div className={styles.bookForm}>
          <div className={styles.bookTitle}>预约信息</div>
          <div className={styles.bookRow}><span className={styles.bookLabel}>线路</span><span className={styles.bookVal}>{route.from} → {route.to}</span></div>
          <div className={styles.bookRow}><span className={styles.bookLabel}>班次</span><span className={styles.bookVal}>{route.departTime}</span></div>
          <div className={styles.bookRow}>
            <span className={styles.bookLabel}>人数</span>
            <div className={styles.paxPicker}>
              <button type="button" className={styles.paxBtn} onClick={() => setPassengers(Math.max(1, passengers - 1))}>−</button>
              <span className={styles.paxNum}>{passengers}</span>
              <button type="button" className={styles.paxBtn} onClick={() => setPassengers(Math.min(Math.min(5, route.seats), passengers + 1))}>+</button>
            </div>
          </div>
          <div className={styles.bookRow}><span className={styles.bookLabel}>费用</span><span className={styles.bookPrice}>¥{route.price * passengers}</span></div>
          <button type="button" className={styles.bookBtn} onClick={handleBook} disabled={route.seats <= 0}>
            {route.seats <= 0 ? '已满员' : `预约 · ¥${route.price * passengers}`}
          </button>
        </div>
      )}

      {loginPromptOpen && (
        <div className={styles.modalMask} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="login-title">
            <h2 id="login-title">预约定制公交需要登录</h2>
            <p>登录后可预约班次，并在个人中心查看预约记录。</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => { setLoginPromptOpen(false); clearPendingReservation(); }}>暂不登录</button>
              <button type="button" className={styles.primaryBtn} onClick={goToLogin}>去登录</button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && pendingReservation && (
        <div className={styles.modalMask} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <h2 id="confirm-title">确认预约</h2>
            <div className={styles.confirmList}>
              <div><span>线路</span><b>{pendingReservation.routeName}</b></div>
              <div><span>班次</span><b>{pendingReservation.departureTime}</b></div>
              <div><span>上车点</span><b>{pendingReservation.boardingPoint}</b></div>
              <div><span>目的地</span><b>{pendingReservation.destination}</b></div>
              <div><span>费用</span><b>¥{pendingReservation.price}</b></div>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} disabled={submitting} onClick={() => { setConfirmOpen(false); clearPendingReservation(); }}>取消</button>
              <button type="button" className={styles.primaryBtn} disabled={submitting} onClick={() => void submitReservation()}>{submitting ? '预约中...' : '确认预约'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
};

export default CustomBusPage;
