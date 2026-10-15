import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadAMap } from '../../lib/amap';
import { getLineDetail, getArrivalInfo } from '../../services/transitService';
import {
  distanceMeters, normalizePath, pointAtPath, searchBusLineGeometry, snapToPath,
  type BusDirection, type BusRouteGeometry, type BusRouteStation, type BusVehicle,
} from '../../services/busRealtimeService';
import type { TransitLine, ArrivalInfo } from '../../types/transit';
import { apiGet } from '../../services/apiClient';
import styles from './BusDetail.module.css';

const CROWD: Record<string, { emoji: string; label: string; color: string }> = {
  empty: { emoji: '🟢', label: '空闲', color: '#52c41a' },
  normal: { emoji: '🟡', label: '适中', color: '#faad14' },
  crowded: { emoji: '🟠', label: '拥挤', color: '#ff7a00' },
  full: { emoji: '🔴', label: '满载', color: '#f5222d' },
};

function formatCountdown(s: number): string {
  if (s <= 0) return '即将到站';
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}分${r}秒` : `${m}分钟`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(msg)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

function stationAtProgress(geometry: BusRouteGeometry, progress: number) {
  const { stations, path } = geometry;
  if (stations.length < 2) return { currentStation: stations[0]?.name || '', nextStation: '', distanceToNext: 0 };
  const total = stations.length - 1;
  const idx = progress * total;
  const nextIdx = Math.min(total, Math.max(1, Math.ceil(idx)));
  return { currentStation: stations[nextIdx - 1].name, nextStation: stations[nextIdx].name, distanceToNext: Math.round(distanceMeters(pointAtPath(path, progress), stations[nextIdx].location)) };
}

function comparableName(value: string): string {
  return value.replace(/[（）()\s·]/g, '').replace(/公交枢纽站?|公交场站|枢纽站|总站|车站|站$/g, '');
}

function mergeStations(lineStations: TransitLine['stations'], amapStations: BusRouteStation[]): BusRouteStation[] {
  return lineStations.map((station, index) => {
    const hasBackendLocation = Number.isFinite(station.longitude) && Number.isFinite(station.latitude);
    if (hasBackendLocation) return { name: station.name, location: [station.longitude!, station.latitude!] };
    const expected = comparableName(station.name);
    const matched = amapStations.find(item => {
      const actual = comparableName(item.name);
      return actual === expected || actual.includes(expected) || expected.includes(actual);
    }) || (amapStations.length === lineStations.length ? amapStations[index] : undefined);
    return matched ? { name: station.name, location: matched.location } : null;
  }).filter((station): station is BusRouteStation => station !== null);
}

const BusDetailPage: React.FC = () => {
  const { lineId = 'b1' } = useParams<{ lineId: string }>();
  const navigate = useNavigate();
  const [line, setLine] = useState<TransitLine | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [dirIdx, setDirIdx] = useState(0);
  const [arrival, setArrival] = useState<ArrivalInfo | null>(null);
  const [nextSec, setNextSec] = useState(0);
  const [followSec, setFollowSec] = useState(0);
  const [currentStopIdx, setCurrentStopIdx] = useState(0);
  const [starred, setStarred] = useState(false);
  const [vehicles, setVehicles] = useState<BusVehicle[]>([]);

  // 地图三态
  const [mapLoading, setMapLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapRetryKey, setMapRetryKey] = useState(0);
  const [geometryLoading, setGeometryLoading] = useState(true);
  const [geometryError, setGeometryError] = useState('');
  const [geometrySource, setGeometrySource] = useState<'backend' | 'amap' | ''>('');
  const [geometryRetryKey, setGeometryRetryKey] = useState(0);

  const mapRef = useRef<HTMLDivElement>(null);
  const amapRef = useRef<any>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geometryRef = useRef<BusRouteGeometry | null>(null);
  const vehicleMarkersRef = useRef<{ vehicleId: string; marker: any }[]>([]);
  const vehiclesRef = useRef<BusVehicle[]>([]);
  const overlaysRef = useRef<any[]>([]);
  const drawRequestRef = useRef(0);

  // ===== 加载线路详情 =====
  useEffect(() => {
    getLineDetail('bus', lineId).then(d => {
      if (d) { setLine(d); setNotFound(false); }
      else setNotFound(true);
    });
  }, [lineId]);

  // ===== 到站倒计时 =====
  useEffect(() => {
    const loadArrival = () => {
      getArrivalInfo(lineId, `stop_${lineId}`).then(a => {
        setArrival(a); setNextSec(a.nextArrivalSeconds); setFollowSec(a.followingArrivalSeconds);
      });
    };
    loadArrival();
    timerRef.current = setInterval(() => {
      setNextSec(prev => { if (prev <= 1) { loadArrival(); return 999; } return prev - 1; });
      setFollowSec(prev => prev <= 1 ? 999 : prev - 1);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lineId]);

  // ===== 地图初始化（依赖 line 确保容器已在 DOM 中） =====
  useEffect(() => {
    if (!line) return;                      // 线路数据未到，不初始化
    if (!mapRef.current) return;             // 容器未渲染（理论上不会）
    if (amapRef.current) return;             // 已初始化
    cancelledRef.current = false;
    setMapLoading(true);
    setMapError('');

    withTimeout(loadAMap(), 15000, '高德地图加载超时，请检查网络')
      .then((AMap: any) => {
        if (cancelledRef.current) return;
        if (!mapRef.current || amapRef.current) return;
        const map = new AMap.Map(mapRef.current, {
          zoom: 13, center: [116.40, 39.91],
          viewMode: '2D', resizeEnable: true,
        });
        amapRef.current = map;
        map.on('complete', () => {
          if (cancelledRef.current) return;
          setMapReady(true);
          setMapLoading(false);
          window.setTimeout(() => map.resize?.(), 100);
        });
      })
      .catch((error: unknown) => {
        if (cancelledRef.current) return;
        console.error('[公交地图初始化失败]', error);
        setMapReady(false);
        setMapLoading(false);
        setMapError(error instanceof Error ? error.message : '地图加载失败，请稍后重试');
      });

    return () => {
      cancelledRef.current = true;
      if (animTimerRef.current) { clearInterval(animTimerRef.current); animTimerRef.current = null; }
      if (amapRef.current) { amapRef.current.destroy?.(); amapRef.current = null; }
      vehicleMarkersRef.current = [];
    };
  }, [line, mapRetryKey]);

  // ===== 绘制路线+站点+车辆（polyline 和车辆使用同一个 path） =====
  useEffect(() => {
    const map = amapRef.current;
    if (!map || !line || !mapReady) return;
    const requestId = ++drawRequestRef.current;
    const direction: BusDirection = dirIdx === 0 ? 'outbound' : 'inbound';
    const lineStations = direction === 'outbound' ? line.stations : [...line.stations].reverse();
    if (overlaysRef.current.length) map.remove(overlaysRef.current);
    overlaysRef.current = [];
    vehicleMarkersRef.current = [];
    geometryRef.current = null;
    setVehicles([]);
    setGeometryError('');
    setGeometrySource('');
    setGeometryLoading(true);
    const AMap = (window as any).AMap;
    if (!AMap) return;

    const backendPath = direction === 'outbound'
      ? normalizePath(line.outboundPath?.length ? line.outboundPath : line.path)
      : normalizePath(line.inboundPath);
    const pathPromise = backendPath.length >= 2
      ? Promise.resolve({ path: backendPath, stations: [] as BusRouteStation[], source: 'backend' as const })
      : searchBusLineGeometry(AMap, {
          city: line.city || '北京', lineId, lineName: line.name, direction,
          stationNames: lineStations.map(station => station.name),
        }).then(match => match ? { path: match.path, stations: match.stations, source: 'amap' as const } : null);

    pathPromise.then(resolved => {
      if (cancelledRef.current || requestId !== drawRequestRef.current || !amapRef.current) return;
      if (!resolved || resolved.path.length < 2) {
        setGeometryLoading(false);
        setGeometryError('暂未匹配到该方向的线路轨迹');
        return;
      }
      const routePath = resolved.path;
      const geometry: BusRouteGeometry = {
        lineId, lineName: line.name,
        stations: mergeStations(lineStations, resolved.stations),
        path: routePath,
      };
      setGeometryLoading(false);
      setGeometrySource(resolved.source);
      console.log(`[公交地图] ${lineId} ${direction} ${resolved.source === 'backend' ? '后端path' : '高德LineSearch'} ${routePath.length}点`);

      // 更新 geometry.path 为最终使用的路径（车辆动画依赖此 path）
      geometryRef.current = { ...geometry, path: routePath };

      // ❷ 绘制线路（蓝色 Polyline）
      const polyline = new AMap.Polyline({
        map: amapRef.current,
        path: routePath,
        strokeColor: '#1677ff', strokeWeight: 6, strokeOpacity: 0.9,
        lineJoin: 'round', lineCap: 'round',
      });
      overlaysRef.current.push(polyline);

      // ❸ 站点标记
      geometry.stations.forEach((st, i) => {
        if (!st.location || !Array.isArray(st.location)) return;
        const isFirst = i === 0, isLast = i === geometry.stations.length - 1;
        const color = isFirst ? '#52c41a' : isLast ? '#f5222d' : '#1677ff';
        const size = isFirst || isLast ? 16 : 10;
        const marker = new AMap.Marker({
          map: amapRef.current,
          position: st.location,
          content: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:700;">${isFirst ? '起' : isLast ? '终' : ''}</div>`,
          offset: new AMap.Pixel(-size / 2, -size / 2),
          title: st.name,
        });
        overlaysRef.current.push(marker);
      });

      apiGet<{
        vehicles?:Array<{ vehicleId:string; plate:string; lng:number; lat:number; speed:number; direction:string }>;
        busId?:string; vehicleId?:string; plate?:string; lng?:number; lat?:number; speed?:number; direction?:string;
        nextStop?:string; nextStopArrivalSeconds?:number; crowding?:string; timestamp?:number;
      }>(`/route/bus/realtime/${lineId}`)
        .then(result => {
          const rawVehicles = result.vehicles || (result.lng !== undefined && result.lat !== undefined ? [{
            vehicleId: result.vehicleId || result.busId || lineId,
            plate: result.plate || '', lng: result.lng, lat: result.lat,
            speed: result.speed || 0, direction: result.direction || '',
          }] : []);
          const demoProgress = [0.18, 0.52, 0.78];
          const inputs: any[] = rawVehicles.length ? rawVehicles : demoProgress.map((progress, index) => ({
            vehicleId: `DEMO00${index + 1}`, progress, speed: [28, 24, 31][index],
          }));
          const vehiclesData: BusVehicle[] = inputs.map((vehicle, index) => {
            const snapped = Number.isFinite(vehicle.lng) && Number.isFinite(vehicle.lat)
              ? snapToPath(routePath, [vehicle.lng, vehicle.lat])
              : { point: pointAtPath(routePath, vehicle.progress ?? demoProgress[index % demoProgress.length]), progress: vehicle.progress ?? demoProgress[index % demoProgress.length] };
            const stopInfo = stationAtProgress(geometry, snapped.progress);
            return {
              vehicleId: vehicle.vehicleId,
              progress: snapped.progress,
              lng: snapped.point[0], lat: snapped.point[1], speed: Number(vehicle.speed) || 0,
              currentStation: stopInfo.currentStation,
              nextStation: result.nextStop || stopInfo.nextStation,
              distanceToNextStation: stopInfo.distanceToNext,
              eta: result.nextStopArrivalSeconds || Math.max(15, Math.round(stopInfo.distanceToNext / Math.max(1, (Number(vehicle.speed) || 20) / 3.6))),
              isDemo: true,
              updatedAt: result.timestamp || Date.now(),
            };
          });
          vehiclesRef.current = vehiclesData;
          vehicleMarkersRef.current = vehiclesData.map(v => {
        const m = new AMap.Marker({
          map: amapRef.current,
          position: [v.lng, v.lat],
          content: '<div style="width:34px;height:34px;border-radius:50%;background:#1677ff;border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:17px;">🚌</div>',
          offset: new AMap.Pixel(-17, -17),
        });
        m.on('click', () => {
          new AMap.InfoWindow({
            content: `<div style="padding:10px 12px;font-size:13px;min-width:180px"><b>🚌 ${geometry.lineName} 公交</b><br/>车辆编号：${v.vehicleId}<br/>速度：<b style="color:#1677ff">${v.speed} km/h</b></div>`,
            offset: new AMap.Pixel(0, -34),
          }).open(amapRef.current!, [v.lng, v.lat]);
        });
        overlaysRef.current.push(m);
        return { vehicleId: v.vehicleId, marker: m };
          });
          setVehicles(vehiclesData);
        })
        .catch(() => setVehicles([]));

      amapRef.current!.setFitView([polyline], false, [50, 50, 50, 50]);
    }).catch(error => {
      if (requestId !== drawRequestRef.current) return;
      console.error(`[公交地图] ${line.name} ${direction}`, error);
      setGeometryLoading(false);
      setGeometryError('暂未获取到该线路轨迹');
    });

    return () => {
      drawRequestRef.current += 1;
      if (animTimerRef.current) { clearInterval(animTimerRef.current); animTimerRef.current = null; }
    };
  }, [mapReady, line, lineId, dirIdx, geometryRetryKey]);

  // 重试地图加载
  const retryMap = () => {
    if (amapRef.current) { amapRef.current.destroy?.(); amapRef.current = null; }
    setMapReady(false); setMapError(''); setMapLoading(true);
    setMapRetryKey(v => v + 1);
  };

  const retryGeometry = () => {
    setGeometryError('');
    setGeometryLoading(true);
    setGeometryRetryKey(value => value + 1);
  };

  // ===== 渲染 =====
  if (notFound) {
    return <div className={styles.page}><div style={{ textAlign: 'center', padding: 60, color: 'var(--text-hint)' }}>该线路暂未收录</div></div>;
  }

  const stations = line ? (dirIdx === 0 ? line.stations : [...line.stations].reverse()) : [];
  const crowd = arrival ? CROWD[arrival.crowdLevel] : CROWD.normal;
  const lead = vehicles[0];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.back} onClick={() => navigate('/travel')}>← 返回</span>
        <span className={styles.title}>🚌 {line?.name || '加载中...'}</span>
        <span className={styles.star} onClick={() => setStarred(!starred)}>{starred ? '⭐' : '☆'}</span>
      </div>

      {/* 方向切换 */}
      {line && (
        <div className={styles.dirSwitch}>
          <button className={`${styles.dirBtn} ${dirIdx === 0 ? styles.dirActive : ''}`} onClick={() => setDirIdx(0)}>去程 · {line.direction}</button>
          <button className={`${styles.dirBtn} ${dirIdx === 1 ? styles.dirActive : ''}`} onClick={() => setDirIdx(1)}>返程 · {[...line.stations].reverse()[0]?.name} → {line.stations[0]?.name}</button>
        </div>
      )}

      {/* 线路信息 */}
      {line && (
        <div className={styles.lineInfo}>
          <span>首班 {line.first} · 末班 {line.last}</span>
          <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>
            线路轨迹：{geometrySource === 'amap' ? '高德数据' : geometrySource === 'backend' ? '后端数据' : '加载中'} · 车辆位置：演示数据
          </span>
        </div>
      )}

      {/* 地图区（永远渲染以确保 ref 挂载） */}
      <div className={styles.mapBox}>
        <div ref={mapRef} className={styles.map} />

        {/* 加载中 */}
        {mapLoading && !mapError && (
          <div className={styles.mapStatus}>
            <span style={{ fontSize: 32 }}>🗺️</span>
            <span>正在加载地图...</span>
          </div>
        )}

        {mapReady && geometryLoading && !geometryError && (
          <div className={styles.mapStatus}>
            <span style={{ fontSize: 32 }}>🚌</span>
            <span>正在加载公交线路轨迹…</span>
          </div>
        )}

        {/* 加载失败 */}
        {mapError && (
          <div className={styles.mapStatus}>
            <span style={{ fontSize: 32 }}>⚠️</span>
            <span>{mapError}</span>
            <button type="button" className={styles.retryBtn} onClick={retryMap}>重新加载</button>
          </div>
        )}


        {mapReady && geometryError && (
          <div className={styles.mapStatus}>
            <span style={{ fontSize: 32 }}>⚠️</span>
            <span>{geometryError || '暂未获取到该线路轨迹'}</span>
            <button type="button" className={styles.retryBtn} onClick={retryGeometry}>重新加载</button>
          </div>
        )}

        {/* 地图就绪 */}
        {mapReady && !geometryLoading && !geometryError && (
          <div className={styles.mapHint}>线路轨迹：{geometrySource === 'amap' ? '高德数据' : '后端数据'} · 车辆演示 · 非官方实时</div>
        )}
      </div>

      {/* 在线车辆列表 */}
      {vehicles.length > 0 && (
        <div className={styles.vehiclesCard}>
          <div className={styles.vehiclesTitle}>🚌 在线车辆（{vehicles.length}辆 · 演示）</div>
          {vehicles.map(v => (
            <div key={v.vehicleId} className={styles.vehicleRow}>
              <span className={styles.vehicleBadge}>{v.vehicleId}</span>
              <div className={styles.vehicleBody}>
                <span className={styles.vehicleStations}>{v.currentStation} → {v.nextStation}</span>
                <span className={styles.vehicleDist}>距下一站 {v.distanceToNextStation}m</span>
              </div>
              <div className={styles.vehicleRight}>
                <span className={styles.vehicleSpeed}>{v.speed} km/h</span>
                <span className={styles.vehicleEta}>{formatCountdown(v.eta)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 实时信息（线路未加载时不显示占位数据） */}
      {line && (
        <div className={styles.liveCard}>
          <div className={styles.liveRow}>
            <div className={styles.liveItem}>
              <span className={styles.liveLabel}>当前站</span>
              <span className={styles.liveValue}>{lead ? lead.currentStation : (stations[currentStopIdx]?.name || '—')}</span>
            </div>
            <div className={styles.liveItem}>
              <span className={styles.liveLabel}>下一站</span>
              <span className={styles.liveValue}>{lead ? lead.nextStation : (stations[currentStopIdx + 1]?.name || '终点站')}</span>
            </div>
            <div className={`${styles.liveItem} ${styles.liveEtaBox}`}>
              <span className={styles.liveLabel}>下一班到站</span>
              <span className={styles.liveEta}>{formatCountdown(lead ? lead.eta : nextSec)}</span>
            </div>
          </div>
          <div className={styles.liveRow}>
            <div className={`${styles.liveItem} ${styles.liveEtaBox}`}>
              <span className={styles.liveLabel}>再下一班</span>
              <span className={styles.liveEta}>{formatCountdown(followSec)}</span>
            </div>
            <div className={styles.liveItem}>
              <span className={styles.liveLabel}>拥挤度</span>
              <span className={styles.liveValue} style={{ color: crowd.color }}>{crowd.emoji} {crowd.label}</span>
            </div>
            <div className={styles.liveItem}>
              <span className={styles.liveLabel}>车辆速度</span>
              <span className={styles.liveValue}>{lead ? `${lead.speed} km/h` : '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 完整站点列表 */}
      {stations.length > 0 && (
        <div className={styles.stopsCard}>
          <div className={styles.stopsTitle}>📍 全线站点（{stations.length}站）</div>
          <div className={styles.stopsList}>
            {stations.map((stop, i) => (
              <div key={stop.id} className={`${styles.stopRow} ${i === currentStopIdx ? styles.stopCurrent : ''}`} onClick={() => setCurrentStopIdx(i)}>
                <div className={styles.stopDot}>{i === currentStopIdx ? '🚏' : i < currentStopIdx ? '✅' : '⚪'}</div>
                <div className={styles.stopBody}>
                  <span className={styles.stopName}>{stop.name}</span>
                  <span className={styles.stopEta}>
                    {i === currentStopIdx ? '当前站' : i < currentStopIdx ? '已通过' : i === currentStopIdx + 1 ? `下一班 ${formatCountdown(lead ? lead.eta : nextSec)}` : ''}
                  </span>
                </div>
                <span className={styles.stopSeq}>{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 快捷操作 */}
      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={() => navigate('/qrcode')}>📱 刷码乘车</button>
        <button className={styles.actionBtn} onClick={() => setStarred(!starred)}>{starred ? '⭐ 已收藏' : '☆ 收藏线路'}</button>
        <button className={styles.actionBtn} onClick={() => navigate('/report/new')}>📷 反馈问题</button>
      </div>

      <div style={{ height: 32 }} />
    </div>
  );
};

export default BusDetailPage;
