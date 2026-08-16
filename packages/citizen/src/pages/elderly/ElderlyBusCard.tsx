import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  resolveElderlyBusStation, searchBusStations, CROWD_META,
  type ElderlyBusStation, type BusStationCandidate,
} from '../../services/busArrivalService';
import styles from './Elderly.module.css';

const AUTO_REFRESH_MS = 30000;
const REMIND_AT_STOPS = 2; // 剩余 ≤2 站时提醒

type LoadState = 'loading' | 'ok' | 'failed';

function formatClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 长辈模式「公交车到哪了」模块：候车站 + 线路到站卡片 */
const ElderlyBusCard: React.FC = () => {
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [station, setStation] = useState<ElderlyBusStation | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // 到站提醒：lineName -> 已开启
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  // 更换站点弹窗
  const [stationPickerOpen, setStationPickerOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualCandidates, setManualCandidates] = useState<BusStationCandidate[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 当前站坐标：自动刷新时沿用（用户换站后刷新新站）
  const currentTargetRef = useRef<{ name: string; lng: number; lat: number } | null>(null);

  const load = useCallback(async (target?: { name: string; lng: number; lat: number }) => {
    setLoadState('loading');
    const result = await resolveElderlyBusStation(target ? { station: target } : undefined);
    if (result.status === 'ok') {
      setStation(result.station);
      setLoadState('ok');
      setUpdatedAt(new Date());
      currentTargetRef.current = target ?? null;
    } else {
      setStation(null);
      setLoadState('failed');
      setErrorMsg(result.message);
    }
  }, []);

  // 单一自动刷新 Timer：挂载启动，卸载清除；手动刷新复用 load，不新建 Timer
  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => {
      const target = currentTargetRef.current;
      void load(target ?? undefined);
    }, AUTO_REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [load]);

  // 到站提醒：数据刷新后检查开启提醒的线路是否即将到站（≤2 站）
  useEffect(() => {
    if (!station) return;
    for (const line of station.lines) {
      if (reminders[line.lineName] && line.stopsRemaining <= REMIND_AT_STOPS) {
        setReminderToast(`🔔 ${line.lineName} 即将到站，还有约 ${line.stopsRemaining} 站，请准备下车。`);
        setReminders(prev => {
          const next = { ...prev };
          delete next[line.lineName];
          return next;
        });
        break;
      }
    }
  }, [station, reminders]);

  const toggleReminder = (lineName: string) => {
    setReminders(prev => {
      const next = { ...prev };
      if (next[lineName]) {
        delete next[lineName];
      } else {
        next[lineName] = true;
        setReminderToast(`已开启 ${lineName} 到站提醒：车辆到站前约 ${REMIND_AT_STOPS} 站时提醒您。`);
      }
      return next;
    });
  };

  const openStationPicker = () => {
    setManualMode(false);
    setManualText('');
    setManualCandidates([]);
    setManualError('');
    setStationPickerOpen(true);
  };

  const pickCurrentLocation = () => {
    setStationPickerOpen(false);
    currentTargetRef.current = null;
    void load();
  };

  const searchManual = async () => {
    const text = manualText.trim();
    if (!text) return;
    setManualLoading(true);
    setManualError('');
    setManualCandidates([]);
    try {
      const list = await searchBusStations(text);
      setManualCandidates(list.slice(0, 5));
      if (list.length === 0) setManualError(`没有找到公交站「${text}」`);
    } catch {
      setManualError(`没有找到公交站「${text}」，请换个名字试试`);
    } finally {
      setManualLoading(false);
    }
  };

  const pickManualStation = async (candidate: BusStationCandidate) => {
    setStationPickerOpen(false);
    setManualMode(false);
    setManualText('');
    setManualCandidates([]);
    // 用该站坐标查附近站（含途经线路）；后端拿不到线路时仍显示真实站名
    await load({ name: candidate.name, lng: candidate.lng, lat: candidate.lat });
  };

  const goLineDetail = (lineId: string) => {
    if (!lineId) return;
    navigate(`/elderly/bus/${encodeURIComponent(lineId)}`);
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>2️⃣ 公交车到哪了</div>

      {/* 演示数据整体标注（大字，不只在角落小字） */}
      <div className={styles.busDemoBanner}>演示到站信息 · 尚未接入官方实时公交</div>

      {/* 最近更新 + 手动刷新 */}
      <div className={styles.busRefreshRow}>
        <span className={styles.busUpdatedAt}>最近更新：{updatedAt ? formatClock(updatedAt) : '--:--:--'}</span>
        <button type="button" className={styles.busRefreshBtn} onClick={() => void load(currentTargetRef.current ?? undefined)}>🔄 刷新</button>
      </div>

      {loadState === 'loading' && (
        <div className={styles.busStatusText}>正在获取附近公交到站信息…</div>
      )}

      {loadState === 'failed' && (
        <div>
          <div className={styles.busStatusText}>公交到站信息暂时无法获取</div>
          {errorMsg && <div className={styles.busStatusHint}>{errorMsg}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button type="button" className={styles.btn} style={{ flex: 1 }} onClick={() => void load(currentTargetRef.current ?? undefined)}>重新加载</button>
            <button type="button" className={styles.btn} style={{ flex: 1 }} onClick={openStationPicker}>手动选择站点</button>
          </div>
        </div>
      )}

      {loadState === 'ok' && station && (
        <>
          {/* 当前候车站 */}
          <div className={styles.busStationCard}>
            <div>
              <div className={styles.busStationLabel}>📍 当前候车站</div>
              <div className={styles.busStationName}>{station.name}</div>
            </div>
            <button type="button" className={styles.btn} style={{ width: 'auto', padding: '12px 20px' }} onClick={openStationPicker}>更换站点</button>
          </div>

          {station.lines.length === 0 ? (
            <div className={styles.busStatusText}>
              当前站暂无可用公交到站信息
              {station.source === 'amap' && <div className={styles.busStatusHint}>该站途经线路信息暂未接入</div>}
            </div>
          ) : (
            station.lines.map((line, i) => {
              const crowd = CROWD_META[line.crowding];
              const reminderOn = !!reminders[line.lineName];
              return (
                <div key={`${line.lineName}_${i}`} className={styles.busLineCard}>
                  {/* 线路号 + 方向 */}
                  <div className={styles.busLineHead}>
                    <span className={styles.busLineName}>🚌 {line.lineName}</span>
                    <span className={styles.busLineDirection}>
                      {line.direction ? `开往：${line.direction}` : '方向未接入'}
                    </span>
                  </div>

                  {/* 车辆位置 */}
                  <div className={styles.busVehicleRow}>
                    📍 车辆刚到：{line.vehicleStation || '前方路段'}
                  </div>

                  {/* 核心信息：还有 N 站 · 约 N 分钟（大字） */}
                  <div className={styles.busKeyStats}>
                    <div className={styles.busKeyStat}>
                      <span className={styles.busKeyNum}>{line.stopsRemaining}</span>
                      <span className={styles.busKeyUnit}>站</span>
                    </div>
                    <span className={styles.busKeyDot}>·</span>
                    <div className={styles.busKeyStat}>
                      <span className={styles.busKeyNum}>约 {line.etaMinutes}</span>
                      <span className={styles.busKeyUnit}>分钟到本站</span>
                    </div>
                  </div>

                  {/* 拥挤度 */}
                  <div className={styles.busCrowding} style={{ color: crowd.color }}>
                    {crowd.emoji} 拥挤度：{crowd.label}
                  </div>

                  {/* 操作 */}
                  <div className={styles.busActions}>
                    <button type="button" className={styles.busActionBtn} disabled={!line.lineId} onClick={() => goLineDetail(line.lineId)}>查看线路</button>
                    <button type="button" className={styles.busActionBtn} onClick={() => toggleReminder(line.lineName)}>
                      {reminderOn ? '🔔 已开启提醒' : '🔔 到站提醒'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* 更换站点弹窗 */}
      {stationPickerOpen && (
        <div className={styles.sosOverlay} onClick={() => setStationPickerOpen(false)}>
          <div className={styles.sosDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.sosTitle}>选择候车站点</div>
            {!manualMode ? (
              <div className={styles.sosActions} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button type="button" className={styles.btn} onClick={pickCurrentLocation}>📍 使用我的当前位置</button>
                <button type="button" className={styles.btn} onClick={() => setManualMode(true)}>⌨️ 手动选择站点</button>
                <button type="button" className={styles.sosClose} onClick={() => setStationPickerOpen(false)}>取消</button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 16, marginBottom: 8 }}>输入公交站名称：</div>
                <input className={styles.input} placeholder="如：西单路口东" value={manualText} onChange={e => setManualText(e.target.value)} />
                <button type="button" className={styles.btn} style={{ marginTop: 8 }} disabled={manualLoading} onClick={() => void searchManual()}>
                  {manualLoading ? '正在查找…' : '搜索'}
                </button>
                {manualError && <div style={{ marginTop: 10, fontSize: 15, color: '#f5222d' }}>{manualError}</div>}
                {manualCandidates.map((c, i) => (
                  <button key={i} type="button" className={styles.btn}
                    style={{ marginTop: 8, textAlign: 'left', fontSize: 18, background: '#f0f5ff', color: '#333' }}
                    onClick={() => void pickManualStation(c)}>
                    🚏 {c.name}{c.address ? ` · ${c.address}` : ''}
                  </button>
                ))}
                <button type="button" className={styles.sosClose} style={{ marginTop: 12 }} onClick={() => { setManualMode(false); setManualText(''); setManualCandidates([]); setManualError(''); }}>返回</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 到站提醒弹窗（页面内提醒，非短信/官方推送） */}
      {reminderToast && (
        <div className={styles.sosOverlay} onClick={() => setReminderToast(null)}>
          <div className={styles.sosDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.sosTitle}>🔔 到站提醒</div>
            <div className={styles.sosDesc}>{reminderToast}</div>
            <div className={styles.sosDesc} style={{ fontSize: 13, color: 'var(--text-hint)' }}>页面内提醒 · 非短信或官方公交推送</div>
            <button type="button" className={styles.sosClose} onClick={() => setReminderToast(null)}>知道了</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElderlyBusCard;
