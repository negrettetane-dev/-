import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useReservationStore, type PendingReservation } from '../../stores/reservationStore';
import {
  customBusReservationService,
  ReservationServiceError,
} from '../../services/customBusReservationService';
import type { CustomBusSchedule, CustomBusScheduleStatus } from '@zhitu/shared';
import styles from './CustomBus.module.css';

/** 日期快捷选项 */
const DATE_SHORTCUTS = [
  { key: 0, label: '今天' },
  { key: 1, label: '明天' },
  { key: 2, label: '后天' },
] as const;

const STATUS_META: Record<CustomBusScheduleStatus, { label: string; className: string }> = {
  NOT_OPEN: { label: '尚未开放', className: 'stNotOpen' },
  AVAILABLE: { label: '可预约', className: 'stAvailable' },
  CLOSING: { label: '即将截止', className: 'stClosing' },
  FULL: { label: '已满', className: 'stFull' },
  CLOSED: { label: '已停止预约', className: 'stClosed' },
  DEPARTED: { label: '已发车', className: 'stDeparted' },
};

const STATUS_RANK: Record<CustomBusScheduleStatus, number> = {
  AVAILABLE: 0,
  CLOSING: 1,
  FULL: 2,
  CLOSED: 3,
  DEPARTED: 4,
  NOT_OPEN: 5,
};

