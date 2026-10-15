// ===== 智途云枢 · Mock API Handlers =====
// Intercept window.fetch to return mock data for /api/* calls

import {
  generateRoadSegments,
  generateHourlyMetrics,
  generateDistrictCongestion,
  generateIncidents,
  generateIntersections,
  generatePhases,
  generateDevices,
  SIMULATION_SCENARIOS,
  generateAiAlerts,
  generateRealTimeMetrics,
  MOCK_USERS,
  generateSystemLogs,
  MOCK_ACCESSIBILITY_STATIONS,
  generateAdminNotifications,
  INCIDENT_STATUS_LABELS,
  type MockStationFacility,
  type MockIncident,
  type IncidentProcessLog,
  type MockAdminNotification,
} from './mockData';

type Handler = (url: string, options?: RequestInit) => unknown;

// 内存中缓存事件（模拟后端持久化）：GET / PUT 共享同一份数据，保存状态后追加处理历史
let incidentCache: MockIncident[] | null = null;
const incidentExtraLogs = new Map<string, IncidentProcessLog[]>();

function getIncidentCache(): MockIncident[] {
  if (!incidentCache) incidentCache = generateIncidents();
  return incidentCache;
}

function getIncident(id: string | undefined): MockIncident | null {
  return getIncidentCache().find((i) => i.id === id) || null;
}

// 管理端通知：内存缓存 + 已读集合（模拟后端持久化）
let adminNotificationCache: MockAdminNotification[] | null = null;
const adminNotificationReadIds = new Set<string>();

function getAdminNotificationCache(): MockAdminNotification[] {
  if (!adminNotificationCache) adminNotificationCache = generateAdminNotifications();
  return adminNotificationCache;
}

function withReadState(list: MockAdminNotification[]): MockAdminNotification[] {
  return list.map((n) => ({ ...n, read: n.read || adminNotificationReadIds.has(n.id) }));
}

