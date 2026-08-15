import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AMAP_KEY, loadAMap } from '../../lib/amap';
import { formatDistance } from '@zhitu/shared';
import { getRouteForecast } from '../../services/routeForecastService';
import { hasSegmentContent, resolveRouteLocations, type PlannedRoute, type SegmentData } from '../../services/routePlanningService';
import type { RouteForecastPoint, TravelMode as ForecastMode } from '../../types/routeForecast';
import { calculateRouteScore, recommendBestRoute, generateRecommendationReason, generateDepartureAdvice } from '../../utils/routeRecommendation';
import { isValidDepartureAt, labelForDepartureAt, computeDepartureState, saveDepartureState } from '../../utils/departureTime';
import RouteForecastPanel from '../../components/travel/RouteForecastPanel';
import TravelModeSelector, { normalizeTravelMode, type RouteTravelMode, type TravelModeOption } from '../../components/travel/TravelModeSelector';
import { useAuthStore } from '../../stores/authStore';
import { useTripStore } from '../../stores/tripStore';
import { useTravelPlanStore } from '../../stores/travelPlanStore';
import type { Trip } from '../../types/trip';
import styles from './Travel.module.css';

/** 到达判定阈值：当前车辆与终点剩余距离 ≤ 50m 即视为到达（避免 GPS 误差导致永不触发） */
const ARRIVAL_THRESHOLD_METERS = 50;

// ===== 统一路线类型 =====
type TravelMode = RouteTravelMode;

// 合法的交通方式（用于校验 URL state 传入的 mode）
const VALID_MODES: TravelMode[] = ['drive', 'bus', 'bike', 'walk'];

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

function inferTransitType(value: unknown, name = ''): 'bus' | 'metro' {
  const raw = `${String(value ?? '')} ${name}`.toLowerCase();
  return ['subway', 'metro', 'railway', 'rail', 'tram', 'train', '地铁', '轻轨', '有轨'].some(key => raw.includes(key))
    ? 'metro'
    : 'bus';
}

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    promise.then(
      value => { window.clearTimeout(timer); resolve(value); },
      error => { window.clearTimeout(timer); reject(error); },
    );
  });
}

const RouteResultPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { origin = '我的位置', destination = '目的地', waypoints = [], originCoords = null, departureMode: stateDepartureMode, departureAt: stateDepartureAt, departureTimeLabel: stateDepartureTimeLabel, departureTime = '现在出发' } = (location.state || {}) as {
    origin?: string;
    destination?: string;
    waypoints?: string[];
    mode?: string;
    originCoords?: { lng: number; lat: number } | null;
    departureMode?: 'now' | 'plus30' | 'plus60' | 'custom';
    departureAt?: string;
    departureTimeLabel?: string;
    departureTime?: string;
  };
  const requestedMode = (location.state as { mode?: string } | null)?.mode;
  const initialDisplayMode: TravelModeOption = ['new-energy', 'drive', 'bus', 'bike', 'walk', 'accessible'].includes(requestedMode || '')
    ? requestedMode as TravelModeOption
    : 'drive';
  const initMode = normalizeTravelMode(initialDisplayMode);

  // ===== 出发时间：真实业务时间一律用 departureAt（ISO） =====
  // 优先 router state（HomePage startRoute 传递）；旧链接无则读 sessionStorage；最后回退当前时间。
  const departureAt = useMemo(() => {
    if (isValidDepartureAt(stateDepartureAt)) return stateDepartureAt as string;
    try {
      const raw = sessionStorage.getItem('zhitu_travel_departure');
      if (raw) {
        const parsed = JSON.parse(raw) as { departureAt?: string };
        if (isValidDepartureAt(parsed.departureAt)) return parsed.departureAt as string;
      }
    } catch { /* ignore */ }
    return new Date().toISOString();
  }, [stateDepartureAt]);

  // 展示标签：新模型用 departureTimeLabel；旧链接退化为 departureTime 中文文本
  const departureLabel = stateDepartureMode === 'now'
    ? ''
    : (stateDepartureTimeLabel
        ? stateDepartureTimeLabel
        : (departureTime !== '现在出发' ? departureTime : labelForDepartureAt(departureAt)));

  // 预测以实际出发时间为基准（router state 不可变，用 ref 稳定引用）
  const departureAtRef = useRef(departureAt);

  // 核心状态：selectedMode 必须来自出行规划页选择的交通方式
  const [isPlanning, setIsPlanning] = useState(true);
  const [routeResults, setRouteResults] = useState<Partial<Record<TravelMode, PlannedRoute>>>({});
  const [selectedMode, setSelectedMode] = useState<TravelMode>(
    initMode && VALID_MODES.includes(initMode) ? initMode : 'drive'
  );
  const [selectedDisplayMode, setSelectedDisplayMode] = useState<TravelModeOption>(initialDisplayMode);
  const [unavailableNote, setUnavailableNote] = useState('');
  const [cardData, setCardData] = useState<RouteCardData[]>([]);

  // 未来拥堵预测（模拟 Service）
  const [forecasts, setForecasts] = useState<Partial<Record<TravelMode, RouteForecastPoint[]>>>({});
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState('');
  const [recommendationId, setRecommendationId] = useState<TravelMode | null>(null);
  const [departureAdvice, setDepartureAdvice] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);

  // 导航状态
  const [navActive, setNavActive] = useState(false);
  const [navMode, setNavMode] = useState<TravelMode | null>(null);
  const [navDistance, setNavDistance] = useState(0);
  const [navRouteError, setNavRouteError] = useState('');
  const isLoggedIn = useAuthStore(state => state.isLoggedIn);

  // ===== 导航状态机：idle → navigating → arrived → ended =====
  const [navStatus, setNavStatus] = useState<'idle' | 'navigating' | 'arrived' | 'ended'>('idle');
  const navStatusRef = useRef<'idle' | 'navigating' | 'arrived' | 'ended'>('idle');
  const [arrivedTrip, setArrivedTrip] = useState<Trip | null>(null);
  const hasCompletedTripRef = useRef(false);
  const navDistanceRef = useRef(0);

  // 起终点：没有解析成功前保持 null，禁止用天安门等固定位置冒充用户起点。
  const startCoord = useRef<[number, number] | null>(null);
  const endCoord = useRef<[number, number] | null>(null);
  const [displayOrigin, setDisplayOrigin] = useState(origin || '我的位置');
  const [displayDest, setDisplayDest] = useState(destination || '目的地');
  const [locationsReady, setLocationsReady] = useState(false);
  const [locationError, setLocationError] = useState('');

  // ===== 唯一地图实例 refs（导航复用同一张地图，不创建第二张） =====
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const trafficLayerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const routePolylineRefs = useRef<Partial<Record<TravelMode, any>>>({});
  const startMarkerRef = useRef<any>(null);
  const endMarkerRef = useRef<any>(null);
  const carMarkerRef = useRef<any>(null);
  const movePathRef = useRef<[number, number][]>([]);
  const pathIdxRef = useRef(0);
  const moveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeRequestIdRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  // ===== 解析起终点：标题、Marker、路线规划和导航共用这一对坐标 =====
  useEffect(() => {
    let cancelled = false;
    // 立即使上一次起终点对应的规划请求失效，避免旧请求晚返回后重新画回旧路线。
    routeRequestIdRef.current += 1;
    startCoord.current = null;
    endCoord.current = null;
    setLocationsReady(false);
    setLocationError('');
    setRouteResults({});

    resolveRouteLocations(origin, destination, originCoords)
      .then(({ start, end, originLabel, destinationLabel }) => {
        if (cancelled) return;
        startCoord.current = start;
        endCoord.current = end;
        setDisplayOrigin(originLabel);
        setDisplayDest(destinationLabel);
        setLocationsReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Location resolve failed:', error);
        startCoord.current = null;
        endCoord.current = null;
        setDisplayOrigin(origin || '请选择起点');
        setDisplayDest(destination || '请选择终点');
        setLocationError('无法解析起点或终点，请返回重新定位或从搜索结果中选择地点');
        setIsPlanning(false);
      });

    return () => { cancelled = true; };
  }, [origin, destination, originCoords]);

  // ===== 三路并发规划 =====
  useEffect(() => {
    if (!locationsReady || !startCoord.current || !endCoord.current) {
      setIsPlanning(false);
      return;
    }
    // 请求序号：起点/终点变化后，旧请求结果不再覆盖
    const requestId = ++routeRequestIdRef.current;
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
      if (!s || !e) throw new Error('起点或终点坐标无效');
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
                  const lineName = String(line.name || line.lineName || line.route || '').trim();
                  const segment: SegmentData = {
                    type: inferTransitType(line.type || line.lineType || seg.bus.type, lineName),
                    lineName,
                    fromStation: line.departure_stop?.name || line.departureStop?.name || line.startStation?.name || '',
                    toStation: line.arrival_stop?.name || line.arrivalStop?.name || line.endStation?.name || '',
                    stationCount: line.station_count || line.stationCount,
                    duration: seg.bus.duration || line.duration,
                  };
                  if (hasSegmentContent(segment)) segs.push(segment);
                  if (Array.isArray(line.path)) paths.push(...line.path);
                  else if (Array.isArray(seg.bus.path)) paths.push(...seg.bus.path);
                  return;
                }
                // 3) 铁路 / 轨道交通段
                if (seg.railway) {
                  const rw = seg.railway;
                  const segment: SegmentData = {
                    type: 'metro',
                    lineName: rw.name || rw.lineName || '轨道交通',
                    fromStation: rw.departure_stop?.name || rw.startStation?.name || '',
                    toStation: rw.arrival_stop?.name || rw.endStation?.name || '',
                    stationCount: rw.station_count || rw.stationCount,
                    duration: rw.duration,
                  };
                  if (hasSegmentContent(segment)) segs.push(segment);
                  if (Array.isArray(rw.path)) paths.push(...rw.path);
                  return;
                }
                // 4) 兜底：旧版 transit 结构 / 纯指令段
                if (seg.transit) {
                  const t = seg.transit;
                  const lineName = String(t.name || t.line || t.route || t.transitName || '').trim();
                  const segment: SegmentData = {
                    type: inferTransitType(t.type || t.transitType, lineName),
                    lineName,
                    fromStation: (t.departureStop || t.startStation || t.onStation)?.name || '',
                    toStation: (t.arrivalStop || t.endStation || t.offStation)?.name || '',
                    stationCount: t.stationCount,
                    duration: seg.transit.duration,
                  };
                  if (hasSegmentContent(segment)) segs.push(segment);
                  if (seg.transit.path) paths.push(...seg.transit.path);
                  return;
                }
                // 5) 纯指令段兜底
                if (seg.instruction) {
                  const text = String(seg.instruction.text || seg.instruction.instruction || '').trim();
                  if (text) segs.push({ type: text.includes('步行') ? 'walk' : 'bus', instruction: text, duration: 0 });
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

      const plannerByMode: Record<TravelMode, () => Promise<PlannedRoute>> = {
        drive: planDrive,
        bus: planTransit,
        bike: planRiding,
        walk: planWalking,
      };

      plannerByMode[selectedMode]()
        .then((route) => {
          if (requestId !== routeRequestIdRef.current) return;
          setRouteResults({ [route.mode]: route });
          setUnavailableNote('');
          setIsPlanning(false);
        })
        .catch((error) => {
          if (requestId !== routeRequestIdRef.current) return;
          console.error(`${selectedMode} 规划失败（不展示该方案）:`, error);
          setRouteResults({});
          setUnavailableNote(`该起终点暂无可用${MODE_META[selectedMode].label}路线`);
          setIsPlanning(false);
        });
    }).catch((e) => {
      if (requestId !== routeRequestIdRef.current) return;
      console.error('AMap load failed:', e);
      setMapError('地图加载失败，请检查高德 Key / 安全密钥 / 域名白名单');
      setRouteResults({});
      setIsPlanning(false);
    });
  }, [origin, destination, waypoints, originCoords, locationsReady, selectedMode]);

  // ===== 规划完成后加载每条成功路线的未来拥堵预测（模拟 Service） =====
  useEffect(() => {
    if (isPlanning) return;
    let cancelled = false;
    setForecastLoading(true);
    setForecastError('');

    const modes = VALID_MODES.filter(m => routeResults[m]);
    Promise.all(modes.map(async (mode) => {
      const result = await getRouteForecast(mode, departureAtRef.current);
      return { mode, points: result.points };
    }))
      .then(items => {
        if (cancelled) return;
        const map: Partial<Record<TravelMode, RouteForecastPoint[]>> = {};
        items.forEach(({ mode, points }) => { map[mode] = points; });
        setForecasts(map);
        setForecastLoading(false);
        // 智能推荐 + 出发时间建议（基于当前选中方案）
        const best = recommendBestRoute(modes.map(m => {
          const r = routeResults[m]!;
          return {
            mode: m, label: MODE_META[m].label,
            distance: r.distance, duration: r.duration, toll: r.cost ?? 0,
            forecast: map[m] || undefined,
          };
        }));
        if (best) setRecommendationId(best.mode);
        const selected = routeResults[selectedMode];
        if (selected) {
          setDepartureAdvice(generateDepartureAdvice(map[selectedMode] || []));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setForecastError('预测服务暂不可用');
        setForecastLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlanning]);

  // ===== 切换路线时更新出发时间建议 =====
  useEffect(() => {
    setDepartureAdvice(generateDepartureAdvice(forecasts[selectedMode] || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMode, forecasts]);

  // ===== 唯一地图初始化（只创建一次，导航复用） =====
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!AMAP_KEY) { setMapError('未配置高德地图 Key'); return; }

    let disposed = false;
    loadAMap().then((AMap: any) => {
      if (disposed || !mapContainerRef.current || mapRef.current) return;
      const map = new AMap.Map(mapContainerRef.current, {
        zoom: 11, center: [116.397, 39.909],
        viewMode: '3D', pitch: 0, rotation: 0,
        resizeEnable: true, showBuildingBlock: true,
      });
      const trafficLayer = new AMap.TileLayer.Traffic({ zIndex: 10 });
      map.add(trafficLayer);

      mapRef.current = map;
      trafficLayerRef.current = trafficLayer;
      setMapReady(true);
    }).catch((e: unknown) => {
      if (disposed) return;
      console.error('AMap init failed:', e);
      setMapError('地图初始化失败');
    });

    return () => {
      disposed = true;
      if (moveTimerRef.current) { clearInterval(moveTimerRef.current); moveTimerRef.current = null; }
      mapRef.current?.destroy();
      mapRef.current = null;
      trafficLayerRef.current = null;
      polylineRef.current = null;
      routePolylineRefs.current = {};
      startMarkerRef.current = null;
      endMarkerRef.current = null;
      carMarkerRef.current = null;
    };
  }, []);

  // ===== 起终点变化时更新 Marker 与地图中心（不重建地图） =====
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const AMap = (window as any).AMap;
    if (!AMap) return;

    if (startMarkerRef.current) { map.remove(startMarkerRef.current); startMarkerRef.current = null; }
    if (endMarkerRef.current) { map.remove(endMarkerRef.current); endMarkerRef.current = null; }
    if (!locationsReady || !startCoord.current || !endCoord.current) return;

    startMarkerRef.current = new AMap.Marker({
      position: startCoord.current,
      icon: makeMarkerIcon(AMap, '#52c41a', '起', 28),
    });
    endMarkerRef.current = new AMap.Marker({
      position: endCoord.current,
      icon: makeMarkerIcon(AMap, '#f5222d', '终', 28),
    });
    map.add([startMarkerRef.current, endMarkerRef.current]);
    map.setCenter(startCoord.current);
  }, [origin, destination, originCoords, mapReady, locationsReady]);

  // ===== 多路线 Polyline：同时绘制所有可用方案，当前高亮、其他淡化 =====
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const AMap = (window as any).AMap;
    if (!AMap?.Polyline) return;

    // 清除旧 Polyline
    Object.values(routePolylineRefs.current).forEach(pl => { if (pl) map.remove(pl); });
    routePolylineRefs.current = {};

    const modes = VALID_MODES.filter(m => routeResults[m]?.path?.length);
    if (!modes.length) return;

    modes.forEach((mode) => {
      const route = routeResults[mode]!;
      const isSelected = mode === selectedMode;
      const pl = new AMap.Polyline({
        path: route.path,
        strokeColor: MODE_META[mode].color,
        strokeWeight: isSelected ? 6 : 4,
        strokeOpacity: isSelected ? 0.9 : 0.25,
        strokeStyle: mode === 'bus' ? 'dashed' : 'solid',
        lineJoin: 'round', lineCap: 'round',
      });
      map.add(pl);
      routePolylineRefs.current[mode] = pl;
    });

    // 导航状态保持导航视角，不 setFitView
    if (!navActive) {
      const selectedPl = routePolylineRefs.current[selectedMode];
      if (selectedPl) map.setFitView([selectedPl], false, [80, 60, 80, 60]);
    }
  }, [selectedMode, routeResults, mapReady, navActive]);

  // ===== 导航模式：复用唯一地图，只切换视角 + 车辆 Marker =====
  useEffect(() => {
    if (!navActive || !navMode) return;
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const navRoute = routeResults[navMode];
    const resolvedStart = startCoord.current;
    if (!resolvedStart) {
      setNavRouteError('起点坐标无效，请返回重新选择起点');
      return;
    }
    if (!navRoute?.path?.length) {
      setNavRouteError('当前路线无可用路径');
      return;
    }
    setNavRouteError('');

    // 导航时只显示当前路线，隐藏其他方案的 Polyline
    Object.entries(routePolylineRefs.current).forEach(([m, pl]) => {
      if (pl) pl.setOptions({ visible: m === navMode });
    });

    // 清理旧的移动 Timer 和车辆 Marker
    if (moveTimerRef.current) { clearInterval(moveTimerRef.current); moveTimerRef.current = null; }
    if (carMarkerRef.current) { map.remove(carMarkerRef.current); carMarkerRef.current = null; }

    const AMap = (window as any).AMap;
    if (!AMap) return;

    // 创建唯一车辆 Marker
    const modeIcon = MODE_META[navMode].icon;
    const carMarker = new AMap.Marker({
      position: resolvedStart, anchor: 'center',
      icon: new AMap.Icon({
        image: 'data:image/svg+xml,' + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="20" fill="${MODE_META[navMode].color}" stroke="#fff" stroke-width="3"/><text x="22" y="29" text-anchor="middle" fill="#fff" font-size="20">${modeIcon}</text></svg>`
        ),
        size: new AMap.Size(44, 44),
      }),
    });
    map.add(carMarker);
    carMarkerRef.current = carMarker;

    movePathRef.current = navRoute.path;
    pathIdxRef.current = 0;
    navDistanceRef.current = Math.round(navRoute.distance);
    setNavDistance(navDistanceRef.current);

    // 导航视角（不重建地图）
    map.setZoom(16);
    map.setPitch(60);
    map.setRotation(0);
    map.setCenter(resolvedStart);
    map.resize?.();

    // 车辆移动动画
    const moveTimer = setInterval(() => {
      const p = movePathRef.current;
      const idx = pathIdxRef.current;
      if (!p.length || !carMarkerRef.current) return;
      // 到达判定：走完路径 或 剩余距离 ≤ ARRIVAL_THRESHOLD_METERS=50m
      if (idx >= p.length - 1 || navDistanceRef.current <= ARRIVAL_THRESHOLD_METERS) {
        clearInterval(moveTimer);
        if (moveTimerRef.current === moveTimer) moveTimerRef.current = null;
        navDistanceRef.current = 0;
        setNavDistance(0);
        handleArrived();
        return;
      }
      pathIdxRef.current += 1;
      const next = p[pathIdxRef.current];
      carMarkerRef.current.setPosition(next);
      map.setCenter(next);
      navDistanceRef.current = Math.max(0, navDistanceRef.current - (navRoute.distance / p.length));
      setNavDistance(navDistanceRef.current);
    }, 150);
    moveTimerRef.current = moveTimer;

    return () => {
      // 只清理导航资源，不销毁主地图；恢复所有路线可见
      Object.values(routePolylineRefs.current).forEach(pl => { if (pl) pl.setOptions({ visible: true }); });
      if (moveTimerRef.current) { clearInterval(moveTimerRef.current); moveTimerRef.current = null; }
      if (carMarkerRef.current && map) { map.remove(carMarkerRef.current); }
      carMarkerRef.current = null;
      movePathRef.current = [];
      pathIdxRef.current = 0;
    };
  }, [navActive, navMode, mapReady]);

  // ===== 到达处理：停止一切导航逻辑，只保留地图/终点Marker/路线 =====
  // 到达判定：车辆走完路径（剩余距离 ≤ ARRIVAL_THRESHOLD_METERS=50m）。幂等。
  const handleArrived = () => {
    if (navStatusRef.current === 'arrived') return;
    navStatusRef.current = 'arrived';
    setNavStatus('arrived');
    setNavDistance(0);
    // 停止车辆移动模拟/定位更新/距离/ETA/下一步骤切换
    if (moveTimerRef.current) { clearInterval(moveTimerRef.current); moveTimerRef.current = null; }
    // 地图聚焦终点（不重建地图）
    const map = mapRef.current;
    const end = endCoord.current;
    if (map && end) { map.setCenter(end); map.setZoom(16); }
    // 完成 Trip：只执行一次（hasCompletedTripRef 幂等，防重复 completeTrip / 重复加积分）
    if (isLoggedIn && !hasCompletedTripRef.current) {
      hasCompletedTripRef.current = true;
      void useTripStore.getState().completeActiveTrip()
        .then(trip => { if (trip) setArrivedTrip(trip); })
        .catch(() => undefined);
    }
  };

  // ===== 开始导航：置状态机 + 登录用户创建 Trip（不阻塞导航） =====
  const startNavigation = (mode: TravelMode) => {
    setSelectedMode(mode);
    setNavMode(mode);
    navStatusRef.current = 'navigating';
    setNavStatus('navigating');
    setNavActive(true);
    hasCompletedTripRef.current = false;
    setArrivedTrip(null);
    if (isLoggedIn) {
      const s = startCoord.current, e = endCoord.current;
      const route = routeResults[mode];
      if (s && e && route) {
        const clientSessionId = typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `nav_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        void useTripStore.getState().startTrip({
          clientSessionId,
          mode,
          profile: 'standard',
          origin: { name: displayOrigin, address: displayOrigin, lng: s[0], lat: s[1] },
          destination: { name: displayDest, address: displayDest, lng: e[0], lat: e[1] },
          routeSnapshot: {
            estimatedDistance: route.distance,
            estimatedDuration: route.duration,
            routeProvider: 'amap',
            path: route.path,
          },
          dataSource: 'demo',
        }).catch(() => undefined);
      }
    }
  };

  // ===== 清理导航临时资源（不清地图、不清用户规划条件） =====
  const clearNavigationResources = () => {
    if (moveTimerRef.current) { clearInterval(moveTimerRef.current); moveTimerRef.current = null; }
    const map = mapRef.current;
    if (map && carMarkerRef.current) { map.remove(carMarkerRef.current); }
    carMarkerRef.current = null;
    movePathRef.current = [];
    pathIdxRef.current = 0;
    Object.values(routePolylineRefs.current).forEach(pl => { if (pl) pl.setOptions({ visible: true }); });
  };

  // ===== 结束导航：清理 + 保留规划条件 + 返回首页规划页 =====
  const endNavigation = () => {
    clearNavigationResources();
    // 中途结束（未完成）→ Trip 标记取消，不标已完成
    if (navStatusRef.current === 'navigating') {
      void useTripStore.getState().cancelActiveTrip().catch(() => undefined);
    }
    navStatusRef.current = 'ended';
    setNavStatus('ended');
    setNavActive(false);
    setNavMode(null);
    // 保留规划条件：出发时间写 storage + 起终点/方式写 travelPlanStore，供首页恢复
    try {
      saveDepartureState({
        departureMode: stateDepartureMode ?? (departureLabel ? 'custom' : 'now'),
        departureAt,
        departureTimeLabel: departureLabel || '现在出发',
      });
      const end = endCoord.current;
      useTravelPlanStore.getState().setDestination({
        name: displayDest, address: displayDest,
        lng: end?.[0] ?? null, lat: end?.[1] ?? null, source: 'manual',
      });
      if (navMode) useTravelPlanStore.getState().setMode(navMode);
    } catch { /* ignore */ }
    requestAnimationFrame(() => {
      mapRef.current?.setPitch(0);
      mapRef.current?.setRotation(0);
      mapRef.current?.resize?.();
      const selectedPl = routePolylineRefs.current[selectedMode];
      if (selectedPl) mapRef.current?.setFitView([selectedPl], false, [80, 60, 80, 60]);
    });
    // 返回首页规划页（PR#7 架构下规划入口在首页）
    navigate('/', { replace: true });
  };

  // ===== 退出导航（×）：到达后直接结束；未到达需确认 =====
  const handleCloseNav = () => {
    if (navStatusRef.current === 'arrived') { endNavigation(); return; }
    if (window.confirm('确定结束本次导航吗？')) endNavigation();
  };

  const congestionColor = (l: string) =>
    ({ free: '#52c41a', slow: '#fadb14', congested: '#ff7a00', blocked: '#f5222d' } as Record<string, string>)[l] || '#999';
  const formatDuration = (s: number) => s < 3600 ? `${Math.floor(s / 60)}分钟` : `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}min`;
  const selectTravelMode = (mode: TravelModeOption) => {
    setSelectedDisplayMode(mode);
    setSelectedMode(normalizeTravelMode(mode));
  };

  // 只有高德规划成功的方案才展示
  const availableModes = VALID_MODES.filter(m => routeResults[m]);
  const displayedModes = routeResults[selectedMode] ? [selectedMode] : [];
  const navRoute = navMode ? routeResults[navMode] : null;

  // ===== 单一 return：唯一地图容器始终挂载，导航只切换布局与覆盖层 =====
  return (
    <div className={navActive ? styles.navFullscreen : styles.page}>
      {!navActive && (
        <div className={styles.resultTopRow}>
          <div className={styles.resultHeader}>
            <button type="button" className={styles.backBtn} onClick={() => navigate(-1)} aria-label="返回">←</button>
            <div className={styles.resultRoute}>
              <span>{waypoints.length ? [displayOrigin, ...waypoints, displayDest].join(' → ') : `${displayOrigin} → ${displayDest}`}</span>
            </div>
          </div>
          <TravelModeSelector value={selectedDisplayMode} onChange={selectTravelMode} className={styles.resultModeSelector} />
        </div>
      )}

      {/* 出发时间提示（非「现在出发」时显示） */}
      {!navActive && departureLabel && (
        <div style={{ padding: '8px 14px', background: '#f0f5ff', borderRadius: 8, fontSize: 12, color: '#1677ff', marginBottom: 12, lineHeight: 1.6 }}>
          🕐 出发：{departureLabel}
        </div>
      )}

      {/* 唯一地图容器（导航时铺满全屏，普通模式嵌入页面） */}
      <div className={navActive ? styles.navFullMap : styles.resultMap}>
        <div ref={mapContainerRef} className={styles.sharedMap} />
        {!mapReady && (
          <div className={styles.mapOverlay}>
            {mapError ? (
              <><span style={{ fontSize: 36 }}>⚠️</span><span style={{ fontSize: 14, lineHeight: 1.6 }}>{mapError}</span></>
            ) : (
              <>🗺️ 加载地图中...</>
            )}
          </div>
        )}
        {!navActive && (
          <div className={styles.mapLegend}>
            <span>🟢 畅通</span><span>🟡 缓行</span><span>🟠 拥堵</span><span>🔴 严重</span>
          </div>
        )}
      </div>

      {/* 加载中（仅普通模式） */}
      {!navActive && isPlanning && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-hint)', background: '#fff', borderRadius: 12, marginBottom: 16 }}>
          <div>{MODE_META[selectedMode].icon} 正在规划{MODE_META[selectedMode].label}路线...</div>
        </div>
      )}

      {!navActive && locationError && (
        <div style={{ padding: 14, background: '#fff2f0', color: '#a8071a', border: '1px solid #ffccc7', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontWeight: 600 }}>⚠️ {locationError}</div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{ marginTop: 10, border: 0, borderRadius: 6, padding: '7px 14px', background: '#1677ff', color: '#fff', cursor: 'pointer' }}
          >
            返回重新选择
          </button>
        </div>
      )}

      {/* 导航态 UI（覆盖在地图上，不占布局高度） */}
      {navActive && (
        <>
          <div className={styles.navTopBar}>
            <span className={styles.navCloseBtn} onClick={handleCloseNav}>✕ 退出导航</span>
            <span className={styles.navModeTag}>
              {navMode ? `${MODE_META[navMode].icon} ${MODE_META[navMode].label}` : ''}
            </span>
          </div>
          {navStatus === 'arrived' ? (
            /* ===== 已到达：不再显示 剩余距离/ETA/速度/导航步骤 ===== */
            <div className={styles.navArrivedCard}>
              <div className={styles.navArrivedIcon}>✅</div>
              <div className={styles.navArrivedTitle}>已到达</div>
              <div className={styles.navArrivedDest}>您已到达：{displayDest}</div>
              <div className={styles.navArrivedMeta}>
                <span>📏 距离 {formatDistance(navRoute?.distance || 0)}</span>
                <span>⏱ 耗时 {navRoute ? formatDuration(navRoute.duration) : '--'}</span>
              </div>
              <div className={styles.navArrivedActions}>
                {isLoggedIn && arrivedTrip && (
                  <button className={styles.navArrivedBtn} onClick={() => navigate(`/profile/trips/${arrivedTrip.id}`)}>查看本次出行</button>
                )}
                <button className={styles.navArrivedBtnPrimary} onClick={endNavigation}>结束导航</button>
              </div>
            </div>
          ) : (
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
                  <span className={styles.navStatVal}>{navRoute ? formatDuration(navRoute.duration) : '--'}</span>
                  <span className={styles.navStatLabel}>预计到达</span>
                </div>
                <div className={styles.navStatDivider} />
                <div className={styles.navStatItem}>
                  <span className={styles.navStatVal}>
                    {navMode === 'bike' ? '15' : navMode === 'walk' ? '5' : '32'}
                  </span>
                  <span className={styles.navStatLabel}>km/h</span>
                </div>
              </div>
              {navRouteError ? (
                <div style={{ fontSize: 12, color: '#faad14', textAlign: 'center', padding: '6px 8px', background: 'rgba(250,173,20,0.1)', borderRadius: 6 }}>
                  ⚠️ {navRouteError}
                </div>
              ) : (
                <div className={styles.navSimTip}>📍 {navMode ? MODE_META[navMode].label : ''}模式 · 高德路线 + 3D 导航</div>
              )}
            </div>
          )}
        </>
      )}

      {/* 仅渲染高德规划成功的方案；失败的方式不显示卡片 */}
      {unavailableNote && (
        <div style={{ padding: 10, background: '#fff7e6', color: '#ad6800', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          ⚠️ {unavailableNote}，已为您切换至 {MODE_META[selectedMode].label}
        </div>
      )}

      <div className={styles.optionScroll}>
        {displayedModes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-hint)' }}>
            {isPlanning ? '正在规划当前出行方式...' : mapError ? `⚠️ ${mapError}` : `该起终点暂无可用${MODE_META[selectedMode].label}路线`}
          </div>
        ) : (
          displayedModes.map((mode) => {
            const realRoute = routeResults[mode]!;
            const mock = cardData.find(d => d.mode === mode);
            const distance = realRoute.distance;
            const duration = realRoute.duration;
            const badge = mode === 'drive' ? '推荐' : mode === 'bus' ? '便捷' : mode === 'bike' ? '绿色' : '健康';

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
                    <span style={{ fontSize: 12, color: '#52c41a', marginLeft: 4 }}>
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
                    {realRoute.segments.filter(hasSegmentContent).length === 0 ? (
                      <div className={styles.segment}>
                        <span className={styles.segmentIcon}>🚌</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>公交地铁方案</span>
                        <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>详细换乘信息暂不可用</span>
                      </div>
                    ) : realRoute.segments.filter(hasSegmentContent).map((s, j) => (
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
                  startNavigation(mode);
                }}>
                  {MODE_META[mode].icon} 开始导航 · {MODE_META[mode].label}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ===== 智能推荐 + 出发时间建议 ===== */}
      {!navActive && !isPlanning && availableModes.length > 0 && recommendationId && (
        <div className={styles.forecastSection} style={{ background: '#f0f5ff', border: '1px solid #d6e4ff' }}>
          <div className={styles.forecastTitle}>
            🧠 智能路线推荐
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-hint)' }}>基于模拟预测</span>
          </div>
          {(() => {
            const rec = routeResults[recommendationId];
            const reason = generateRecommendationReason(
              { mode: recommendationId, label: MODE_META[recommendationId].label, distance: rec?.distance ?? 0, duration: rec?.duration ?? 0, toll: rec?.cost ?? 0, forecast: forecasts[recommendationId] },
              availableModes.map(m => ({
                mode: m, label: MODE_META[m].label,
                distance: routeResults[m]?.distance ?? 0, duration: routeResults[m]?.duration ?? 0,
                toll: routeResults[m]?.cost ?? 0, forecast: forecasts[m],
              })),
            );
            return (
              <div className={styles.forecastReason}>
                {MODE_META[recommendationId].icon} 推荐方案：<b>{MODE_META[recommendationId].label}</b>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{reason}</div>
              </div>
            );
          })()}
          <div className={styles.departAdvice} style={{ marginTop: 8, fontSize: 13, color: '#1677ff' }}>
            🕐 出发时间建议：{departureAdvice}
          </div>
        </div>
      )}

      {/* ===== 未来拥堵预测面板 ===== */}
      {!navActive && !isPlanning && availableModes.length > 0 && (
        <RouteForecastPanel
          forecast={forecasts[selectedMode] || []}
          loading={forecastLoading}
          error={forecastError}
          baseAt={departureLabel ? departureAt : undefined}
          onRetry={() => { setForecastLoading(true); setForecastError(''); getRouteForecast(selectedMode, departureAtRef.current).then(r => {
            setForecasts(prev => ({ ...prev, [selectedMode]: r.points }));
            setForecastLoading(false);
          }).catch(() => { setForecastError('预测服务暂不可用'); setForecastLoading(false); }); }}
        />
      )}

      {/* ===== 路线横向比较（折叠） ===== */}
      {!navActive && !isPlanning && availableModes.length > 1 && (
        <div className={styles.forecastSection} style={{ background: '#fff' }}>
          <div className={styles.forecastTitle} style={{ cursor: 'pointer' }} onClick={() => setCompareOpen(!compareOpen)}>
            📊 路线比较 {compareOpen ? '▾' : '▸'}
          </div>
          {compareOpen && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0', color: 'var(--text-hint)' }}>
                  <th style={{ padding: 6, textAlign: 'left' }}>方案</th>
                  <th style={{ padding: 6 }}>当前耗时</th>
                  <th style={{ padding: 6 }}>距离</th>
                  <th style={{ padding: 6 }}>收费</th>
                  <th style={{ padding: 6 }}>30m预计</th>
                  <th style={{ padding: 6 }}>未来趋势</th>
                  <th style={{ padding: 6 }}>综合评分</th>
                </tr>
              </thead>
              <tbody>
                {availableModes.map(m => {
                  const r = routeResults[m]!;
                  const fc = forecasts[m];
                  const fc30 = fc?.find(f => f.offsetMinutes === 30);
                  const trend = fc && fc.length ? (fc[fc.length - 1].index - fc[0].index).toFixed(1) : '暂无预测';
                  const score = calculateRouteScore({ mode: m, label: MODE_META[m].label, distance: r.distance, duration: r.duration, toll: r.cost ?? 0, forecast: fc });
                  return (
                    <tr key={m} style={{ borderBottom: '1px solid #f5f5f5', background: selectedMode === m ? '#f0f5ff' : '#fff' }}>
                      <td style={{ padding: 6, textAlign: 'left' }}>{MODE_META[m].icon} {MODE_META[m].label}</td>
                      <td style={{ padding: 6, textAlign: 'center' }}>{formatDuration(r.duration)}</td>
                      <td style={{ padding: 6, textAlign: 'center' }}>{(r.distance / 1000).toFixed(1)}km</td>
                      <td style={{ padding: 6, textAlign: 'center' }}>{r.cost ? `¥${r.cost}` : '-'}</td>
                      <td style={{ padding: 6, textAlign: 'center' }}>{fc30 ? formatDuration(fc30.estimatedDuration) : '暂无预测'}</td>
                      <td style={{ padding: 6, textAlign: 'center' }}>{trend === '暂无预测' ? trend : `${trend} 指数`}</td>
                      <td style={{ padding: 6, textAlign: 'center', fontWeight: 600 }}>{score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
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
