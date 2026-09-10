import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatPrice } from '../../utils/price';
import {
  clearChargingSession,
  formatDuration,
  getChargingMetrics,
  getChargingSession,
  updateChargingSession,
  type ChargingSession,
  type ChargingSessionStatus,
} from '../../services/chargingSessionService';
import styles from './ChargingSession.module.css';

const statusLabels: Record<ChargingSessionStatus, string> = {
  ready: '设备已确认',
  starting: '正在启动',
  charging: '充电中',
  stopping: '正在停止',
  completed: '充电已结束',
};

const ChargingSessionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<ChargingSession | null>(() => getChargingSession());
  const [now, setNow] = useState(Date.now());

  const metrics = useMemo(
    () => session ? getChargingMetrics(session, now) : null,
    [session, now],
  );

  useEffect(() => {
    if (!session) return undefined;
    if (session.status === 'ready') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session || session.status !== 'starting') return undefined;
    const timer = window.setTimeout(() => {
      const next = updateChargingSession({ ...session, status: 'charging', startedAt: Date.now() });
      setSession(next);
      setNow(Date.now());
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [session]);

  useEffect(() => {
    if (!session || session.status !== 'stopping') return undefined;
    const timer = window.setTimeout(() => {
      const next = updateChargingSession({ ...session, status: 'completed', stoppedAt: Date.now() });
      setSession(next);
      setNow(Date.now());
    }, 800);
    return () => window.clearTimeout(timer);
  }, [session]);

  if (!session) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyCard}>
          <div className={styles.emptyTitle}>充电会话不存在</div>
          <div className={styles.emptyText}>请先识别一个可用的充电设备。</div>
          <button className={styles.primaryBtn} onClick={() => navigate('/charging/scan')}>返回设备识别</button>
        </div>
      </div>
    );
  }

  const { payload, station } = session;
  const isActive = session.status === 'charging';
  const isFinished = session.status === 'completed';
  const isBusy = session.status === 'starting' || session.status === 'stopping';
  const progress = Math.min(100, metrics ? metrics.energyKwh / 0.6 * 100 : 0);

  const startCharging = () => {
    if (session.status !== 'ready') return;
    setSession(updateChargingSession({ ...session, status: 'starting' }));
  };

  const stopCharging = () => {
    if (session.status !== 'charging') return;
    setSession(updateChargingSession({ ...session, status: 'stopping' }));
  };

  const leaveSession = () => {
    clearChargingSession();
    navigate('/charging/scan', { state: station });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>← 返回</button>
        <div className={styles.title}>充电详情</div>
        <span className={styles.demoBadge}>演示</span>
      </div>

      <div className={styles.demoBanner}>本页面为演示充电流程，不会启动实体充电，也不会产生真实扣费。</div>

      <div className={styles.deviceCard}>
        <div className={styles.deviceHeading}>
          <div>
            <div className={styles.stationName}>{station.stationName || '演示充电站'}</div>
            <div className={styles.deviceId}>{payload.pileCode} · {payload.gunCode}</div>
          </div>
          <span className={`${styles.statusBadge} ${isActive ? styles.statusActive : isFinished ? styles.statusDone : styles.statusIdle}`}>
            ● {statusLabels[session.status]}
          </span>
        </div>
        <div className={styles.connectionLine}>
          <span className={isFinished ? styles.dotDone : styles.dotActive}>●</span>
          {session.status === 'ready' && '设备在线，等待确认启动'}
          {session.status === 'starting' && '正在检查车辆连接和充电枪状态…'}
          {session.status === 'charging' && '车辆已连接，电池正在充电'}
          {session.status === 'stopping' && '正在停止输出并结算本次演示'}
          {session.status === 'completed' && '充电已停止，账单已生成'}
        </div>
      </div>

      <div className={styles.metricsCard}>
        <div className={styles.metricHero}>
          <span>已充电量</span>
          <strong>{metrics?.energyKwh.toFixed(2) ?? '0.00'} <small>kWh</small></strong>
        </div>
        <div className={styles.metricGrid}>
          <div><span>当前功率</span><b>{isActive ? `${payload.powerKw} kW` : '—'}</b></div>
          <div><span>充电时长</span><b>{formatDuration(metrics?.elapsedSeconds ?? 0)}</b></div>
          <div><span>当前费用</span><b>{metrics?.amount.toFixed(2) ?? '0.00'} 元</b></div>
          <div><span>计费单价</span><b>{formatPrice(payload.price)}</b></div>
        </div>
        <div className={styles.progressTrack}><div className={styles.progressBar} style={{ width: `${progress}%` }} /></div>
        <div className={styles.progressHint}>{isFinished ? '本次演示已完成' : '演示进度仅用于展示充电状态'}</div>
      </div>

      <div className={styles.actionCard}>
        {session.status === 'ready' && (
          <>
            <div className={styles.actionTitle}>设备已准备就绪</div>
            <div className={styles.actionText}>确认后将模拟车辆握手、开始供电和实时计费。</div>
            <button className={styles.primaryBtn} onClick={startCharging}>确认开始充电</button>
          </>
        )}
        {isBusy && <div className={styles.loadingState}><span className={styles.spinner} />{statusLabels[session.status]}…</div>}
        {isActive && <button className={styles.stopBtn} onClick={stopCharging}>停止充电</button>}
        {isFinished && (
          <>
            <div className={styles.doneTitle}>本次充电已完成</div>
            <div className={styles.settlement}>最终费用按 {formatPrice(payload.price)} 计算，本次仅为演示，不会扣款。</div>
            <button className={styles.primaryBtn} onClick={leaveSession}>再次识别设备</button>
          </>
        )}
      </div>

      <div className={styles.footerNote}>会话编号：{session.id} · 页面数据每秒更新</div>
      {location.key === 'default' && <div className={styles.footerNote}>从设备识别页确认后进入当前会话</div>}
    </div>
  );
};

export default ChargingSessionPage;