const API_HANDLERS: Record<string, Handler> = {
  // Dashboard
  'GET /api/dashboard/metrics': () => ({
    code: 0, data: generateRealTimeMetrics(), message: 'ok', timestamp: Date.now(),
  }),
  'GET /api/dashboard/hourly': () => ({
    code: 0, data: generateHourlyMetrics(), message: 'ok', timestamp: Date.now(),
  }),
  'GET /api/dashboard/districts': () => ({
    code: 0, data: generateDistrictCongestion(), message: 'ok', timestamp: Date.now(),
  }),
  'GET /api/dashboard/roads': () => ({
    code: 0, data: generateRoadSegments(), message: 'ok', timestamp: Date.now(),
  }),
  'GET /api/dashboard/ai-alerts': () => ({
    code: 0, data: generateAiAlerts(), message: 'ok', timestamp: Date.now(),
  }),

  // Incidents
  'GET /api/incidents': (url: string) => {
    const params = new URLSearchParams(url.split('?')[1] || '');
    const page = parseInt(params.get('page') || '1');
    const pageSize = parseInt(params.get('pageSize') || '10');
    const status = params.get('status');
    const severity = params.get('severity');
    let list = getIncidentCache();
    if (status) list = list.filter((i) => i.status === status);
    if (severity) list = list.filter((i) => i.severity === severity);
    return {
      code: 0,
      data: { list: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, pageSize },
      message: 'ok',
      timestamp: Date.now(),
    };
  },
  'GET /api/incidents/:id': (url: string) => {
    const id = url.match(/\/incidents\/([^/?]+)/)?.[1];
    const found = getIncident(id) || getIncidentCache()[0];
    const extra = incidentExtraLogs.get(found.id) || [];
    return {
      code: 0,
      data: { ...found, processLogs: [...found.processLogs, ...extra] },
      message: 'ok',
      timestamp: Date.now(),
    };
  },
  // 管理端保存事件状态 + 平台反馈（追加处理历史，同时通知市民端）
  'PUT /api/incidents/:id': (url: string, options?: RequestInit) => {
    const id = url.match(/\/incidents\/([^/?]+)/)?.[1];
    let body: { status?: string; platformFeedback?: string; notifyCitizen?: boolean } = {};
    try { body = options?.body ? JSON.parse(String(options.body)) : {}; } catch { /* ignore */ }
    const found = getIncident(id);
    if (found && body.status) {
      const fromStatus = found.status;
      found.status = body.status as MockIncident['status'];
      if (body.platformFeedback !== undefined) found.platformFeedback = body.platformFeedback;
      const logs = incidentExtraLogs.get(found.id) || [];
      logs.push({
        id: `pl-extra-${Date.now()}`,
        time: Date.now(),
        action: `状态变更为「${INCIDENT_STATUS_LABELS[found.status] || found.status}」`,
        operator: '管理员',
        fromStatus,
        toStatus: found.status,
        detail: body.platformFeedback || '',
      });
      incidentExtraLogs.set(found.id, logs);
    }
    return {
      code: 0,
      data: {
        id: id || 'unknown',
        status: body.status ?? found?.status ?? 'pending',
        platformFeedback: body.platformFeedback ?? found?.platformFeedback ?? '',
        notifyCitizen: body.notifyCitizen !== false,
        notifiedAt: Date.now(),
      },
      message: '状态与平台反馈已保存，并已通知市民端',
      timestamp: Date.now(),
    };
  },

  // Intersections / Signals
  'GET /api/signals': () => ({
    code: 0, data: generateIntersections(), message: 'ok', timestamp: Date.now(),
  }),
  'GET /api/signals/:id': (url: string) => {
    const id = url.match(/\/signals\/([^/?]+)/)?.[1];
    const intersections = generateIntersections();
    const found = intersections.find((i) => i.id === id) || intersections[0];
    const phases = generatePhases(found.id, found.phaseCount);
    return { code: 0, data: { ...found, phases }, message: 'ok', timestamp: Date.now() };
  },
  'PUT /api/signals/:id': () => ({
    code: 0, data: { success: true }, message: '信号配时已更新', timestamp: Date.now(),
  }),

  // Simulation
  'GET /api/simulation/scenarios': () => ({
    code: 0, data: SIMULATION_SCENARIOS, message: 'ok', timestamp: Date.now(),
  }),
  'POST /api/simulation/start': () => ({
    code: 0, data: { success: true, sessionId: `sim-session-${Date.now()}` }, message: '仿真已启动', timestamp: Date.now(),
  }),
  'POST /api/simulation/stop': () => ({
    code: 0, data: { success: true }, message: '仿真已停止', timestamp: Date.now(),
  }),
  'POST /api/simulation/pause': () => ({
    code: 0, data: { success: true }, message: '仿真已暂停', timestamp: Date.now(),
  }),
  'GET /api/simulation/results/:id': () => ({
    code: 0,
    data: {
      avgSpeedImprovement: 18.5,
      travelTimeReduction: 22.3,
      queueLengthReduction: 35.1,
      congestionIndexChange: -2.1,
      fuelSaving: '约12,500升/月',
    },
    message: 'ok',
    timestamp: Date.now(),
  }),

  // Devices
  'GET /api/devices': (url: string) => {
    const params = new URLSearchParams(url.split('?')[1] || '');
    const page = parseInt(params.get('page') || '1');
    const pageSize = parseInt(params.get('pageSize') || '20');
    const status = params.get('status');
    const type = params.get('type');
    let list = generateDevices();
    if (status) list = list.filter((d) => d.status === status);
    if (type) list = list.filter((d) => d.type === type);
    return {
      code: 0,
      data: { list: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, pageSize },
      message: 'ok',
      timestamp: Date.now(),
    };
  },
  'GET /api/devices/:id': (url: string) => {
    const id = url.match(/\/devices\/([^/?]+)/)?.[1];
    const devices = generateDevices();
    const found = devices.find((d) => d.id === id) || devices[0];
    return { code: 0, data: found, message: 'ok', timestamp: Date.now() };
  },

  // Analytics
  'GET /api/analytics/incident-trend': () => {
    const days = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      total: Math.floor(Math.random() * 30 + 10),
      resolved: Math.floor(Math.random() * 25 + 5),
      avgResponseTime: Math.floor(Math.random() * 30 + 5),
    }));
    return { code: 0, data: days, message: 'ok', timestamp: Date.now() };
  },
  'GET /api/analytics/category-distribution': () => {
    const categories = ['交通事故', '道路施工', '信号灯故障', '交通拥堵', '车辆故障', '临时管制', '路面塌陷', '其他'];
    return {
      code: 0,
      data: categories.map((name) => ({ name, value: Math.floor(Math.random() * 50 + 5) })),
      message: 'ok',
      timestamp: Date.now(),
    };
  },
  'GET /api/analytics/summary': () => ({
    code: 0,
    data: {
      totalIncidents: 342,
      avgResponseTime: 12.5,
      resolutionRate: 87.3,
      citizenSatisfaction: 4.2,
    },
    message: 'ok',
    timestamp: Date.now(),
  }),

  // Admin notifications（管理端通知中心）
  'GET /api/notifications': (url: string) => {
    const params = new URLSearchParams(url.split('?')[1] || '');
    const unreadOnly = params.get('unreadOnly') === 'true';
    let list = withReadState(getAdminNotificationCache()).sort((a, b) => b.createdAt - a.createdAt);
    if (unreadOnly) list = list.filter((n) => !n.read);
    const unreadCount = getAdminNotificationCache().filter((n) => !n.read && !adminNotificationReadIds.has(n.id)).length;
    return { code: 0, data: { list, unreadCount, total: list.length }, message: 'ok', timestamp: Date.now() };
  },
  'GET /api/notifications/unread-count': () => {
    const count = getAdminNotificationCache().filter((n) => !n.read && !adminNotificationReadIds.has(n.id)).length;
    return { code: 0, data: { count }, message: 'ok', timestamp: Date.now() };
  },
  'POST /api/notifications/read': (_url: string, options?: RequestInit) => {
    let body: { ids?: string[] } = {};
    try { body = options?.body ? JSON.parse(String(options.body)) : {}; } catch { /* ignore */ }
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      getAdminNotificationCache().forEach((n) => adminNotificationReadIds.add(n.id));
    } else {
      body.ids.forEach((id) => adminNotificationReadIds.add(id));
    }
    return { code: 0, data: { success: true }, message: 'ok', timestamp: Date.now() };
  },

  // Settings
  'GET /api/settings/users': () => ({
    code: 0, data: MOCK_USERS, message: 'ok', timestamp: Date.now(),
  }),
  'GET /api/settings/logs': () => ({
    code: 0, data: generateSystemLogs(), message: 'ok', timestamp: Date.now(),
  }),

  // Accessibility（无障碍设施管理）
  'GET /api/accessibility/stations': (url: string) => {
    const params = new URLSearchParams(url.split('?')[1] || '');
    const search = params.get('search');
    let list = MOCK_ACCESSIBILITY_STATIONS;
    if (search) list = list.filter(s => s.stationName.includes(search) || s.stationId.includes(search));
    const page = parseInt(params.get('page') || '1');
    const pageSize = parseInt(params.get('page_size') || '10');
    const start = (page - 1) * pageSize;
    return { code: 0, data: { list: list.slice(start, start + pageSize), total: list.length }, message: 'ok', timestamp: Date.now() };
  },
  'POST /api/accessibility/stations': (url: string, options?: RequestInit) => {
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    const now = Date.now();
    const station = {
      stationId: `bj_${now.toString(36)}`,
      stationName: body.stationName || '新站点',
      lng: Number(body.lng || 116.40),
      lat: Number(body.lat || 39.90),
      entrances: Array.isArray(body.entrances) ? body.entrances : [],
      accessibleRestroom: Boolean(body.accessibleRestroom),
      source: 'backend',
    };
    (MOCK_ACCESSIBILITY_STATIONS as { stationId: string }[]).push(station);
    return { code: 0, data: station, message: 'ok', timestamp: now };
  },
  'PUT /api/accessibility/stations/:id': (url: string, options?: RequestInit) => {
    const id = url.split('/').pop();
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    const station = MOCK_ACCESSIBILITY_STATIONS.find(s => s.stationId === id);
    if (!station) return { code: 404, data: null, message: '站点不存在', timestamp: Date.now() };
    if (body.stationName !== undefined) station.stationName = body.stationName;
    if (body.lng !== undefined) station.lng = Number(body.lng);
    if (body.lat !== undefined) station.lat = Number(body.lat);
    if (body.accessibleRestroom !== undefined) station.accessibleRestroom = Boolean(body.accessibleRestroom);
    return { code: 0, data: station, message: 'ok', timestamp: Date.now() };
  },
  'DELETE /api/accessibility/stations/:id': (url: string) => {
    const id = url.split('/').pop();
    const idx = MOCK_ACCESSIBILITY_STATIONS.findIndex(s => s.stationId === id);
    if (idx === -1) return { code: 404, data: null, message: '站点不存在', timestamp: Date.now() };
    MOCK_ACCESSIBILITY_STATIONS.splice(idx, 1);
    return { code: 0, data: { success: true }, message: 'ok', timestamp: Date.now() };
  },
  'POST /api/accessibility/stations/:id/entrances': (url: string, options?: RequestInit) => {
    const id = url.split('/').slice(-2, -1)[0];
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    const station = MOCK_ACCESSIBILITY_STATIONS.find(s => s.stationId === id);
    if (!station) return { code: 404, data: null, message: '站点不存在', timestamp: Date.now() };
    const entrance = { id: `ent-${Date.now().toString(36)}`, ...body };
    station.entrances.push(entrance);
    return { code: 0, data: station, message: 'ok', timestamp: Date.now() };
  },
  'PUT /api/accessibility/entrances/:id': (url: string, options?: RequestInit) => {
    const entranceId = url.split('/').pop();
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    let updated: MockStationFacility | null = null;
    for (const s of MOCK_ACCESSIBILITY_STATIONS) {
      const e = s.entrances.find(en => en.id === entranceId);
      if (e) { Object.assign(e, body); updated = s; break; }
    }
    return updated ? { code: 0, data: updated, message: 'ok', timestamp: Date.now() } : { code: 404, data: null, message: '入口不存在', timestamp: Date.now() };
  },
  'DELETE /api/accessibility/entrances/:id': (url: string) => {
    const entranceId = url.split('/').pop();
    let deleted = false;
    for (const s of MOCK_ACCESSIBILITY_STATIONS) {
      const idx = s.entrances.findIndex(en => en.id === entranceId);
      if (idx !== -1) { s.entrances.splice(idx, 1); deleted = true; break; }
    }
    return deleted ? { code: 0, data: { success: true }, message: 'ok', timestamp: Date.now() } : { code: 404, data: null, message: '入口不存在', timestamp: Date.now() };
  },
};

