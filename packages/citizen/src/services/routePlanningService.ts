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

function extractRoutePath(route: any): [number, number][] {
  if (Array.isArray(route?.path) && route.path.length) return route.path;
  if (Array.isArray(route?.polyline) && route.polyline.length) return route.polyline;
  const steps = Array.isArray(route?.steps)
    ? route.steps
    : route?.steps && typeof route.steps === 'object'
      ? Object.values(route.steps)
      : [];
  return steps.flatMap((step: any) => step?.path || step?.polyline || []);
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
    // 距离硬门槛：起终点直线距离过远 → 跨城/长途，城市公交不支持（不依赖高德返回结构）
    if (haversineKm(start, end) > CROSS_CITY_TRANSIT_KM) {
      return Promise.reject(new Error('CROSS_CITY_TRANSIT_UNSUPPORTED'));
    }
    return withTimeout(new Promise((resolve, reject) => {
      AMap.plugin(['AMap.Transfer'], () => {
        const transfer = new AMap.Transfer({ policy: AMap.TransferPolicy.LEAST_TIME, city: '北京', nightflag: false });
        transfer.search(startLngLat, endLngLat, (status: string, result: any) => {
          if (status !== 'complete' || !result.plans?.length) {
            reject(new Error(result.info || '公交路线规划失败'));
            return;
          }
          const plan = result.plans[0];
          const segments: SegmentData[] = [];
          const paths: [number, number][] = [];
          let hasRailway = false; // 铁路/城际/长途段标记：任何此类段都判定跨城/长途
          plan.segments.forEach((segment: any) => {
            if (segment.walking) {
              segments.push({ type: 'walk', instruction: `步行 ${formatDistance(segment.walking.distance || 0)}`, duration: segment.walking.duration });
              if (Array.isArray(segment.walking.path)) paths.push(...segment.walking.path);
              return;
            }
            if (segment.bus?.buslines?.length) {
              const line = segment.bus.buslines[0];
              const lineName = String(line.name || line.lineName || line.route || '').trim();
              if (isRailwayLike(line.type || line.lineType || segment.bus.type, lineName)) hasRailway = true;
              const item: SegmentData = {
                type: inferTransitType(line.type || line.lineType || segment.bus.type, lineName), lineName,
                fromStation: line.departure_stop?.name || line.departureStop?.name || line.startStation?.name || '',
                toStation: line.arrival_stop?.name || line.arrivalStop?.name || line.endStation?.name || '',
                stationCount: line.station_count || line.stationCount, duration: segment.bus.duration || line.duration,
              };
              if (hasSegmentContent(item)) segments.push(item);
              if (Array.isArray(line.path)) paths.push(...line.path);
              else if (Array.isArray(segment.bus.path)) paths.push(...segment.bus.path);
              return;
            }
            if (segment.railway) {
              // 铁路段 = 跨城/长途，当前不支持城市公交联程，直接标记（不再转成 metro 冒充地铁）
              hasRailway = true;
              return;
            }
            if (segment.transit) {
              const transit = segment.transit;
              const lineName = String(transit.name || transit.line || transit.route || transit.transitName || '').trim();
              if (isRailwayLike(transit.type || transit.transitType, lineName)) hasRailway = true;
              const item: SegmentData = {
                type: inferTransitType(transit.type || transit.transitType, lineName), lineName,
                fromStation: (transit.departureStop || transit.startStation || transit.onStation)?.name || '',
                toStation: (transit.arrivalStop || transit.endStation || transit.offStation)?.name || '',
                stationCount: transit.stationCount, duration: transit.duration,
              };
              if (hasSegmentContent(item)) segments.push(item);
              if (Array.isArray(transit.path)) paths.push(...transit.path);
            }
          });
          if (!paths.length) { reject(new Error('公交路线无路径数据')); return; }
          // ===== 公交段类型校验：只接受真实城市公共交通 =====
          // 1) 含铁路/高铁/城际/动车/长途段 → 判定为跨城或长途，当前不支持
          if (hasRailway) {
            reject(new Error('CROSS_CITY_TRANSIT_UNSUPPORTED'));
            return;
          }
          // 2) 必须至少包含一个公交/地铁/步行段；纯驾车/直线/通用 path 不算公交方案
          const hasValidSegment = segments.some(s => s.type === 'bus' || s.type === 'metro' || s.type === 'walk');
          if (!hasValidSegment) {
            reject(new Error('transit-no-valid-segment'));
            return;
          }
          resolve({ mode, distance: plan.distance || 9200, duration: plan.time, path: paths, polyline: paths, segments, cost: plan.cost || 5 });
        });
      });
    }), 'Transit route');
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