const sortSchedules = (a: CustomBusSchedule, b: CustomBusSchedule) =>
  (STATUS_RANK[a.status] - STATUS_RANK[b.status]) || a.departTime.localeCompare(b.departTime);

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

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

  const now = useMemo(() => new Date(), []);

  const [date, setDate] = useState<string>(() => fmtDate(now));
  const [autoSwitched, setAutoSwitched] = useState(false);

  // ===== 班次实例：从后端拉取（真实数据，前端不伪造） =====
  const [schedules, setSchedules] = useState<CustomBusSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [schedulesError, setSchedulesError] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const resumedRef = React.useRef(false);
  const verifiedRef = React.useRef(false);

  // 拉取某日期真实班次；空则自动尝试下一个可预约日
  const loadSchedules = useCallback(async (targetDate: string, autoAdvance = true) => {
    setSchedulesLoading(true);
    setSchedulesError('');
    try {
      const list = await customBusReservationService.getSchedulesByDate(targetDate);
      const valid = (Array.isArray(list) ? list : []).filter(s => s && s.id);
      if (valid.length === 0 && autoAdvance) {
        for (let offset = 1; offset <= 2; offset += 1) {
          const nextDate = fmtDate(addDays(now, offset));
          if (nextDate === targetDate) continue;
          try {
            const nextList = await customBusReservationService.getSchedulesByDate(nextDate);
            const nextValid = (Array.isArray(nextList) ? nextList : []).filter(s => s && s.id);
            if (nextValid.length > 0) {
              setDate(nextDate);
              setSchedules(nextValid.sort(sortSchedules));
              setAutoSwitched(true);
              setSchedulesLoading(false);
              return;
            }
          } catch { /* 尝试下一个 */ }
        }
        setSchedules([]);
        setSchedulesLoading(false);
        return;
      }
      setSchedules(valid.sort(sortSchedules));
      setSchedulesLoading(false);
    } catch (error) {
      const serviceError = error instanceof ReservationServiceError ? error : null;
      setSchedulesError(serviceError?.message || '班次服务暂不可用');
      setSchedules([]);
      setSchedulesLoading(false);
    }
  }, [now]);

  useEffect(() => { void loadSchedules(date); }, [date, loadSchedules]);

  const selectedInstance = useMemo(
    () => schedules.find(item => item.id === selectedInstanceId) ?? null,
    [schedules, selectedInstanceId],
  );

  // ===== 登录后恢复未完成预约 =====
  useEffect(() => {
    if (!isAuthenticated || !pendingReservation || resumedRef.current) return;
    resumedRef.current = true;
    if (pendingReservation.scheduleInstanceId) {
      setSelectedInstanceId(pendingReservation.scheduleInstanceId);
    }
    setPassengers(pendingReservation.passengerCount || 1);
    setMessage('登录成功，请确认刚才选择的预约班次。');
    setConfirmOpen(true);
  }, [isAuthenticated, pendingReservation]);

  // 成功页刷新后：根据预约编号重新校验
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

  const selectDate = (d: string) => {
    setDate(d);
    setSelectedInstanceId(null);
    setPassengers(1);
    setMessage('');
    setAutoSwitched(false);
  };

  const selectInstance = (instance: CustomBusSchedule) => {
    setSelectedInstanceId(instance.id);
    setPassengers(1);
    setMessage('');
    setSearchParams({ date: instance.date, route: instance.templateId }, { replace: true });
  };

  const isBookableStatus = (status: CustomBusScheduleStatus) =>
    status === 'AVAILABLE' || status === 'CLOSING';

  const buildPending = (): PendingReservation | null => {
    if (!selectedInstance) return null;
    return {
      scheduleInstanceId: selectedInstance.id,
      routeId: selectedInstance.templateId,
      scheduleId: selectedInstance.scheduleId,
      routeName: `${selectedInstance.from} → ${selectedInstance.to}`,
      departureTime: `${selectedInstance.date} ${selectedInstance.departTime}`,
      boardingPoint: selectedInstance.from,
      boardingPointId: selectedInstance.boardingPointId,
      destination: selectedInstance.to,
      price: selectedInstance.price * passengers,
      passengerCount: passengers,
      redirect: `${location.pathname}?date=${encodeURIComponent(selectedInstance.date)}&route=${encodeURIComponent(selectedInstance.templateId)}`,
    };
  };

  const handleBook = () => {
    if (!selectedInstance || !isBookableStatus(selectedInstance.status)) return;
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
      state: { from: pending?.redirect || location.pathname, notice: '预约定制公交需要登录' },
    });
  };

  const submitReservation = async () => {
    const pending = useReservationStore.getState().pendingReservation;
    if (!pending || submitting) return;
    setSubmitting(true);
    setMessage('');
    try {
      const created = await customBusReservationService.createReservation({
        scheduleInstanceId: pending.scheduleInstanceId,
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
          state: { from: pending.redirect, notice: '登录状态已过期，请重新登录' },
        });
        return;
      }
      if (serviceError?.code === 'SCHEDULE_NOT_FOUND') {
        clearPendingReservation();
        setSelectedInstanceId(null);
        setMessage('班次信息已更新，请重新选择其他班次。');
        setConfirmOpen(false);
        return;
      }
      setMessage(serviceError?.message || '预约提交失败，请稍后重试');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedHint = (() => {
    if (!selectedInstance) return '请选择一个班次查看详情';
    switch (selectedInstance.status) {
      case 'AVAILABLE': return `当前班次可预约，余 ${selectedInstance.remainingSeats} 座。`;
      case 'CLOSING': return `该班次即将截止预约，余 ${selectedInstance.remainingSeats} 座，请尽快提交。`;
      case 'FULL': return '该班次座位已满，可选择其他班次。';
      case 'CLOSED': return '该班次预约已截止，建议选择下一班。';
      case 'DEPARTED': return '该班次已经发车，请选择其他可预约班次。';
      case 'NOT_OPEN': return '该班次尚未开放预约，请选择开放周期内的班次。';
      default: return '请选择一个班次查看详情';
    }
  })();

  const bookDisabled =
    !selectedInstance || !isBookableStatus(selectedInstance.status);

  if (lastReservation) {
    return (
      <div className={styles.page}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <div className={styles.successTitle}>预约成功</div>
          <div className={styles.successInfo}>
            <div><b>线路：</b>{lastReservation.routeName}</div>
            <div><b>班次：</b>{lastReservation.scheduleId}</div>
            <div><b>日期：</b>{lastReservation.date}</div>
            <div><b>上车地点：</b>{lastReservation.boardingPoint}</div>
            <div><b>发车时间：</b>{lastReservation.departureTime}</div>
            <div><b>预约编号：</b>{lastReservation.reservationNo}</div>
          </div>
          <div className={styles.successActions}>
            <button className={styles.secondaryBtn} onClick={() => navigate('/profile/reservations')}>查看我的预约</button>
            <button className={styles.backBtn} onClick={() => { clearLastReservation(); setSelectedInstanceId(null); setSearchParams({}, { replace: true }); }}>返回公交定制</button>
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

      {autoSwitched && (
        <div className={styles.dateNotice} role="status">
          今日班次预约已结束，已为您展示可预约班次。
        </div>
      )}

      <div className={styles.dateBar}>
        {DATE_SHORTCUTS.map(shortcut => {
          const d = addDays(now, shortcut.key);
          const dStr = fmtDate(d);
          return (
            <button
              key={shortcut.key}
              type="button"
              className={`${styles.dateBtn} ${date === dStr ? styles.dateActive : ''}`}
              onClick={() => selectDate(dStr)}
            >
              {shortcut.label}
            </button>
          );
        })}
        <input
          type="date"
          className={styles.datePicker}
          value={date}
          min={fmtDate(now)}
          onChange={e => e.target.value && selectDate(e.target.value)}
          aria-label="选择预约日期"
        />
      </div>

      {schedulesLoading ? (
        <div className={styles.emptyText}>正在加载班次...</div>
      ) : schedulesError ? (
        <div className={styles.dateNotice}>⚠️ {schedulesError}</div>
      ) : schedules.length === 0 ? (
        <div className={styles.emptyText}>该日期暂无可用班次</div>
      ) : (
        <div className={styles.routeList}>
          {schedules.map(item => {
            const meta = STATUS_META[item.status];
            return (
              <button
                type="button"
                key={item.id}
                className={`${styles.routeCard} ${selectedInstanceId === item.id ? styles.routeActive : ''}`}
                onClick={() => selectInstance(item)}
              >
                <div className={styles.routeHeader}>
                  <span className={styles.routeTag}>{item.type}</span>
                  <span className={styles[meta.className]}>{meta.label}</span>
                </div>
                <div className={styles.routeStations}>
                  <span>{item.from}</span><span className={styles.routeArrow}>→</span><span>{item.to}</span>
                </div>
                <div className={styles.routeMeta}>
                  <span>🕒 {item.date} {item.departTime} - {item.arriveTime}</span>
                  <span>¥{item.price}/人</span>
                </div>
                {item.status === 'AVAILABLE' && (
                  <div className={styles.seatsLow}>余 {item.remainingSeats} 座 · 可预约</div>
                )}
                {item.status === 'CLOSING' && (
                  <div className={styles.seatsUrgent}>仅剩 {item.remainingSeats} 座 · 即将截止</div>
                )}
                {item.status === 'FULL' && (
                  <div className={styles.seatsNote}>座位已满 · 本班次 {item.departTime} 发车</div>
                )}
                {item.status === 'CLOSED' && (
                  <div className={styles.seatsNote}>本班次 {item.departTime} 发车，预约已截止</div>
                )}
                {item.status === 'DEPARTED' && (
                  <div className={styles.seatsNote}>本班次已于 {item.departTime} 发车</div>
                )}
                {item.status === 'NOT_OPEN' && (
                  <div className={styles.seatsNote}>尚未开放预约</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedInstance && (
        <div className={styles.bookForm}>
          <div className={styles.bookTitle}>预约信息</div>
          <div className={selectedInstance.status === 'CLOSING' ? styles.hintUrgent : styles.hintInfo}>
            {selectedHint}
          </div>
          <div className={styles.bookRow}><span className={styles.bookLabel}>线路</span><span className={styles.bookVal}>{selectedInstance.from} → {selectedInstance.to}</span></div>
          <div className={styles.bookRow}><span className={styles.bookLabel}>班次</span><span className={styles.bookVal}>{selectedInstance.date} {selectedInstance.departTime} - {selectedInstance.arriveTime}</span></div>
          <div className={styles.bookRow}>
            <span className={styles.bookLabel}>人数</span>
            <div className={styles.paxPicker}>
              <button type="button" className={styles.paxBtn} onClick={() => setPassengers(Math.max(1, passengers - 1))}>−</button>
              <span className={styles.paxNum}>{passengers}</span>
              <button type="button" className={styles.paxBtn} onClick={() => setPassengers(Math.min(Math.min(5, selectedInstance.remainingSeats), passengers + 1))}>+</button>
            </div>
          </div>
          <div className={styles.bookRow}><span className={styles.bookLabel}>费用</span><span className={styles.bookPrice}>¥{selectedInstance.price * passengers}</span></div>
          <button type="button" className={styles.bookBtn} onClick={handleBook} disabled={bookDisabled}>
            {selectedInstance.status === 'FULL' ? '已满员'
              : selectedInstance.status === 'CLOSED' ? '已停止预约'
                : selectedInstance.status === 'DEPARTED' ? '已发车'
                  : selectedInstance.status === 'NOT_OPEN' ? '尚未开放'
                    : `预约 · ¥${selectedInstance.price * passengers}`}
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
