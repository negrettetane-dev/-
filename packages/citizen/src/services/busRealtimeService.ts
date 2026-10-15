// ===== 智途云枢 · 公交线路 geometry / 演示车辆工具 =====

export type BusDirection = 'outbound' | 'inbound';

export interface BusRouteStation {
  name: string;
  location: [number, number];
}

export interface BusRouteGeometry {
  lineId: string;
  lineName: string;
  stations: BusRouteStation[];
  path: [number, number][];
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

export interface BusLineCandidate {
  name?: string;
  path?: unknown;
  via_stops?: Array<{ name?: string; location?: unknown }>;
  start_stop?: string | { name?: string };
  end_stop?: string | { name?: string };
}

export interface LineSearchMatch {
  path: [number, number][];
  stations: BusRouteStation[];
  candidate: BusLineCandidate;
  candidateCount: number;
  score: number;
  query: string;
}

// 10 分意味着至少需要“线路身份 + 两端点”或足够多的同向站序证据。
const MIN_MATCH_SCORE = 10;

export function normalizePath(input: unknown): [number, number][] {
  if (!Array.isArray(input)) return [];
  return input.map((point: any): [number, number] | null => {
    if (Array.isArray(point)) {
      const lng = Number(point[0]);
      const lat = Number(point[1]);
      return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
    }
    if (!point || typeof point !== 'object') return null;
    const lng = Number(point.lng ?? point.longitude ?? point.getLng?.() ?? point.location?.lng);
    const lat = Number(point.lat ?? point.latitude ?? point.getLat?.() ?? point.location?.lat);
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  }).filter((point): point is [number, number] => point !== null);
}

function normalizeStopName(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[（）()\s·]/g, '')
    .replace(/公交枢纽站?|公交场站|枢纽站|总站|车站|站$/g, '');
}

function namesMatch(a: unknown, b: unknown): boolean {
  const left = normalizeStopName(a);
  const right = normalizeStopName(b);
  return !!left && !!right && (left === right || left.includes(right) || right.includes(left));
}

function lineNumbersMatch(a: unknown, b: unknown): boolean {
  const left = String(a || '').match(/\d+/)?.[0];
  const right = String(b || '').match(/\d+/)?.[0];
  return !!left && left === right;
}

