// ===== 智途云枢 · 公交实时位置服务 =====
// 演示模式：使用高德 Driving 规划真实道路路径（不直连站点）。
// 未来接入真实北京公交数据时，替换为后端 API。

import { MOCK_BUS_LINES, MOCK_BUS_STATION_COORDS } from '../mocks/data';

export type BusDirection = 'outbound' | 'inbound';

export interface BusRouteStation {
  name: string;
  location: [number, number];
}

export interface BusRouteGeometry {
  lineId: string;
  lineName: string;
  stations: BusRouteStation[];
  path: [number, number][];       // 真实道路路径（≠站点直线连接）
}

export interface BusVehicle {
  vehicleId: string;
  progress: number;
  lng: number;
  lat: number;
  speed: number;
  heading?: number;
  currentStation: string;
  nextStation: string;
  distanceToNextStation: number;
  eta: number;
  isDemo: true;
  updatedAt: number;
}

const DEMO_VEHICLE_CONFIG = [
  { id: 'DEMO001', progress: 0.18, speedBase: 28 },
  { id: 'DEMO002', progress: 0.52, speedBase: 24 },
  { id: 'DEMO003', progress: 0.78, speedBase: 31 },
];

// 缓存高德规划的真实道路路径（避免重复请求 Driving API）
const drivingCache = new Map<string, [number, number][]>();

/** 用高德 Driving 规划沿公交站点的真实道路路径 */
export async function fetchRealRoadPath(
  AMap: any,
  stations: BusRouteStation[],
  lineId: string,
  direction: BusDirection,
): Promise<[number, number][] | null> {
  const key = `${lineId}_${direction}`;
  const cached = drivingCache.get(key);
  if (cached) return cached;

  if (stations.length < 2) return null;

  return new Promise((resolve) => {
    AMap.plugin(['AMap.Driving'], () => {
      const driving = new AMap.Driving({ policy: (AMap as any).DrivingPolicy?.LEAST_TIME || 0 });
      const start = new AMap.LngLat(stations[0].location[0], stations[0].location[1]);
      const end = new AMap.LngLat(stations[stations.length - 1].location[0], stations[stations.length - 1].location[1]);

      // 带途经点规划（中间站作为 waypoints）
      const waypoints: any[] = [];
      for (let i = 1; i < stations.length - 1; i++) {
        waypoints.push(new AMap.LngLat(stations[i].location[0], stations[i].location[1]));
      }

      driving.search(start, end, { waypoints, waypointPolicy: 0 }, (status: string, result: any) => {
        if (status === 'complete' && result.routes?.length) {
          const path: [number, number][] = result.routes[0].steps.flatMap((s: any) =>
            (s.path || []).map((p: any) => [Number(p.lng || p[0]), Number(p.lat || p[1])] as [number, number])
          );
          if (path.length >= 2) {
            drivingCache.set(key, path);
            console.log(`[busPath] ${lineId} ${direction} 真实道路 ${path.length} 点`);
            resolve(path);
            return;
          }
        }
        console.warn(`[busPath] ${lineId} ${direction} 高德Driving不可用`);
        resolve(null);
      });
    });
  });
}

/** 站点直线插值（兜底：Driving 不可用时使用） */
function interpolatePath(points: [number, number][], perSegment = 8): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    for (let k = 0; k < perSegment; k++) {
      const t = k / perSegment;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** 获取线路站点几何（不含 path——path 由 Driving 异步获取） */
export function getBusRouteGeometry(lineId: string, direction: BusDirection = 'outbound'): BusRouteGeometry | null {
  const line = MOCK_BUS_LINES.find(b => b.id === lineId);
  if (!line) return null;

  let orderedStops = [...line.stops];
  if (direction === 'inbound') orderedStops = orderedStops.reverse();

  const stations: BusRouteStation[] = orderedStops
    .map(name => ({ name, location: MOCK_BUS_STATION_COORDS[name] }))
    .filter((s): s is BusRouteStation => !!s.location);

  if (stations.length < 2) return null;

  // 兜底 path：站点间直线插值（真实道路由 BusDetailPage 异步获取后覆盖）
  const rawPoints = stations.map(s => s.location);
  return {
    lineId: line.id,
    lineName: line.name,
    stations,
    path: interpolatePath(rawPoints),
  };
}

/** 根据 path 和 progress 计算位置：仅在 path 上插值，不自己生成经纬度 */
export function pointAtPath(path: [number, number][], progress: number): [number, number] {
  const clamped = Math.max(0, Math.min(1, progress));
  const total = path.length - 1;
  const index = clamped * total;
  const i = Math.floor(index);
  const t = index - i;
  const a = path[i], b = path[Math.min(i + 1, path.length - 1)];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** 生成演示车辆：位置严格从 path 计算 */
export function generateVehicles(path: [number, number][], stations: BusRouteStation[]): BusVehicle[] {
  return DEMO_VEHICLE_CONFIG.map(cfg => {
    const progress = (cfg.progress + (Math.random() - 0.5) * 0.03 + 1) % 1;
    const pos = pointAtPath(path, progress);

    const totalLen = stations.length;
    const progressIdx = progress * (totalLen - 1);
    const nextIdx = Math.min(totalLen - 1, Math.max(1, Math.ceil(progressIdx)));
    const currentStation = stations[Math.max(0, nextIdx - 1)].name;
    const nextStation = stations[nextIdx].name;
    const nextLoc = stations[nextIdx].location;
    const dist = Math.round(distanceMeters(pos, nextLoc));
    const speed = cfg.speedBase + Math.sin(Date.now() / 3000 + cfg.progress * 10) * 4;
    const speedMs = speed / 3.6;
    const eta = Math.max(15, Math.round(dist / speedMs));

    return {
      vehicleId: cfg.id,
      progress,
      lng: pos[0], lat: pos[1],
      speed: Math.round(speed * 10) / 10,
      currentStation, nextStation,
      distanceToNextStation: dist, eta,
      isDemo: true, updatedAt: Date.now(),
    };
  });
}

/** 平面距离 */
function distanceMeters(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * 111000;
  const dLng = (b[0] - a[0]) * 111000 * Math.cos((a[1] * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// 导出旧接口兼容：getBusVehicles 仍然可用（使用直线兜底 path）
export { MOCK_BUS_LINES, MOCK_BUS_STATION_COORDS };
export function getBusVehicles(lineId: string, direction: BusDirection = 'outbound'): BusVehicle[] {
  const geometry = getBusRouteGeometry(lineId, direction);
  if (!geometry) return [];
  return generateVehicles(geometry.path, geometry.stations);
}
