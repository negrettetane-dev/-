import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AMAP_KEY, loadAMap } from '../../lib/amap';
import { formatDistance } from '@zhitu/shared';
import styles from './Travel.module.css';

// ===== 统一路线类型 =====
type TravelMode = 'drive' | 'bus' | 'bike' | 'walk';

// 合法的交通方式（用于校验 URL state 传入的 mode）
const VALID_MODES: TravelMode[] = ['drive', 'bus', 'bike', 'walk'];

interface PlannedRoute {
  mode: TravelMode;
  distance: number;
  duration: number;
  path: [number, number][];
  polyline: [number, number][];
  segments?: SegmentData[];
  cost?: number;
  calories?: number;
  bikeLaneRatio?: number;
  congestionSegments?: { level: string; ratio: number }[];
  aiAdvice?: string;
  error?: string;
}

interface SegmentData {
  type: 'walk' | 'metro' | 'bus';
  lineName?: string;
  fromStation?: string;
  toStation?: string;
  fromStop?: string;
  toStop?: string;
  crowding?: string;
  nextBusArrival?: number;
  stationCount?: number;
  duration?: number;
  instruction?: string;
}

interface RouteCardData {
  id: string;
  mode: string;
  distance: number;
  duration: number;
  tolls?: number;
  cost?: number;
  calories?: number;
  bikeLaneRatio?: number;
  congestionSegments?: { level: string; ratio: number }[];
  predictions?: { timeOffset: number; estimatedDuration: number; congestionLevel: string; confidence: number }[];
  segments?: SegmentData[];
  aiAdvice?: string;
  bestDepartTime?: number;
}

const MODE_META: Record<TravelMode, { icon: string; label: string; color: string }> = {
  drive: { icon: '🚗', label: '驾车', color: '#1677ff' },
  bus: { icon: '🚌', label: '公交地铁', color: '#52c41a' },
  bike: { icon: '🚲', label: '骑行', color: '#faad14' },
  walk: { icon: '🚶', label: '步行', color: '#722ed1' },
};

// ===== 换乘步骤图标：根据真实交通方式动态选择，不共用公交图标 =====
const TRANSPORT_ICONS: Record<string, string> = {
  walk: '🚶', walking: '🚶', foot: '🚶',
  bus: '🚌', transit: '🚌',
  metro: '🚇', subway: '🚇', railway: '🚇', rail: '🚇', tram: '🚇', train: '🚇',
  drive: '🚗', driving: '🚗',
  bike: '🚲', cycling: '🚲', riding: '🚲', bicycle: '🚲',
};

function getTransportIcon(type?: string): string {
  const key = (type || '').toLowerCase().trim();
  return TRANSPORT_ICONS[key] || '📍';
}

function getTransportLabel(type?: string): string {
  const key = (type || '').toLowerCase().trim();
  if (['walk', 'walking', 'foot'].includes(key)) return '步行';
  if (['metro', 'subway', 'railway', 'rail', 'tram', 'train'].includes(key)) return '地铁';
  if (['bus', 'transit'].includes(key)) return '公交';
  if (['drive', 'driving'].includes(key)) return '驾车';
  if (['bike', 'cycling', 'riding', 'bicycle'].includes(key)) return '骑行';
  return '';
}