function routeLabel(value: unknown): string {
  return String(value || '').split(/[（(]/, 1)[0].replace(/\s/g, '');
}

function routeFamily(value: unknown): string {
  return routeLabel(value).replace(/^(\d+)路快(?:车)?[内外]?$/, '$1快');
}

function stopName(value: BusLineCandidate['start_stop']): string {
  return typeof value === 'string' ? value : value?.name || '';
}

function candidateStopNames(candidate: BusLineCandidate): string[] {
  return (candidate.via_stops || []).map(stop => stop.name || '').filter(Boolean);
}

/** 按线路名、方向端点、站数和站点顺序评分；不会默认取第一条。 */
export function scoreLineCandidate(
  candidate: BusLineCandidate,
  expectedLineName: string,
  expectedStops: string[],
): number {
  const viaNames = candidateStopNames(candidate);
  const expectedStart = expectedStops[0] || '';
  const expectedEnd = expectedStops[expectedStops.length - 1] || '';
  const candidateStart = stopName(candidate.start_stop) || viaNames[0] || '';
  const candidateEnd = stopName(candidate.end_stop) || viaNames[viaNames.length - 1] || '';
  let score = 0;

  if (routeFamily(candidate.name) === routeFamily(expectedLineName)) score += 3;
  else if (lineNumbersMatch(candidate.name, expectedLineName)) score += 1;
  if (namesMatch(candidateStart, expectedStart)) score += 4;
  if (namesMatch(candidateEnd, expectedEnd)) score += 4;
  if (viaNames.length && Math.abs(viaNames.length - expectedStops.length) <= Math.max(2, expectedStops.length * 0.25)) score += 1;

  for (const expected of expectedStops) {
    if (viaNames.some(actual => namesMatch(actual, expected))) score += 1;
  }

  // 对环线/同端点线路尤其重要：相同站点必须按当前页面方向依次出现。
  let cursor = -1;
  let orderedMatches = 0;
  for (const expected of expectedStops) {
    const next = viaNames.findIndex((actual, index) => index > cursor && namesMatch(actual, expected));
    if (next >= 0) {
      cursor = next;
      orderedMatches += 1;
    }
  }
  if (orderedMatches >= Math.min(3, expectedStops.length)) score += Math.min(3, orderedMatches);
  return score;
}

export function selectBestLineCandidate(
  candidates: BusLineCandidate[],
  expectedLineName: string,
  expectedStops: string[],
): { candidate: BusLineCandidate; score: number } | null {
  const ranked = candidates
    .map(candidate => ({ candidate, score: scoreLineCandidate(candidate, expectedLineName, expectedStops) }))
    .filter(item => normalizePath(item.candidate.path).length >= 2)
    .sort((a, b) => b.score - a.score);
  return ranked[0] && ranked[0].score >= MIN_MATCH_SCORE ? ranked[0] : null;
}

function searchOnce(lineSearch: any, query: string): Promise<BusLineCandidate[]> {
  return new Promise(resolve => {
    lineSearch.search(query, (status: string, result: any) => {
      resolve(status === 'complete' && Array.isArray(result?.lineInfo) ? result.lineInfo : []);
    });
  });
}

function lineQueries(lineName: string): string[] {
  const trimmed = lineName.trim();
  const withoutSuffix = trimmed.replace(/路$/, '');
  const fastNumber = trimmed.match(/^(\d+)(?:路)?快(?:车)?$/)?.[1];
  return [...new Set([
    trimmed,
    withoutSuffix,
    `${withoutSuffix}路`,
    fastNumber ? `${fastNumber}路快车` : '',
    fastNumber ? `${fastNumber}路` : '',
  ].filter(Boolean))];
}

function candidateIdentity(candidate: BusLineCandidate): string {
  const path = normalizePath(candidate.path);
  return [
    candidate.name || '', stopName(candidate.start_stop), stopName(candidate.end_stop), path.length,
    path[0]?.join(',') || '', path[path.length - 1]?.join(',') || '',
  ].join('|');
}

export async function searchBusLineGeometry(
  AMap: any,
  options: { city: string; lineId: string; lineName: string; direction: BusDirection; stationNames: string[] },
): Promise<LineSearchMatch | null> {
  const cacheKey = `bus-path:v4:${options.city}:${options.lineId}:${options.direction}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as LineSearchMatch;
      if (normalizePath(parsed.path).length >= 2) return parsed;
    }
  } catch { /* sessionStorage 不可用时继续查询 */ }

  await new Promise<void>((resolve, reject) => {
    AMap.plugin(['AMap.LineSearch'], () => AMap.LineSearch ? resolve() : reject(new Error('AMap.LineSearch 加载失败')));
  });
  const lineSearch = new AMap.LineSearch({
    city: options.city,
    pageIndex: 1,
    pageSize: 20,
    extensions: 'all',
  });

  const candidateMap = new Map<string, BusLineCandidate>();
  let selectedQuery = '';
  for (const query of lineQueries(options.lineName)) {
    const found = await searchOnce(lineSearch, query);
    found.forEach(candidate => candidateMap.set(candidateIdentity(candidate), candidate));
    if (!selectedQuery && selectBestLineCandidate(found, options.lineName, options.stationNames)) selectedQuery = query;
  }
  const allCandidates = [...candidateMap.values()];
  const selected = selectBestLineCandidate(allCandidates, options.lineName, options.stationNames);
  if (!selected) {
    const topScores = allCandidates
      .map(candidate => ({
        name: candidate.name,
        start: stopName(candidate.start_stop) || candidateStopNames(candidate)[0],
        end: stopName(candidate.end_stop) || candidateStopNames(candidate).slice(-1)[0],
        score: scoreLineCandidate(candidate, options.lineName, options.stationNames),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    console.warn(`[bus-line-search] ${options.lineName} ${options.direction}: ${allCandidates.length} candidates, no safe match; top=${JSON.stringify(topScores)}`);
    return null;
  }

  const path = normalizePath(selected.candidate.path);
  const stations = (selected.candidate.via_stops || []).map(stop => ({
    name: stop.name || '',
    location: normalizePath([stop.location])[0],
  })).filter((station): station is BusRouteStation => !!station.name && !!station.location);
  const match: LineSearchMatch = {
    path,
    stations,
    candidate: selected.candidate,
    candidateCount: allCandidates.length,
    score: selected.score,
    query: selectedQuery || lineQueries(options.lineName)[0],
  };
  try { sessionStorage.setItem(cacheKey, JSON.stringify(match)); } catch { /* ignore */ }
  console.info(`[bus-line-search] ${options.lineName} ${options.direction}: selected score=${match.score}, candidates=${match.candidateCount}, query=${match.query}, line=${selected.candidate.name || ''}, start=${stopName(selected.candidate.start_stop)}, end=${stopName(selected.candidate.end_stop)}`);
  return match;
}

/** 按折线累计长度计算车辆位置，避免密集 path 点导致速度不均。 */
export function pointAtPath(path: [number, number][], progress: number): [number, number] {
  if (path.length < 2) return path[0] || [0, 0];
  const clamped = Math.max(0, Math.min(1, progress));
  const lengths = path.slice(1).map((point, index) => distanceMeters(path[index], point));
  const target = lengths.reduce((sum, length) => sum + length, 0) * clamped;
  let passed = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    if (passed + lengths[index] >= target) {
      const ratio = lengths[index] ? (target - passed) / lengths[index] : 0;
      return [
        path[index][0] + (path[index + 1][0] - path[index][0]) * ratio,
        path[index][1] + (path[index + 1][1] - path[index][1]) * ratio,
      ];
    }
    passed += lengths[index];
  }
  return path[path.length - 1];
}

/** 将后端演示坐标吸附到最近的公交 path 点，并返回该点的进度。 */
export function snapToPath(path: [number, number][], position: [number, number]): { point: [number, number]; progress: number } {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  path.forEach((point, index) => {
    const distance = distanceMeters(point, position);
    if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
  });
  return { point: path[bestIndex], progress: path.length > 1 ? bestIndex / (path.length - 1) : 0 };
}

export function distanceMeters(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * 111000;
  const dLng = (b[0] - a[0]) * 111000 * Math.cos((a[1] * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
