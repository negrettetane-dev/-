import { formatDistance } from '@zhitu/shared';
import { loadAMap } from '../lib/amap';
import { geocodeLocation, isValidCoord } from './locationService';
import type { RouteTravelMode } from '../components/travel/TravelModeSelector';

export interface SegmentData {
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

export interface PlannedRoute {
  mode: RouteTravelMode;
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

export interface TransitCandidate {
  plan: any;
  route: PlannedRoute;
  segments: SegmentData[];
  walkingDistance: number;
  transferCount: number;
}

export interface ParsedTransitPlan {
  segments: SegmentData[];
  path: [number, number][];
  walkingDistance: number;
  transferCount: number;
  /** 含铁路/城际段（跨城/长途）：不能把铁路当城市公交，整体判为不可用方案 */
  hasRailway: boolean;
}

const ROUTE_TIMEOUT_MS = 15000;

const KNOWN_COORDS: Record<string, [number, number]> = {
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
};

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timeout`)), ROUTE_TIMEOUT_MS);
    promise.then(
      value => { window.clearTimeout(timer); resolve(value); },
      error => { window.clearTimeout(timer); reject(error); },
    );
  });
}

export function hasSegmentContent(segment: SegmentData): boolean {
  return Boolean(
    segment.lineName?.trim() || segment.instruction?.trim() ||
    segment.fromStation?.trim() || segment.toStation?.trim() ||
    segment.fromStop?.trim() || segment.toStop?.trim()
  );
}

function inferTransitType(value: unknown, name = ''): 'bus' | 'metro' {
  const raw = `${String(value ?? '')} ${name}`.toLowerCase();
  return ['subway', 'metro', 'railway', 'rail', 'tram', 'train', '地铁', '轻轨', '有轨'].some(key => raw.includes(key))
    ? 'metro'
    : 'bus';
}

/** 判断是否为铁路/城际/长途段：跨城市公交/地铁当前不支持，任何此类段都判定无效 */
function isRailwayLike(value: unknown, name = ''): boolean {
  const raw = `${String(value ?? '')} ${name}`.toLowerCase();
  return /高铁|城际|动车|火车|铁路|railway|intercity|train|高速铁路/.test(raw);
}

/** 跨城公交距离硬门槛（km）：城市公交只支持同城短途 */
const CROSS_CITY_TRANSIT_KM = 100;

/** 两坐标直线距离（km），Haversine 公式 */
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ===== 坐标归一化：兼容 [lng,lat] / AMap.LngLat / {lng,lat} / {longitude,latitude} =====

function toLngLatTuple(point: any): [number, number] | null {
  if (!point) return null;
  // [lng, lat]
  if (Array.isArray(point) && point.length >= 2) {
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }
  // AMap.LngLat（getLng/getLat）
  if (typeof point.getLng === 'function' && typeof point.getLat === 'function') {
    const lng = Number(point.getLng());
    const lat = Number(point.getLat());
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }
  // { lng, lat }
  const lng = Number(point.lng ?? point.longitude ?? point.location?.lng);
  const lat = Number(point.lat ?? point.latitude ?? point.location?.lat);
  if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  return null;
}

export function normalizePath(rawPath: any): [number, number][] {
  if (!Array.isArray(rawPath)) return [];
  return rawPath
    .map(toLngLatTuple)
    .filter((point): point is [number, number] => point !== null);
}

/**
 * 从高德单条路线对象提取路径。
 * 兼容结构（按优先级）：
 *   route.path / route.polyline
 *   route.steps[].path|polyline        —— 驾车 / 步行
 *   route.rides[].path|polyline        —— 骑行（AMap.Riding）
 */
function extractRoutePath(route: any): [number, number][] {
  const direct = normalizePath(route?.path);
  if (direct.length) return direct;
  const directPolyline = normalizePath(route?.polyline);
  if (directPolyline.length) return directPolyline;

  const steps = Array.isArray(route?.steps)
    ? route.steps
    : route?.steps && typeof route.steps === 'object'
      ? Object.values(route.steps)
      : [];
  const stepPath: [number, number][] = [];
  steps.forEach((step: any) => {
    stepPath.push(...normalizePath(step?.path));
    stepPath.push(...normalizePath(step?.polyline));
  });
  if (stepPath.length) return stepPath;

  // 骑行：AMap.Riding 的 routes[0].rides[].path
  const rides = Array.isArray(route?.rides)
    ? route.rides
    : route?.rides && typeof route.rides === 'object'
      ? Object.values(route.rides)
      : [];
  const ridePath: [number, number][] = [];
  rides.forEach((ride: any) => {
    ridePath.push(...normalizePath(ride?.path));
    ridePath.push(...normalizePath(ride?.polyline));
  });
  return ridePath;
}

export async function resolveRouteLocations(
  origin: string,
  destination: string,
  originCoords?: { lng: number; lat: number } | null,
  destinationCoords?: { lng: number; lat: number } | null,
): Promise<{ start: [number, number]; end: [number, number]; originLabel: string; destinationLabel: string }> {
  const resolveOrigin = async () => {
    if (originCoords && isValidCoord(originCoords.lng, originCoords.lat)) {
      return { coord: [originCoords.lng, originCoords.lat] as [number, number], label: origin || '当前位置' };
    }
    const known = Object.entries(KNOWN_COORDS).find(([key]) => origin.includes(key) || key.includes(origin));
    if (known) return { coord: known[1], label: origin || known[0] };
    const result = await geocodeLocation(origin);
    return { coord: [result.lng, result.lat] as [number, number], label: result.address || origin };
  };
  const resolveDestination = async () => {
    // 设施「去这里」等场景已带完整坐标：直接使用，不再重新解析名称
    if (destinationCoords && isValidCoord(destinationCoords.lng, destinationCoords.lat)) {
      return { coord: [destinationCoords.lng, destinationCoords.lat] as [number, number], label: destination };
    }
    const known = Object.entries(KNOWN_COORDS).find(([key]) => destination.includes(key) || key.includes(destination));
    if (known) return { coord: known[1], label: destination || known[0] };
    const result = await geocodeLocation(destination);
    return { coord: [result.lng, result.lat] as [number, number], label: result.address || destination };
  };
  const [resolvedOrigin, resolvedDestination] = await Promise.all([resolveOrigin(), resolveDestination()]);
  return {
    start: resolvedOrigin.coord,
    end: resolvedDestination.coord,
    originLabel: resolvedOrigin.label,
    destinationLabel: resolvedDestination.label,
  };
}

// ===== 公交/地铁：TransferPlan 解析（唯一实现，结果页复用） =====

/**
 * 解析高德单个 TransferPlan 为段列表 + 路径 + 基础统计。
 * 兼容官方结构 segment.transit_mode + segment.transit（WalkDetails / TransitDetails.lines[]），
 * 同时兼容旧字段 segment.walking / segment.bus.buslines / segment.railway / segment.transit。
 * 路径优先使用 plan.path（高德返回的整条换乘方案完整路径）；无 plan.path 时才用分段路径兜底。
 */
export function parseTransitPlan(plan: any): ParsedTransitPlan {
  const segments: SegmentData[] = [];
  const planPath = normalizePath(plan?.path);
  const mergedSegmentPath: [number, number][] = [];
  let walkingDistance = 0;
  let hasRailway = false;

  const rawSegments = Array.isArray(plan?.segments) ? plan.segments : [];

  rawSegments.forEach((segment: any) => {
    const mode = String(segment?.transit_mode || segment?.transitMode || '').toUpperCase();
    const instruction = segment?.instruction;

    // --- 步行（WALK / segment.walking） ---
    if (mode === 'WALK' || segment?.walking) {
      const walk = segment?.walking || segment?.transit || {};
      const dist = Number(walk.distance ?? segment?.distance ?? 0) || 0;
      walkingDistance += dist;
      const text = typeof instruction === 'object' ? instruction.text : instruction;
      const item: SegmentData = {
        type: 'walk',
        instruction: text ? String(text) : `步行 ${formatDistance(dist)}`,
        duration: Number(walk.duration ?? segment?.time ?? segment?.duration ?? 0),
      };
      if (hasSegmentContent(item) || item.instruction) segments.push(item);
      mergedSegmentPath.push(...normalizePath(walk.path));
      (Array.isArray(walk.steps) ? walk.steps : []).forEach((step: any) => {
        mergedSegmentPath.push(...normalizePath(step?.path));
      });
      return;
    }

    // --- 公交 / 地铁（BUS / SUBWAY / METRO_RAIL / segment.bus / segment.transit） ---
    if (mode === 'BUS' || mode === 'SUBWAY' || mode === 'METRO_RAIL' || segment?.bus?.buslines?.length || segment?.transit) {
      const transit = segment?.transit || segment?.bus || {};
      const line = Array.isArray(transit.lines) && transit.lines.length
        ? transit.lines[0]
        : segment?.bus?.buslines?.length
          ? segment.bus.buslines[0]
          : transit;
      const lineName = String(line?.name || line?.lineName || line?.route || transit.name || transit.route || '').trim();
      const rawType = line?.type || line?.lineType || transit.type || transit.transit_type || transit.transitType;
      if (isRailwayLike(rawType, lineName)) hasRailway = true;
      const isMetro = mode === 'SUBWAY' || mode === 'METRO_RAIL' || inferTransitType(rawType, lineName) === 'metro';
      const item: SegmentData = {
        type: isMetro ? 'metro' : 'bus',
        lineName,
        fromStation: line?.departure_stop?.name || line?.departureStop?.name || line?.startStation?.name || transit?.on_station?.name || transit?.onStation?.name || '',
        toStation: line?.arrival_stop?.name || line?.arrivalStop?.name || line?.endStation?.name || transit?.off_station?.name || transit?.offStation?.name || '',
        stationCount: line?.station_count ?? line?.stationCount ?? transit?.via_num ?? transit?.viaNum ?? 0,
        duration: Number(segment?.time ?? segment?.duration ?? transit?.time ?? transit?.duration ?? 0),
      };
      if (hasSegmentContent(item)) segments.push(item);
      const linePath = normalizePath(line?.path ?? line?.polyline ?? transit?.path ?? segment?.bus?.path);
      if (linePath.length) mergedSegmentPath.push(...linePath);
      (Array.isArray(transit.steps) ? transit.steps : []).forEach((step: any) => {
        mergedSegmentPath.push(...normalizePath(step?.path));
      });
      return;
    }

    // --- 铁路段：标记跨城/长途，当前不支持城市公交联程，不转成地铁 ---
    if (segment?.railway) {
      hasRailway = true;
      mergedSegmentPath.push(...normalizePath(segment.railway.path));
      return;
    }

    // --- 纯指令段兜底 ---
    if (instruction) {
      const text = typeof instruction === 'object' ? String(instruction.text || instruction.instruction || '') : String(instruction || '');
      if (text) {
        const type: SegmentData['type'] = text.includes('步行') ? 'walk' : 'bus';
        segments.push({ type, instruction: text, duration: 0 });
      }
    }
  });

  // 换乘次数 = 公交/地铁段数 - 1（至少 0）
  const transitSegments = segments.filter(s => s.type === 'bus' || s.type === 'metro');
  const transferCount = Math.max(0, transitSegments.length - 1);

  // 路径：优先 plan.path（整条方案），否则用分段合并路径
  const path = planPath.length ? planPath : mergedSegmentPath;

  return { segments, path, walkingDistance, transferCount, hasRailway };
}

/**
 * 公交/地铁规划：调用高德 Transfer，返回全部真实候选方案（供普通公交取第一个、无障碍取全部重排）。
 * 跨城/长途硬门槛（不依赖高德返回结构）：
 *   - 起终点直线距离 > 100km → 拒绝
 *   - 任一方案含铁路/城际段（hasRailway）→ 该方案判定不可用，跳过
 * 无任何有效方案时抛错，不返回空数组冒充成功。
 */
export async function planTransitCandidates(
  start: [number, number],
  end: [number, number],
): Promise<TransitCandidate[]> {
  if (haversineKm(start, end) > CROSS_CITY_TRANSIT_KM) {
    throw new Error('CROSS_CITY_TRANSIT_UNSUPPORTED');
  }
  const AMap = await withTimeout(loadAMap(), 'AMap load');
  const startLngLat = new AMap.LngLat(start[0], start[1]);
  const endLngLat = new AMap.LngLat(end[0], end[1]);

  const result = await withTimeout(new Promise<any>((resolve, reject) => {
    AMap.plugin(['AMap.Transfer'], () => {
      const transfer = new AMap.Transfer({ policy: AMap.TransferPolicy.LEAST_TIME, city: '北京', nightflag: false });
      transfer.search(startLngLat, endLngLat, (status: string, data: any) => {
        if (status !== 'complete' || !data?.plans?.length) {
          reject(new Error(data?.info || '公交路线规划失败'));
          return;
        }
        resolve(data);
      });
    });
  }), 'Transit route');

  const candidates: TransitCandidate[] = [];
  (result.plans as any[]).forEach((plan: any) => {
    const parsed = parseTransitPlan(plan);
    // 含铁路/城际段：该方案不可用（不把铁路当城市公交）
    if (parsed.hasRailway) return;
    if (parsed.path.length < 2) return;
    // 必须至少包含真实公交/地铁/步行段；纯驾车/直线/通用 path 不算公交方案
    const hasValidSegment = parsed.segments.some(s => s.type === 'bus' || s.type === 'metro' || s.type === 'walk');
    if (!hasValidSegment) return;
    candidates.push({
      plan,
      segments: parsed.segments,
      walkingDistance: parsed.walkingDistance,
      transferCount: parsed.transferCount,
      route: {
        mode: 'bus',
        distance: Number(plan.distance) || 9200,
        duration: Number(plan.time) || 0,
        path: parsed.path,
        polyline: parsed.path,
        segments: parsed.segments,
        cost: Number(plan.cost) || 5,
      },
    });
  });

  if (!candidates.length) throw new Error('transit-no-valid-segment');
  return candidates;
}

export async function planAmapRoute(
  mode: RouteTravelMode,
  start: [number, number],
  end: [number, number],
): Promise<PlannedRoute> {
  const AMap = await withTimeout(loadAMap(), 'AMap load');
  const startLngLat = new AMap.LngLat(start[0], start[1]);
  const endLngLat = new AMap.LngLat(end[0], end[1]);

  if (mode === 'drive') {
    return withTimeout(new Promise((resolve, reject) => {
      AMap.plugin(['AMap.Driving'], () => {
        const driving = new AMap.Driving({ policy: AMap.DrivingPolicy.LEAST_TIME });
        driving.search(startLngLat, endLngLat, (status: string, result: any) => {
          if (status === 'complete' && result.routes?.length) {
            const route = result.routes[0];
            const path = extractRoutePath(route);
            resolve({
              mode, distance: route.distance, duration: route.time, path, polyline: path,
              congestionSegments: [{ level: 'slow', ratio: 0.3 }, { level: 'free', ratio: 0.7 }],
              aiAdvice: '建议避开长安街东段，走三环辅路可节省约8分钟',
            });
          } else reject(new Error(result.info || '驾车路线规划失败'));
        });
      });
    }), 'Driving route');
  }

  if (mode === 'bus') {
    const candidates = await planTransitCandidates(start, end);
    return candidates[0].route;
  }

  const isBike = mode === 'bike';
  return withTimeout(new Promise((resolve, reject) => {
    const plugin = isBike ? 'AMap.Riding' : 'AMap.Walking';
    AMap.plugin([plugin], () => {
      const planner = isBike ? new AMap.Riding({}) : new AMap.Walking({});
      planner.search(startLngLat, endLngLat, (status: string, result: any) => {
        if (status === 'complete' && result.routes?.length) {
          const route = result.routes[0];
          const path = extractRoutePath(route);
          resolve({
            mode, distance: route.distance, duration: route.time, path, polyline: path,
            calories: Math.round(route.distance / 1000 * (isBike ? 30 : 45)),
          });
        } else reject(new Error(result.info || `${isBike ? '骑行' : '步行'}路线规划失败`));
      });
    });
  }), isBike ? 'Riding route' : 'Walking route');
}
