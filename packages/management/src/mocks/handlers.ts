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
  generateWorkOrders,
  SIMULATION_SCENARIOS,
  generateAiAlerts,
  generateRealTimeMetrics,
  MOCK_USERS,
  generateSystemLogs,
} from './mockData';

type Handler = (url: string, options?: RequestInit) => unknown;

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
    let list = generateIncidents();
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
    const incidents = generateIncidents();
    const found = incidents.find((i) => i.id === id) || incidents[0];
    return { code: 0, data: found, message: 'ok', timestamp: Date.now() };
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

  // Work Orders
  'GET /api/workorders': (url: string) => {
    const params = new URLSearchParams(url.split('?')[1] || '');
    const page = parseInt(params.get('page') || '1');
    const pageSize = parseInt(params.get('pageSize') || '10');
    const status = params.get('status');
    let list = generateWorkOrders();
    if (status) list = list.filter((w) => w.status === status);
    return {
      code: 0,
      data: { list: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, pageSize },
      message: 'ok',
      timestamp: Date.now(),
    };
  },
  'GET /api/workorders/:id': (url: string) => {
    const id = url.match(/\/workorders\/([^/?]+)/)?.[1];
    const orders = generateWorkOrders();
    const found = orders.find((o) => o.id === id || o.workOrderNo === id) || orders[0];
    return { code: 0, data: found, message: 'ok', timestamp: Date.now() };
  },
  'PUT /api/workorders/:id': () => ({
    code: 0, data: { success: true }, message: '工单状态已更新', timestamp: Date.now(),
  }),

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

  // Settings
  'GET /api/settings/users': () => ({
    code: 0, data: MOCK_USERS, message: 'ok', timestamp: Date.now(),
  }),
  'GET /api/settings/logs': () => ({
    code: 0, data: generateSystemLogs(), message: 'ok', timestamp: Date.now(),
  }),
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

    // Try to match handler
    // First try exact method+path match (strip query)
    const pathOnly = url.split('?')[0];
    let handlerKey = `${method} ${pathOnly}`;

    // Don't use the path with query for matching
    let handler = API_HANDLERS[url.includes('?') ? `${method} ${url.split('?')[0]}` : `${method} ${url}`];

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
