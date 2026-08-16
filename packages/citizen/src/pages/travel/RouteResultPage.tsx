import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AMAP_KEY, loadAMap } from '../../lib/amap';
import { formatDistance } from '@zhitu/shared';
import { getRouteForecast } from '../../services/routeForecastService';
import { hasSegmentContent, resolveRouteLocations, planAmapRoute, planTransitCandidates, type PlannedRoute, type SegmentData } from '../../services/routePlanningService';
import type { RouteForecastPoint, TravelMode as ForecastMode } from '../../types/routeForecast';
import { calculateRouteScore, recommendBestRoute, generateRecommendationReason, generateDepartureAdvice } from '../../utils/routeRecommendation';
import { isValidDepartureAt, labelForDepartureAt, computeDepartureState, saveDepartureState } from '../../utils/departureTime';
import RouteForecastPanel from '../../components/travel/RouteForecastPanel';
import TravelModeSelector, { normalizeTravelMode, type RouteTravelMode, type TravelModeOption } from '../../components/travel/TravelModeSelector';
import AccessibleRouteCard from '../../components/travel/AccessibleRouteCard';
import { buildAccessibleOptions, type AccessibleRouteOption } from '../../services/accessibilityService';
import { getFacilityForStation, getFacilitySource } from '../../data/accessibilityFacilities';
import { useAuthStore } from '../../stores/authStore';
import { useTripStore } from '../../stores/tripStore';
import { useTravelPlanStore } from '../../stores/travelPlanStore';
import { useTravelLocationStore } from '../../stores/travelLocationStore';
import { isTransitSupported } from '../../services/transitEligibility';
import { fromLegacyRouteMode } from '../../types/travelMode';
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

const RouteResultPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { origin = '我的位置', destination = '目的地', waypoints = [], originCoords = null, destinationCoords = null, departureMode: stateDepartureMode, departureAt: stateDepartureAt, departureTimeLabel: stateDepartureTimeLabel, departureTime = '现在出发' } = (location.state || {}) as {
    origin?: string;
    destination?: string;
    waypoints?: string[];
    mode?: string;
    originCoords?: { lng: number; lat: number } | null;
    destinationCoords?: { lng: number; lat: number } | null;
    departureMode?: 'now' | 'plus30' | 'plus60' | 'custom';
    departureAt?: string;
    departureTimeLabel?: string;
    departureTime?: string;
  };
  const requestedMode = (location.state as { mode?: string } | null)?.mode;
  const initialDisplayMode: TravelModeOption = ['ev', 'driving', 'transit', 'riding', 'walking', 'accessible'].includes(requestedMode || '')
    ? requestedMode as TravelModeOption
    : 'driving';
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

  // 无障碍出行：从高德真实多方案中按无障碍目标重排出的候选
  const [accessibleOptions, setAccessibleOptions] = useState<AccessibleRouteOption[]>([]);
  const [accessibleSelectedId, setAccessibleSelectedId] = useState<'accessible' | 'fastest' | 'least-walk' | null>(null);
  const [accessibleUnavailableNote, setAccessibleUnavailableNote] = useState('');
  // 无障碍模式派生状态（须在组件顶部、所有 effect 依赖数组之前定义，避免 TDZ）
  const accessibleActive = selectedDisplayMode === 'accessible';
  const accessibleSelected = accessibleOptions.find(o => o.id === accessibleSelectedId) || accessibleOptions[0] || null;

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
  // 无障碍设施标记（♿/🛗/⚠️），仅无障碍模式绘制，进入导航时清除
  const accessibleMarkersRef = useRef<any[]>([]);

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

    resolveRouteLocations(origin, destination, originCoords, destinationCoords)
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
  }, [origin, destination, originCoords, destinationCoords]);

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

    // 真实 AMap 规划：统一走 routePlanningService（唯一实现），不再在结果页重复维护 planner
    const s = startCoord.current;
    const e = endCoord.current;
    if (!s || !e) { setIsPlanning(false); return; }

    // 公交/地铁：调用前先判断同城（city/adcode 可用时提前拦截，不调高德公交接口）
    if (selectedMode === 'bus') {
      const transitCheck = isTransitSupported(
        useTravelLocationStore.getState().origin,
        useTravelPlanStore.getState().destination,
      );
      if (!transitCheck.supported) {
        setRouteResults({});
        setUnavailableNote(transitCheck.message || '🚌 暂不支持跨城市公交/地铁规划。');
        setIsPlanning(false);
        return;
      }
    }

    // 无障碍出行：取全部真实公交候选 → 按无障碍目标重排（无障碍推荐/时间较短/移动较少）
    const planSelected = async (): Promise<PlannedRoute> => {
      if (selectedMode === 'bus' && selectedDisplayMode === 'accessible') {
        const candidates = await planTransitCandidates(s, e);
        const accessible = buildAccessibleOptions(candidates);
        setAccessibleOptions(accessible);
        setAccessibleUnavailableNote(accessible.length ? '' : '');
        if (accessible.length === 0) throw new Error('transit-no-valid-segment');
        setAccessibleSelectedId(accessible[0].id);
        return accessible[0].route;
      }
      return planAmapRoute(selectedMode, s, e);
    };

    planSelected()
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
        const msg = error instanceof Error ? error.message : '';
        if (selectedMode === 'bus' && msg.includes('CROSS_CITY_TRANSIT_UNSUPPORTED')) {
          setUnavailableNote('🚌 当前起终点不在同一城市，暂不支持跨城市公交/地铁联程规划。');
        } else if (selectedMode === 'bus' && msg.includes('transit-no-valid-segment')) {
          setUnavailableNote('🚌 暂无可用公交/地铁方案。');
        } else {
          setUnavailableNote(`该起终点暂无可用${MODE_META[selectedMode].label}路线`);
        }
        setIsPlanning(false);
      });
  }, [origin, destination, waypoints, originCoords, locationsReady, selectedMode, selectedDisplayMode]);

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

  // ===== 无障碍模式：绘制 ♿/🛗/⚠️ 设施节点标记（复用唯一地图） =====
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const AMap = (window as any).AMap;
    if (!AMap) return;

    // 清除旧标记
    accessibleMarkersRef.current.forEach(m => { try { map.remove(m); } catch { /* ignore */ } });
    accessibleMarkersRef.current = [];

    if (!accessibleActive || !accessibleSelected || !accessibleSelected.route.path?.length || navActive) return;

    // 途经站点的无障碍设施 → 标记
    const stationNames = accessibleSelected.metrics.stationNames;
    stationNames.forEach(name => {
      const facility = getFacilityForStation(name);
      if (!facility) return;
      const best = facility.entrances.slice().sort((a, b) =>
        Number(b.wheelchairAccessible && b.elevator) - Number(a.wheelchairAccessible && a.elevator) ||
        Number(b.wheelchairAccessible) - Number(a.wheelchairAccessible) ||
        Number(b.ramp) - Number(a.ramp),
      )[0];
      const isObstacle = best?.stairsOnly || best?.status === 'obstacle';
      const hasElevator = best?.elevator;
      const emoji = isObstacle ? '⚠️' : hasElevator ? '🛗' : '♿';
      const color = isObstacle ? '#f5222d' : hasElevator ? '#13c2c2' : '#722ed1';
      const marker = new AMap.Marker({
        position: [facility.lng, facility.lat],
        content: `<div style="width:30px;height:30px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:15px;">${emoji}</div>`,
        offset: new AMap.Pixel(-15, -15),
        title: `${facility.stationName} · ${best?.name || ''}${best?.elevator ? ' 电梯' : ''}${best?.status === 'verified' ? ' · 已确认' : best?.status === 'unknown' ? ' · 待确认' : ' · 存在障碍'}`,
      });
      marker.on('click', () => {
        new AMap.InfoWindow({
          content: `<div style="padding:10px 12px;font-size:13px;min-width:180px"><b>♿ ${facility.stationName}</b><br/>${facility.entrances.map(e => `${e.name} ${e.elevator ? '🛗' : ''}${e.ramp ? '↗️' : ''}${e.stairsOnly ? '⚠️楼梯' : '♿'} ${e.status === 'verified' ? '🟢已确认' : e.status === 'unknown' ? '🟡待确认' : '🔴存在障碍'}`).join('<br/>')}</div>`,
          offset: new AMap.Pixel(0, -30),
        }).open(map, [facility.lng, facility.lat]);
      });
      map.add(marker);
      accessibleMarkersRef.current.push(marker);
    });
  }, [accessibleActive, accessibleSelected, accessibleSelectedId, mapReady, navActive]);

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
    const modeIcon = accessibleActive ? '♿' : MODE_META[navMode].icon;
    const markerColor = accessibleActive ? '#722ed1' : MODE_META[navMode].color;
    const carMarker = new AMap.Marker({
      position: resolvedStart, anchor: 'center',
      icon: new AMap.Icon({
        image: 'data:image/svg+xml,' + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="20" fill="${markerColor}" stroke="#fff" stroke-width="3"/><text x="22" y="29" text-anchor="middle" fill="#fff" font-size="20">${modeIcon}</text></svg>`
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

  // ===== 开始导航：先校验路线有效性（最终一道防线），再置状态机 + 登录用户创建 Trip =====
  const startNavigation = (mode: TravelMode) => {
    // 路线数据必须与请求模式匹配：transit 绝不能用 driving path 冒充
    const route = routeResults[mode];
    if (!route) {
      setNavRouteError('路线数据无效，请返回重新规划');
      return;
    }
    if (route.mode !== mode) {
      setNavRouteError('路线数据无效，请返回重新规划');
      return;
    }
    if (mode === 'bus') {
      const hasValidSegment = (route.segments || []).some(s => s.type === 'bus' || s.type === 'metro' || s.type === 'walk');
      if (!hasValidSegment) {
        setNavRouteError('当前公交路线数据无效，请重新规划。');
        return;
      }
    }
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
    if (map) {
      accessibleMarkersRef.current.forEach(m => { try { map.remove(m); } catch { /* ignore */ } });
    }
    accessibleMarkersRef.current = [];
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
      if (navMode) useTravelPlanStore.getState().setMode(fromLegacyRouteMode(navMode));
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

  // ===== 无障碍出行：默认选中「无障碍推荐」方案，写入地图/导航数据 =====
  useEffect(() => {
    // 无障碍模式 + 有候选 + 尚未选中时：默认选「无障碍推荐」，并把该方案写入 routeResults.bus 供地图/导航使用
    if (!accessibleActive || !accessibleOptions.length || accessibleSelectedId) return;
    const first = accessibleOptions[0];
    if (!first) return;
    setAccessibleSelectedId(first.id);
    setRouteResults(prev => prev?.bus ? prev : { ...prev, bus: first.route });
  }, [accessibleActive, accessibleOptions, accessibleSelectedId]);

  // 无障碍模式：切换候选方案时同步更新地图路线（复用 routeResults.bus）
  const selectAccessibleOption = (option: AccessibleRouteOption) => {
    setAccessibleSelectedId(option.id);
    setRouteResults(prev => ({ ...prev, bus: option.route }));
  };

  // ===== 无障碍模式开始导航（复用现有 bus 导航逻辑，仅改文案/设施提示） =====
  const startAccessibleNavigation = (option: AccessibleRouteOption) => {
    // 硬性规则兜底：仅楼梯 → 不建议开始无障碍导航
    if (option.metrics.stairsRiskCount > 0 && option.score.level === 'not_recommended') {
      setNavRouteError('当前方案存在仅楼梯出入口，不建议轮椅用户选择，请更换方案。');
      return;
    }
    setSelectedMode('bus');
    setRouteResults(prev => ({ ...prev, bus: option.route }));
    setNavMode('bus');
    navStatusRef.current = 'navigating';
    setNavStatus('navigating');
    setNavActive(true);
    hasCompletedTripRef.current = false;
    setArrivedTrip(null);
    if (isLoggedIn) {
      const s = startCoord.current, e = endCoord.current;
      if (s && e) {
        const clientSessionId = typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `nav_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        void useTripStore.getState().startTrip({
          clientSessionId,
          mode: 'bus',
          profile: 'accessible',
          origin: { name: displayOrigin, address: displayOrigin, lng: s[0], lat: s[1] },
          destination: { name: displayDest, address: displayDest, lng: e[0], lat: e[1] },
          routeSnapshot: {
            estimatedDistance: option.route.distance,
            estimatedDuration: option.route.duration,
            routeProvider: 'amap',
            path: option.route.path,
          },
          dataSource: 'demo',
        }).catch(() => undefined);
      }
    }
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
          <div>{accessibleActive ? '♿ 正在规划无障碍路线...' : `${MODE_META[selectedMode].icon} 正在规划${MODE_META[selectedMode].label}路线...`}</div>
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
              {navMode ? (accessibleActive ? '♿ 无障碍出行' : `${MODE_META[navMode].icon} ${MODE_META[navMode].label}`) : ''}
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
        <div style={{ padding: 10, background: '#fff7e6', color: '#ad6800', borderRadius: 8, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>⚠️ {unavailableNote}</span>
          {selectedMode === 'bus' && (
            <button onClick={() => selectTravelMode('driving')} style={{ marginLeft: 'auto', padding: '6px 14px', border: 'none', borderRadius: 6, background: '#1677ff', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
              切换驾车
            </button>
          )}
        </div>
      )}

      <div className={styles.optionScroll}>
        {accessibleActive ? (
          /* ===== 无障碍出行：多候选方案卡片 ===== */
          isPlanning ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-hint)' }}>♿ 正在规划无障碍路线...</div>
          ) : accessibleOptions.length === 0 ? (
            <div>
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-hint)' }}>
                {mapError ? `⚠️ ${mapError}` : '♿ 暂未找到完整无障碍路线'}
              </div>
              {!mapError && (
                <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-hint)', paddingBottom: 16 }}>
                  当前候选路线均存在无障碍设施信息缺失或长距离移动路段
                </div>
              )}
            </div>
          ) : (
            accessibleOptions.map(option => (
              <AccessibleRouteCard
                key={option.id}
                option={option}
                active={accessibleSelectedId === option.id}
                onSelect={() => selectAccessibleOption(option)}
                onStart={() => startAccessibleNavigation(option)}
              />
            ))
          )
        ) : displayedModes.length === 0 ? (
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
      {!navActive && !isPlanning && accessibleActive && accessibleOptions.length > 0 ? (
        /* ===== 无障碍智能推荐 ===== */
        <div className={styles.forecastSection} style={{ background: '#f9f0ff', border: '1px solid #efdbff' }}>
          <div className={styles.forecastTitle}>
            🧠 无障碍智能推荐
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-hint)' }}>无障碍优化</span>
          </div>
          <div className={styles.forecastReason}>
            ♿ 推荐方案：<b>无障碍出行</b>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
              {(() => {
                const recommended = accessibleOptions[0];
                const fastest = accessibleOptions.find(o => o.id === 'fastest') || null;
                if (!recommended) return '当前候选方案信息待确认。';
                let text = `当前方案轮椅/步行移动约${Math.round(recommended.walkingDistance)}m，换乘 ${recommended.transferCount} 次。`;
                if (fastest && fastest !== recommended) {
                  const savedWalk = Math.max(0, fastest.walkingDistance - recommended.walkingDistance);
                  const savedTransfer = Math.max(0, fastest.transferCount - recommended.transferCount);
                  if (savedWalk > 0 || savedTransfer > 0) {
                    text += `相比最短时间方案，减少${Math.round(savedWalk)}m 移动距离${savedTransfer > 0 ? `、${savedTransfer} 次换乘` : ''}。`;
                  }
                }
                if (recommended.metrics.elevatorCoverage > 0) text += ' 🛗 途经站点优先选择设有电梯的出入口。';
                if (recommended.metrics.unknownFacilityCount > 0) text += ' ⚠ 部分设施状态暂无实时信息，建议出发前确认。';
                return text;
              })()}
            </div>
          </div>
          <div className={styles.departAdvice} style={{ marginTop: 8, fontSize: 13, color: '#722ed1' }}>
            ♿ 无障碍优化 · 设施数据{getFacilitySource() === 'backend' ? '来自后台维护' : '为演示数据（未接入官方实时）'}
          </div>
        </div>
      ) : !navActive && !isPlanning && availableModes.length > 0 && recommendationId ? (
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
      ) : null}

      {/* ===== 未来拥堵预测面板（无障碍模式不展示拥堵预测，优先展示无障碍信息） ===== */}
      {!navActive && !isPlanning && !accessibleActive && availableModes.length > 0 && (
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

function makeMarkerIcon(AMap: any, color: string, text: string, size: number) {
  return new AMap.Icon({
    image: 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="${color}" stroke="#fff" stroke-width="2"/><text x="${size / 2}" y="${size / 2 + 5}" text-anchor="middle" fill="#fff" font-size="${size * 0.4}" font-weight="bold">${text}</text></svg>`
    ),
    size: new AMap.Size(size, size),
  });
}

export default RouteResultPage;