export function setupMockHandlers() {
  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || 'GET';

    // Only intercept /api/* calls
    if (!url.includes('/api/')) {
      return originalFetch(input, init);
    }

    // Simulate network delay
    const delay = 300 + Math.random() * 500;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // 管理端 apiClient baseURL=/api/admin，请求形如 /api/admin/devices。
    // mock handlers 的 key 是 /api/devices，这里规整掉 /admin 前缀后再匹配。
    const normalizedUrl = url.replace(/\/api\/admin\//, '/api/');

    // Try to match handler
    // First try exact method+path match (strip query)
    const pathOnly = normalizedUrl.split('?')[0];
    let handlerKey = `${method} ${pathOnly}`;

    // Don't use the path with query for matching
    let handler = API_HANDLERS[normalizedUrl.includes('?') ? `${method} ${normalizedUrl.split('?')[0]}` : `${method} ${normalizedUrl}`];

    // Try with parameterized paths
    if (!handler) {
      const pathSegments = pathOnly.split('/');
      // Try patterns like /api/incidents/:id, /api/signals/:id, etc.
      if (pathSegments.length >= 4) {
        const pattern = `${method} ${pathSegments.slice(0, 3).join('/')}/:id`;
        if (API_HANDLERS[pattern]) {
          handler = API_HANDLERS[pattern];
          handlerKey = pattern;
        }
      }
      // Try /api/simulation/results/:id
      if (pathSegments.length >= 5 && pathSegments[3] === 'results') {
        const pattern = `${method} /api/simulation/results/:id`;
        if (API_HANDLERS[pattern]) {
          handler = API_HANDLERS[pattern];
        }
      }
      // Try /api/accessibility/*（无障碍设施管理，参数化路径较特殊）
      // 注：pathSegments 首段为空（''），所以 /api/accessibility/stations/{id} 实际 5 段
      if (pathSegments.length >= 5 && pathSegments[2] === 'accessibility') {
        // /api/accessibility/stations/:id（5 段）
        if (pathSegments[3] === 'stations' && pathSegments.length === 5) {
          const pattern = `${method} /api/accessibility/stations/:id`;
          if (API_HANDLERS[pattern]) { handler = API_HANDLERS[pattern]; }
        }
        // /api/accessibility/stations/:id/entrances（6 段）
        if (pathSegments[3] === 'stations' && pathSegments.length === 6 && pathSegments[5] === 'entrances') {
          const pattern = `${method} /api/accessibility/stations/:id/entrances`;
          if (API_HANDLERS[pattern]) { handler = API_HANDLERS[pattern]; }
        }
        // /api/accessibility/entrances/:id（5 段）
        if (pathSegments[3] === 'entrances' && pathSegments.length === 5) {
          const pattern = `${method} /api/accessibility/entrances/:id`;
          if (API_HANDLERS[pattern]) { handler = API_HANDLERS[pattern]; }
        }
      }
    }

    if (!handler) {
      // Try with query params
      handler = API_HANDLERS[`${method} ${pathOnly}`];
    }

    if (handler) {
      const data = handler(url, init);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fallback
    return new Response(
      JSON.stringify({ code: 404, message: 'Not found', data: null, timestamp: Date.now() }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  };

  console.log('[Mock] API handlers registered for /api/*');
  return () => {
    window.fetch = originalFetch;
  };
}