const ROUTE_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = ROUTE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const DEST_COORDS: Record<string, [number, number]> = {
  '天安门广场': [116.397, 39.909], '天安门': [116.397, 39.909],
  '故宫博物院': [116.403, 39.918], '王府井步行街': [116.417, 39.914],
  '王府井': [116.417, 39.914], '国贸CBD': [116.461, 39.909],
  '国贸': [116.461, 39.909], '三里屯太古里': [116.455, 39.932],
  '三里屯': [116.455, 39.932], '北京南站': [116.385, 39.863],
  '北京西站': [116.322, 39.895], '北京站': [116.433, 39.903],
  '首都国际机场': [116.608, 40.080], '大兴国际机场': [116.422, 39.516],
  '中关村': [116.316, 39.983], '西单': [116.380, 39.913],
  '望京SOHO': [116.489, 39.996], '颐和园': [116.278, 39.999],
  '鸟巢': [116.395, 39.993], '南锣鼓巷': [116.410, 39.938],
  '朝阳大悦城': [116.524, 39.924], '金融街': [116.361, 39.915],
  '北京大学': [116.310, 39.993], '清华大学': [116.332, 40.001],
  '王府井地下停车场': [116.415, 39.912],
  '国贸CBD地下停车场': [116.462, 39.907],
  '三里屯地下停车场': [116.454, 39.930],
  '中关村购物中心停车场': [116.317, 39.981],
  '北京南站停车场': [116.383, 39.861],
};

const ORIGIN_ADDRESSES = [
  '北京市朝阳区建国路88号·SOHO现代城',
  '北京市海淀区中关村大街27号·中关村广场',
  '北京市东城区东长安街1号·东方广场',
];

const RouteResultPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { origin = '我的位置', destination = '目的地', waypoints = [] } = (location.state || {}) as {
    origin?: string;
    destination?: string;
    waypoints?: string[];
    mode?: string;
  };
  const requestedMode = (location.state as { mode?: string } | null)?.mode;
  const initMode = requestedMode === 'new-energy'
    ? 'drive'
    : requestedMode === 'accessible'
      ? 'bus'
      : requestedMode as TravelMode | undefined;

  // 核心状态：selectedMode 必须来自出行规划页选择的交通方式
  const [isPlanning, setIsPlanning] = useState(true);
  const [routeResults, setRouteResults] = useState<Partial<Record<TravelMode, PlannedRoute>>>({});
  const [selectedMode, setSelectedMode] = useState<TravelMode>(
    initMode && VALID_MODES.includes(initMode) ? initMode : 'drive'
  );
  const [unavailableNote, setUnavailableNote] = useState('');
  const [cardData, setCardData] = useState<RouteCardData[]>([]);

  // 导航状态
  const [navActive, setNavActive] = useState(false);
  const [navDistance, setNavDistance] = useState(0);
  const [navRouteError, setNavRouteError] = useState('');

  // 起终点
  const startCoord = useRef<[number, number]>([116.397, 39.908]);
  const endCoord = useRef<[number, number]>([116.458, 39.920]);
  const [displayOrigin, setDisplayOrigin] = useState('我的位置');
  const [displayDest, setDisplayDest] = useState('目的地');

  // 地图 refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const navMapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const navMapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const carMarkerRef = useRef<any>(null);
  const movePathRef = useRef<any[]>([]);
  const pathIdxRef = useRef(0);
  const moveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  // ===== 解析起终点 =====
  useEffect(() => {
    if (origin === '我的位置' || !origin || origin.includes('坐标') || origin.startsWith('经度')) {
      setDisplayOrigin(ORIGIN_ADDRESSES[Math.floor(Math.random() * ORIGIN_ADDRESSES.length)]);
      startCoord.current = [116.38 + Math.random() * 0.08, 39.89 + Math.random() * 0.05];
    } else {
      setDisplayOrigin(origin);
      const sm = DEST_COORDS[origin];
      if (sm) startCoord.current = sm;
    }
    const dm = Object.entries(DEST_COORDS).find(([k]) => destination.includes(k) || k.includes(destination));
    if (dm) {
      endCoord.current = dm[1];
      setDisplayDest(dm[0]);
    } else {
      setDisplayDest(destination);
    }
  }, [origin, destination]);

  // ===== 三路并发规划 =====
  useEffect(() => {
    setIsPlanning(true);
    setRouteResults({});
    setUnavailableNote('');

    // 加载 mock 卡片数据作为展示兜底
    const query = new URLSearchParams({ origin, dest: destination, mode: selectedMode });
    if (waypoints.length) query.set('waypoints', waypoints.join('|'));

    fetch(`/api/route/plan?${query.toString()}`)
      .then(r => r.json())
      .then(d => { if (d.data) setCardData(Array.isArray(d.data) ? d.data : [d.data]); });

    // 真实 AMap 三路规划
    withTimeout(loadAMap(), 'AMap load').then((AMap: any) => {
      const s = startCoord.current;
      const e = endCoord.current;
      const startLngLat = new AMap.LngLat(s[0], s[1]);
      const endLngLat = new AMap.LngLat(e[0], e[1]);

      // --- 驾车 ---
      const planDrive = (): Promise<PlannedRoute> => withTimeout(new Promise((resolve, reject) => {
        AMap.plugin(['AMap.Driving'], () => {
          const drv = new AMap.Driving({ policy: AMap.DrivingPolicy.LEAST_TIME });
          drv.search(startLngLat, endLngLat, (status: string, result: any) => {
            if (status === 'complete' && result.routes?.length) {
              const r = result.routes[0];
              resolve({
                mode: 'drive', distance: r.distance, duration: r.time,
                path: extractRoutePath(r),
                polyline: extractRoutePath(r),
                congestionSegments: [{ level: 'slow', ratio: 0.3 }, { level: 'free', ratio: 0.7 }],
                aiAdvice: '建议避开长安街东段，走三环辅路可节省约8分钟',
              });
            } else {
              console.warn('Driving route failed:', result.info);
              reject(new Error(result.info || '驾车路线规划失败'));
            }
          });
        });
      }), 'Driving route');

      // --- 公交 ---
      const planTransit = (): Promise<PlannedRoute> => withTimeout(new Promise((resolve, reject) => {
        AMap.plugin(['AMap.Transfer'], () => {
          const transfer = new AMap.Transfer({
            policy: AMap.TransferPolicy.LEAST_TIME,
            city: '北京',
            nightflag: false,
          });
          transfer.search(startLngLat, endLngLat, (status: string, result: any) => {
            if (status === 'complete' && result.plans?.length) {
              const plan = result.plans[0];
              // 提取各段路径和换乘信息（按高德真实 segment 结构解析：
              //   walking / bus.buslines / railway / transit，兼容多种字段别名）
              const segs: SegmentData[] = [];
              const paths: [number, number][] = [];
              plan.segments.forEach((seg: any) => {
                // 1) 步行段
                if (seg.walking) {
                  segs.push({ type: 'walk', instruction: `步行 ${formatDistance(seg.walking.distance || 0)}`, duration: seg.walking.duration });
                  if (Array.isArray(seg.walking.path)) paths.push(...seg.walking.path);
                  return;
                }
                // 2) 公交/地铁段（高德 Transfer 实际结构：seg.bus.buslines[] 候选线路）
                if (seg.bus?.buslines?.length) {
                  // 只取主选线路 buslines[0]，不要把所有候选线路都渲染
                  const line = seg.bus.buslines[0];
                  const rawType = String(line.type || line.lineType || seg.bus.type || '').toLowerCase();
                  const isMetro = ['subway', 'metro', 'railway', 'rail', 'tram', 'train', '高铁', '动车', '地铁'].some(k => rawType.includes(k));
                  segs.push({
                    type: isMetro ? 'metro' : 'bus',
                    lineName: line.name || line.lineName || line.route || '',
                    fromStation: line.departure_stop?.name || line.departureStop?.name || line.startStation?.name || '',
                    toStation: line.arrival_stop?.name || line.arrivalStop?.name || line.endStation?.name || '',
                    stationCount: line.station_count || line.stationCount,
                    duration: seg.bus.duration || line.duration,
                  });
                  if (Array.isArray(line.path)) paths.push(...line.path);
                  else if (Array.isArray(seg.bus.path)) paths.push(...seg.bus.path);
                  return;
                }
                // 3) 铁路 / 轨道交通段
                if (seg.railway) {
                  const rw = seg.railway;
                  segs.push({
                    type: 'metro',
                    lineName: rw.name || rw.lineName || '轨道交通',
                    fromStation: rw.departure_stop?.name || rw.startStation?.name || '',
                    toStation: rw.arrival_stop?.name || rw.endStation?.name || '',
                    stationCount: rw.station_count || rw.stationCount,
                    duration: rw.duration,
                  });
                  if (Array.isArray(rw.path)) paths.push(...rw.path);
                  return;
                }
                // 4) 兜底：旧版 transit 结构 / 纯指令段
                if (seg.transit) {
                  const t = seg.transit;
                  const rawType = String(t.type || t.transitType || '').toLowerCase();
                  const isMetro = ['subway', 'metro', 'railway', 'rail', 'tram', 'train', '高铁', '动车', '地铁'].some(k => rawType.includes(k));
                  segs.push({
                    type: isMetro ? 'metro' : 'bus',
                    lineName: t.name || t.line || t.route || t.transitName || '',
                    fromStation: (t.departureStop || t.startStation || t.onStation)?.name || '',
                    toStation: (t.arrivalStop || t.endStation || t.offStation)?.name || '',
                    stationCount: t.stationCount,
                    duration: seg.transit.duration,
                  });
                  if (seg.transit.path) paths.push(...seg.transit.path);
                  return;
                }
                // 5) 纯指令段兜底
                if (seg.instruction) {
                  const text = seg.instruction.text || seg.instruction.instruction || '';
                  segs.push({ type: text.includes('步行') ? 'walk' : 'bus', instruction: text, duration: 0 });
                }
              });
              // 只有高德返回了真实路径才视为成功；无路径不补模拟路线（按需求隐藏该方案）
              if (!paths.length) {
                console.warn('Transit route has no path segments');
                reject(new Error('公交路线无路径数据'));
                return;
              }
              resolve({
                mode: 'bus', distance: plan.distance || 9200,
                duration: plan.time, path: paths,
                polyline: paths,
                segments: segs, cost: plan.cost || 5,
              });
            } else {
              console.warn('Transit route failed:', result.info);
              reject(new Error(result.info || '公交路线规划失败'));
            }
          });
        });
      }), 'Transit route');

      // --- 骑行 ---
      const planRiding = (): Promise<PlannedRoute> => withTimeout(new Promise((resolve, reject) => {
        AMap.plugin(['AMap.Riding'], () => {
          const riding = new AMap.Riding({});
          riding.search(startLngLat, endLngLat, (status: string, result: any) => {
            if (status === 'complete' && result.routes?.length) {
              const r = result.routes[0];
              resolve({
                mode: 'bike', distance: r.distance, duration: r.time,
                path: extractRoutePath(r),
                polyline: extractRoutePath(r),
                calories: Math.round(r.distance / 1000 * 30),
              });
            } else {
              console.warn('Riding route failed:', result.info);
              reject(new Error(result.info || '骑行路线规划失败'));
            }
          });
        });
      }), 'Riding route');

      // --- 步行（独立规划，不复用公交/驾车） ---
      const planWalking = (): Promise<PlannedRoute> => withTimeout(new Promise((resolve, reject) => {
        AMap.plugin(['AMap.Walking'], () => {
          const walking = new AMap.Walking({});
          walking.search(startLngLat, endLngLat, (status: string, result: any) => {
            if (status === 'complete' && result.routes?.length) {
              const r = result.routes[0];
              resolve({
                mode: 'walk', distance: r.distance, duration: r.time,
                path: extractRoutePath(r),
                polyline: extractRoutePath(r),
                calories: Math.round(r.distance / 1000 * 45),
              });
            } else {
              console.warn('Walking route failed:', result.info);
              reject(new Error(result.info || '步行路线规划失败'));
            }
          });
        });
      }), 'Walking route');

      // 真实结果驱动：高德规划成功才保留该路线，失败不展示、不补模拟路线
      Promise.allSettled([planDrive(), planTransit(), planRiding(), planWalking()])
        .then((results: PromiseSettledResult<PlannedRoute>[]) => {
          const res: Partial<Record<TravelMode, PlannedRoute>> = {};
          results.forEach((r) => {
            if (r.status === 'fulfilled') {
              res[r.value.mode] = r.value;
              console.log(`${r.value.mode} 规划成功，路径点数:`, r.value.path.length);
            } else {
              const mode = VALID_MODES[results.indexOf(r)];
              console.error(`${mode} 规划失败（不展示该方案）:`, r.reason);
              // 失败：不赋值 → 页面不显示该方式
            }
          });
          setRouteResults(res);
          // 若用户选中的方式不可用，自动切换到第一个可用方案
          const firstAvailable = VALID_MODES.find(m => res[m]);
          setSelectedMode(prev => (prev && res[prev] ? prev : (firstAvailable || 'drive')));
          setUnavailableNote(initMode && !res[initMode] ? `该起终点暂无可用${MODE_META[initMode].label}路线` : '');
          setIsPlanning(false);
        });
    }).catch((e) => {
      console.error('AMap load failed:', e);
      setMapError('地图加载失败，请检查高德 Key / 安全密钥 / 域名白名单');
      setRouteResults({});
      setIsPlanning(false);
    });
  }, [origin, destination, waypoints]);

  // ===== 加载地图 + 绘制当前选中路线 =====
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!AMAP_KEY) { setMapError('未配置高德地图 Key'); return; }

    loadAMap().then((AMap: any) => {
      if (!mapContainerRef.current || mapRef.current) return;
      const map = new AMap.Map(mapContainerRef.current, {
        zoom: 13, center: startCoord.current,
        viewMode: '2D', resizeEnable: true,
      });
      map.add(new AMap.TileLayer.Traffic({ zIndex: 10 }));

      // 起终点标记
      const startIcon = new AMap.Marker({
        position: startCoord.current,
        icon: makeMarkerIcon(AMap, '#52c41a', '起', 28),
      });
      const endIcon = new AMap.Marker({
        position: endCoord.current,
        icon: makeMarkerIcon(AMap, '#f5222d', '终', 28),
      });
      map.add([startIcon, endIcon]);
      mapRef.current = map;
      setMapReady(true);
    }).catch((e: unknown) => {
      console.error('AMap init failed:', e);
      setMapError('地图初始化失败');
    });
  }, [origin, destination]);

  // ===== 切换路线时重绘 polyline =====
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const route = routeResults[selectedMode];
    if (!route?.path?.length) return;

    // 移除旧路线
    if (polylineRef.current) { map.remove(polylineRef.current); polylineRef.current = null; }

    const color = MODE_META[selectedMode].color;
    const AMap = (window as any).AMap;
    if (!AMap?.Polyline) return;

    const pl = new AMap.Polyline({
      path: route.path,
      strokeColor: color,
      strokeWeight: selectedMode === 'bike' ? 4 : 5,
      strokeOpacity: 0.85,
      strokeStyle: selectedMode === 'bus' ? 'dashed' : 'solid',
      lineJoin: 'round', lineCap: 'round',
    });
    map.add(pl);
    polylineRef.current = pl;
    map.setFitView([pl], false, [80, 60, 80, 60]);
    console.log(`绘制 ${selectedMode} 路线，路径点数:`, route.path.length);
  }, [selectedMode, routeResults, mapReady]);

  // ===== 导航模式 =====
  useEffect(() => {
    if (!navActive) return;
    setNavRouteError('');
    const navRoute = routeResults[selectedMode];
    if (!navRoute?.path?.length) {
      setNavRouteError('当前路线无可用路径');
      return;
    }

    const timer = setTimeout(() => {
      if (!navMapContainerRef.current || navMapRef.current) return;
      loadAMap().then((AMap: any) => {
        if (!navMapContainerRef.current || navMapRef.current) return;

        const map = new AMap.Map(navMapContainerRef.current, {
          zoom: 16, center: startCoord.current,
          viewMode: '3D', pitch: 60, rotation: 0,
          showBuildingBlock: true, buildingAnimation: true,
          resizeEnable: true,
        });
        map.add(new AMap.TileLayer.Traffic({ zIndex: 10 }));

        // 车辆标记
        const modeIcon = MODE_META[selectedMode].icon;
        const carMarker = new AMap.Marker({
          position: startCoord.current, anchor: 'center',
          icon: new AMap.Icon({
            image: 'data:image/svg+xml,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="20" fill="${MODE_META[selectedMode].color}" stroke="#fff" stroke-width="3"/><text x="22" y="29" text-anchor="middle" fill="#fff" font-size="20">${modeIcon}</text></svg>`
            ),
            size: new AMap.Size(44, 44),
          }),
        });
        const endMarker = new AMap.Marker({
          position: endCoord.current, anchor: 'center',
          icon: makeMarkerIcon(AMap, '#f5222d', '终', 32),
        });
        map.add([carMarker, endMarker]);
        carMarkerRef.current = carMarker;

        // 路线
        map.add(new AMap.Polyline({
          path: navRoute.path,
          strokeColor: MODE_META[selectedMode].color,
          strokeWeight: 6, strokeOpacity: 0.85,
          lineJoin: 'round', lineCap: 'round',
        }));

        movePathRef.current = navRoute.path;
        pathIdxRef.current = 0;

        // 车辆移动动画
        const startMoving = () => {
          if (moveTimerRef.current) clearInterval(moveTimerRef.current);
          moveTimerRef.current = setInterval(() => {
            const p = movePathRef.current;
            const idx = pathIdxRef.current;
            if (!p.length || !carMarkerRef.current) return;
            if (idx >= p.length - 1) {
              clearInterval(moveTimerRef.current!); moveTimerRef.current = null;
              setNavDistance(0);
              return;
            }
            pathIdxRef.current += 1;
            const next = p[pathIdxRef.current];
            carMarkerRef.current.setPosition(next);
            map.setCenter(next);
            setNavDistance(d => Math.max(0, d - (navRoute.distance / p.length)));
          }, 150);
        };

        navMapRef.current = map;
        setNavDistance(Math.round(navRoute.distance));
        startMoving();
      }).catch((e: unknown) => {
        console.error('Nav map failed:', e);
        setNavRouteError('导航地图初始化失败');
      });
    }, 250);

    return () => {
      clearTimeout(timer);
      if (moveTimerRef.current) { clearInterval(moveTimerRef.current); moveTimerRef.current = null; }
      if (navMapRef.current) { navMapRef.current.destroy(); navMapRef.current = null; }
      carMarkerRef.current = null;
      movePathRef.current = [];
      pathIdxRef.current = 0;
    };
  }, [navActive, selectedMode]);

  const congestionColor = (l: string) =>
    ({ free: '#52c41a', slow: '#fadb14', congested: '#ff7a00', blocked: '#f5222d' } as Record<string, string>)[l] || '#999';
  const formatDuration = (s: number) => s < 3600 ? `${Math.floor(s / 60)}分钟` : `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}min`;

  // ===== 全屏导航模式 =====
  if (navActive) {
    // 只导航真实存在的高德路线；按钮仅在可用卡片上渲染，理论上必有路线
    const navRoute = routeResults[selectedMode];
    if (!navRoute?.path?.length) {
      return (
        <div className={styles.page}>
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-hint)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div>该方式暂无可用路线</div>
            <button className={styles.navBtn} style={{ marginTop: 16, maxWidth: 220 }} onClick={() => setNavActive(false)}>
              返回路线列表
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.navFullscreen}>
        <div ref={navMapContainerRef} className={styles.navFullMap} />
        <div className={styles.navTopBar}>
          <span className={styles.navCloseBtn} onClick={() => setNavActive(false)}>✕ 退出导航</span>
          <span className={styles.navModeTag}>{MODE_META[selectedMode].icon} {MODE_META[selectedMode].label}</span>
        </div>
        <div className={styles.navBottomCard}>
          <div className={styles.navNextAction}>
            <span className={styles.navTurnIcon}>↗️</span>
            <div>
              <div className={styles.navTurnText}>沿当前路线行驶</div>
              <div className={styles.navTurnSub}>{Math.round(navDistance)}m 后继续前行</div>
            </div>
          </div>
          <div className={styles.navStats}>
            <div className={styles.navStatItem}>
              <span className={styles.navStatVal}>{(navDistance / 1000).toFixed(1)}</span>
              <span className={styles.navStatLabel}>剩余 km</span>
            </div>
            <div className={styles.navStatDivider} />
            <div className={styles.navStatItem}>
              <span className={styles.navStatVal}>{formatDuration(navRoute.duration)}</span>
              <span className={styles.navStatLabel}>预计到达</span>
            </div>
            <div className={styles.navStatDivider} />
            <div className={styles.navStatItem}>
              <span className={styles.navStatVal}>{selectedMode === 'bike' ? '15' : selectedMode === 'walk' ? '5' : '32'}</span>
              <span className={styles.navStatLabel}>km/h</span>
            </div>
          </div>
          {navRouteError ? (
            <div style={{ fontSize: 12, color: '#faad14', textAlign: 'center', padding: '6px 8px', background: 'rgba(250,173,20,0.1)', borderRadius: 6 }}>
              ⚠️ {navRouteError}
            </div>
          ) : (
            <div className={styles.navSimTip}>📍 {MODE_META[selectedMode].label}模式 · 高德实时路线 + 3D 导航</div>
          )}
        </div>
      </div>
    );
  }

  // 只有高德规划成功的方案才展示
  const availableModes = VALID_MODES.filter(m => routeResults[m]);

  // ===== 路线规划列表模式 =====
  return (
    <div className={styles.page}>
      <div className={styles.resultHeader}>
        <span onClick={() => navigate(-1)} style={{ cursor: 'pointer', fontSize: 18 }}>←</span>
        <div className={styles.resultRoute}>
          <span>{[displayOrigin, ...waypoints, displayDest].join(' → ')}</span>
        </div>
      </div>

      {/* 加载中 */}
      {isPlanning && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-hint)', background: '#fff', borderRadius: 12, marginBottom: 16 }}>
          <div>🚗 正在规划驾车路线...</div>
          <div>🚌 正在规划公交路线...</div>
          <div>🚲 正在规划骑行路线...</div>
          <div>🚶 正在规划步行路线...</div>
        </div>
      )}

      {/* 地图 */}
      <div className={styles.resultMap}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }} />
        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', borderRadius: 12, color: '#fff', fontSize: 18, gap: 8, padding: 20, textAlign: 'center' }}>
            {mapError ? (
              <><span style={{ fontSize: 36 }}>⚠️</span><span style={{ fontSize: 14, lineHeight: 1.6 }}>{mapError}</span></>
            ) : (
              <>🗺️ 加载地图中...</>
            )}
          </div>
        )}
        <div className={styles.mapLegend}>
          <span>🟢 畅通</span><span>🟡 缓行</span><span>🟠 拥堵</span><span>🔴 严重</span>
        </div>
      </div>

      {/* 仅渲染高德规划成功的方案；失败的方式不显示卡片 */}
      {unavailableNote && (
        <div style={{ padding: 10, background: '#fff7e6', color: '#ad6800', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          ⚠️ {unavailableNote}，已为您切换至 {MODE_META[selectedMode].label}
        </div>
      )}

      <div className={styles.optionScroll}>
        {availableModes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-hint)' }}>
            {mapError ? `⚠️ ${mapError}` : '该起终点暂无可用路线方案'}
          </div>
        ) : (
          availableModes.map((mode, i) => {
            const realRoute = routeResults[mode]!;
            const mock = cardData.find(d => d.mode === mode);
            const distance = realRoute.distance;
            const duration = realRoute.duration;
            const badge = i === 0 ? '推荐' : i === 1 ? '备选' : i === 2 ? '绿色' : '健康';

            return (
              <div
                key={mode}
                className={`${styles.routeCard} ${selectedMode === mode ? styles.routeCardActive : ''}`}
                onClick={() => setSelectedMode(mode)}
              >
                <div className={styles.routeCardHeader}>
                  <span style={{ fontSize: 18 }}>{MODE_META[mode].icon}</span>
                  <div>
                    <span className={styles.routeDuration}>{formatDuration(duration)}</span>
                    <span style={{ fontSize: 12, color: i === 0 ? '#52c41a' : 'var(--text-hint)', marginLeft: 4 }}>
                      {badge}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {(distance / 1000).toFixed(1)}km
                  </span>
                </div>

                {/* 驾车：拥堵预测 */}
                {mode === 'drive' && mock?.congestionSegments && (
                  <div className={styles.congestionBar}>
                    {mock.congestionSegments.map((s, j) => (
                      <div key={j} style={{ flex: s.ratio, background: congestionColor(s.level), height: '100%', borderRadius: 2 }} />
                    ))}
                  </div>
                )}

                {/* 公交：换乘段 */}
                {mode === 'bus' && realRoute.segments && (
                  <div className={styles.segments}>
                    {realRoute.segments.map((s, j) => (
                      <div key={j} className={styles.segment}>
                        <span className={styles.segmentIcon}>{getTransportIcon(s.type)}</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>
                          {s.lineName || s.instruction || getTransportLabel(s.type)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>
                          {s.fromStation || s.fromStop || ''}
                          {s.fromStation || s.fromStop ? ' → ' : ''}
                          {s.toStation || s.toStop || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 骑行：卡路里 */}
                {mode === 'bike' && (
                  <div className={styles.bikeInfo}>
                    <span>🔥 约{realRoute.calories || Math.round(distance / 1000 * 30)}kcal</span>
                    <span>🛣️ 绿色出行减碳</span>
                  </div>
                )}

                {/* 步行：卡路里（独立内容，不含公交换乘） */}
                {mode === 'walk' && (
                  <div className={styles.bikeInfo}>
                    <span>🔥 约{realRoute.calories || Math.round(distance / 1000 * 45)}kcal</span>
                    <span>🚶 步行直达 · 健康出行</span>
                  </div>
                )}

                {/* AI 建议（仅驾车） */}
                {mode === 'drive' && realRoute.aiAdvice && (
                  <div className={styles.aiAdvice}><span>🤖 AI建议：</span><span>{realRoute.aiAdvice}</span></div>
                )}
                {mode === 'bus' && mock?.aiAdvice && (
                  <div className={styles.aiAdvice}><span>🤖 AI建议：</span><span>{mock.aiAdvice}</span></div>
                )}

                <button className={styles.navBtn} onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMode(mode);
                  setTimeout(() => setNavActive(true), 50);
                }}>
                  {MODE_META[mode].icon} 开始导航 · {MODE_META[mode].label}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ===== 工具函数 =====

function extractRoutePath(route: any): [number, number][] {
  if (Array.isArray(route?.path) && route.path.length) return route.path;
  if (Array.isArray(route?.polyline) && route.polyline.length) return route.polyline;
  const steps = Array.isArray(route?.steps)
    ? route.steps
    : route?.steps && typeof route.steps === 'object'
      ? Object.values(route.steps)
      : [];
  return steps.flatMap((step: any) => {
    if (Array.isArray(step?.path)) return step.path;
    if (Array.isArray(step?.polyline)) return step.polyline;
    return [];
  });
}

function makeMarkerIcon(AMap: any, color: string, text: string, size: number) {
  return new AMap.Icon({
    image: 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="${color}" stroke="#fff" stroke-width="2"/><text x="${size / 2}" y="${size / 2 + 5}" text-anchor="middle" fill="#fff" font-size="${size * 0.4}" font-weight="bold">${text}</text></svg>`
    ),
    size: new AMap.Size(size, size),
  });
}

export default RouteResultPage;
