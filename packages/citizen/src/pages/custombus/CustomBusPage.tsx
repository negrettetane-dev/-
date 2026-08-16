import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useReservationStore, type PendingReservation } from '../../stores/reservationStore';
import {
  customBusReservationService,
  ReservationServiceError,
} from '../../services/customBusReservationService';
import {
  addDays,
  computeBusStatus,
  instancesForDate,
  sortInstances,
  toDateStr,
  BUS_STATUS_META,
  cutoffTimeLabel,
  minutesToCutoff,
  hasBookable,
  OPEN_WINDOW_DAYS,
  type CustomBusInstance,
} from '../../utils/customBusSchedule';
import styles from './CustomBus.module.css';

/** 日期快捷选项 */
const DATE_SHORTCUTS = [
  { key: 0, label: '今天' },
  { key: 1, label: '明天' },
  { key: 2, label: '后天' },
] as const;

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

  // ===== 当前时间（进入页面时取一次，随页面活动走） =====
  const now = useMemo(() => new Date(), []);

  // ===== 日期选择：默认今天；今日无可用班次自动切到最近的可用日 =====
  const [date, setDate] = useState<string>(() => {
    const today = instancesForDate(now, now);
    if (hasBookable(today, now)) return toDateStr(now);
    // 今日全结束 → 自动展示第一个有可预约班次的日期（明天优先）
    for (let offset = 1; offset < OPEN_WINDOW_DAYS; offset += 1) {
      const d = addDays(now, offset);
      if (hasBookable(instancesForDate(now, d), now)) return toDateStr(d);
    }
    return toDateStr(now);
  });
  /** 是否发生了自动切换（今天无班次 → 展示明日） */
  const autoSwitched = useMemo(() => {
    const todayStr = toDateStr(now);
    return date !== todayStr && !hasBookable(instancesForDate(now, now), now);
  }, [date, now]);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const resumedRef = React.useRef(false);
  const verifiedRef = React.useRef(false);

  // 当前选中日期的班次实例（按可预约优先级排序）
  const dateInstances = useMemo(() => {
    const d = new Date(`${date}T00:00:00`);
    return sortInstances(instancesForDate(now, d), now);
  }, [date, now]);

  const selectedInstance = useMemo(
    () => dateInstances.find(item => item.id === selectedInstanceId) ?? null,
    [dateInstances, selectedInstanceId],
  );

  // 选中班次的预约状态（独立判断）
  const selectedStatus = selectedInstance ? computeBusStatus(selectedInstance, now) : null;

  // 登录后恢复未完成预约
  useEffect(() => {
    if (!isAuthenticated || !pendingReservation || resumedRef.current) return;
    const restoredDate = pendingReservation.redirect?.match(/date=([\d-]+)/)?.[1];
    const restoredId = pendingReservation.routeId;
    if (restoredId) {
      const restoredDateStr = restoredDate || toDateStr(now);
      setDate(restoredDateStr);
      setSelectedInstanceId(restoredId.includes('-') && restoredId.split('-').length === 3 ? restoredId : `${restoredId}-${restoredDateStr.replace(/-/g, '')}`);
    }
    resumedRef.current = true;
    setPassengers(pendingReservation.passengerCount || 1);
    setMessage('登录成功，请确认刚才选择的预约班次。');
    setConfirmOpen(true);
  }, [clearPendingReservation, isAuthenticated, now, pendingReservation, setSearchParams]);

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
  };

  const selectInstance = (instance: CustomBusInstance) => {
    setSelectedInstanceId(instance.id);
    setPassengers(1);
    setMessage('');
    setSearchParams({ date: instance.date, route: instance.templateId }, { replace: true });
  };

  const buildPending = (): PendingReservation | null => {
    if (!selectedInstance) return null;
    return {
      routeId: selectedInstance.id,
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
    if (!selectedInstance || selectedStatus === 'full' || selectedStatus === 'closed' || selectedStatus === 'departed' || selectedStatus === 'not-open') return;
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

  // ===== 选中班次的提示区文案（随状态动态变化） =====
  const selectedHint = (() => {
    if (!selectedInstance) return '请选择一个班次查看详情';
    switch (selectedStatus) {
      case 'available':
        return `当前班次可预约，余 ${selectedInstance.seats} 座。`;
      case 'closing-soon':
        return `该班次将在 ${minutesToCutoff(selectedInstance, now)} 分钟后停止预约，请尽快提交。`;
      case 'full':
        return '该班次座位已满，可选择其他班次。';
      case 'closed':
        return `该班次预约已截止（${cutoffTimeLabel(selectedInstance)} 停止预约），建议选择下一班。`;
      case 'departed':
        return '该班次已经发车，请选择其他可预约班次。';
      case 'not-open':
        return '该班次尚未开放预约，请选择开放周期内的班次。';
      default:
        return '请选择一个班次查看详情';
    }
  })();

  const bookDisabled =
    !selectedInstance || !selectedStatus || selectedStatus === 'full' || selectedStatus === 'closed' ||
    selectedStatus === 'departed' || selectedStatus === 'not-open';

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

      {/* 今日全部结束 → 自动切到明日 */}
      {autoSwitched && (
        <div className={styles.dateNotice} role="status">
          今日班次预约已结束，已为您展示 {date === toDateStr(addDays(now, 1)) ? '明日' : '可预约日'} 可预约班次。
        </div>
      )}

      {/* 日期选择：今天 / 明天 / 后天 / 选择日期 */}
      <div className={styles.dateBar}>
        {DATE_SHORTCUTS.map(shortcut => {
          const d = addDays(now, shortcut.key);
          const dStr = toDateStr(d);
          const bookable = hasBookable(instancesForDate(now, d), now);
          return (
            <button
              key={shortcut.key}
              type="button"
              className={`${styles.dateBtn} ${date === dStr ? styles.dateActive : ''}`}
              onClick={() => selectDate(dStr)}
            >
              {shortcut.label}
              <span className={styles.dateBookable}>{bookable ? '可预约' : '已结束'}</span>
            </button>
          );
        })}
        <input
          type="date"
          className={styles.datePicker}
          value={date}
          min={toDateStr(now)}
          max={toDateStr(addDays(now, OPEN_WINDOW_DAYS - 1))}
          onChange={e => e.target.value && selectDate(e.target.value)}
          aria-label="选择预约日期"
        />
      </div>

      <div className={styles.routeList}>
        {dateInstances.length === 0 ? (
          <div className={styles.emptyText}>该日期暂无可预约班次</div>
        ) : (
          dateInstances.map(item => {
            const status = computeBusStatus(item, now);
            const meta = BUS_STATUS_META[status];
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
                {/* 座位信息：可预约/即将截止显示余座；已满/截止/发车说明原因 */}
                {status === 'available' && item.seats > 0 && (
                  <div className={styles.seatsLow}>余 {item.seats} 座 · 可预约</div>
                )}
                {status === 'closing-soon' && item.seats > 0 && (
                  <div className={styles.seatsUrgent}>
                    仅剩 {item.seats} 座 · {minutesToCutoff(item, now)} 分钟后停止预约
                  </div>
                )}
                {status === 'full' && (
                  <div className={styles.seatsNote}>座位已满 · 本班次 {item.departTime} 发车，{cutoffTimeLabel(item)} 停止预约</div>
                )}
                {status === 'closed' && (
                  <div className={styles.seatsNote}>本班次 {item.departTime} 发车，{cutoffTimeLabel(item)} 已停止预约</div>
                )}
                {status === 'departed' && (
                  <div className={styles.seatsNote}>本班次已于 {item.departTime} 发车</div>
                )}
                {status === 'not-open' && (
                  <div className={styles.seatsNote}>尚未开放预约 · 最多提前 {OPEN_WINDOW_DAYS} 天预约</div>
                )}
              </button>
            );
          })
        )}
      </div>

      {selectedInstance && (
        <div className={styles.bookForm}>
          <div className={styles.bookTitle}>预约信息</div>
          {/* 选中班次的提示区：内容随状态动态变化 */}
          <div className={selectedStatus === 'closing-soon' ? styles.hintUrgent : styles.hintInfo}>
            {selectedHint}
          </div>
          <div className={styles.bookRow}><span className={styles.bookLabel}>线路</span><span className={styles.bookVal}>{selectedInstance.from} → {selectedInstance.to}</span></div>
          <div className={styles.bookRow}><span className={styles.bookLabel}>班次</span><span className={styles.bookVal}>{selectedInstance.date} {selectedInstance.departTime} - {selectedInstance.arriveTime}</span></div>
          <div className={styles.bookRow}>
            <span className={styles.bookLabel}>人数</span>
            <div className={styles.paxPicker}>
              <button type="button" className={styles.paxBtn} onClick={() => setPassengers(Math.max(1, passengers - 1))}>−</button>
              <span className={styles.paxNum}>{passengers}</span>
              <button type="button" className={styles.paxBtn} onClick={() => setPassengers(Math.min(Math.min(5, selectedInstance.seats), passengers + 1))}>+</button>
            </div>
          </div>
          <div className={styles.bookRow}><span className={styles.bookLabel}>费用</span><span className={styles.bookPrice}>¥{selectedInstance.price * passengers}</span></div>
          <button type="button" className={styles.bookBtn} onClick={handleBook} disabled={bookDisabled}>
            {selectedStatus === 'full' ? '已满员'
              : selectedStatus === 'closed' ? '已停止预约'
                : selectedStatus === 'departed' ? '已发车'
                  : selectedStatus === 'not-open' ? '尚未开放'
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
