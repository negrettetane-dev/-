// ===== 简易 Fetch 拦截器 (替代 MSW) =====
import {
  MOCK_ROADS, MOCK_ALERTS, MOCK_BUS_LINES, MOCK_METRO_LINES,
  MOCK_PARKING_LOTS, MOCK_CHARGING_STATIONS, MOCK_WORK_ORDERS,
  MOCK_NEWS, MOCK_CARBON_RECORDS, MOCK_CARBON_REWARDS,
  MOCK_METRO_META, MOCK_METRO_TRANSFERS, MOCK_NEARBY_STATIONS,
} from './data';
import {
  getUserPoints, deductPoints, addPoints,
  addRedemption, getRedemptions,
  findAccount, findAccountById, registerAccount, hashPassword,
  addReport, getReports,
} from '../stores/persistence';
import { DEMO_ACCESSIBLE_FACILITIES } from '../data/accessibilityFacilities';
import {
  CUTOFF_MINUTES,
  computeBusStatus,
  instancesForDate,
} from '../utils/customBusSchedule';
import { createMockTrip, findMockTrip, finishMockTrip, listMockTrips } from './tripRepository';
import type { CreateTripRequest } from '../types/trip';

function delay(ms = 300 + Math.random() * 500) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function json(data: unknown, code = 0) {
  return { code, message: 'ok', data, timestamp: Date.now() };
}

function makeMockToken(userId: string) {
  return `mock.${encodeURIComponent(userId)}.${Date.now()}`;
}

function mockUserId(input: RequestInfo | URL, init?: RequestInit): string | null {
  const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
  const token = headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  const match = /^mock\.([^.]+)\.\d+$/.exec(token);
  return match ? decodeURIComponent(match[1]) : null;
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof init?.body === 'string') return JSON.parse(init.body || '{}');
  if (input instanceof Request) return input.clone().json().catch(() => ({}));
  return {};
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function randomCoord(): [number, number] {
  return [116.32 + Math.random() * 0.18, 39.86 + Math.random() * 0.12];
}

// 路径规划 Mock
function mockRouteResult(mode: string) {
  const coords: [number,number][] = Array.from({length:8},()=>randomCoord());
  switch(mode){
    case 'drive': return { id:'dr1', mode:'drive', distance:8500, duration:1500+Math.random()*1200, tolls:5, trafficLights:12, polyline:coords, steps:[], congestionSegments:[{level:'slow',ratio:0.3},{level:'congested',ratio:0.3},{level:'free',ratio:0.4}], predictions:[ {timeOffset:15,estimatedDuration:1400,congestionLevel:'congested',confidence:0.85},{timeOffset:30,estimatedDuration:1200,congestionLevel:'slow',confidence:0.78},{timeOffset:45,estimatedDuration:900,congestionLevel:'free',confidence:0.72},{timeOffset:60,estimatedDuration:1100,congestionLevel:'slow',confidence:0.65}], bestDepartTime:Date.now()+900000, aiAdvice:'建议推迟15分钟出发，避开长安街东段拥堵高峰，可节省约10分钟' };
    case 'bus': return { id:'tr1', mode:'bus', distance:9200, duration:2100, cost:4, segments:[ {type:'walk',distance:300,duration:240,polyline:[],instruction:'步行300米至西单站'},{type:'metro',lineName:'1号线',lineId:'m1',fromStation:'西单',toStation:'国贸',stationCount:5,duration:600,crowding:'crowded'},{type:'bus',lineName:'1路',lineId:'b1',fromStop:'国贸',toStop:'四惠',stopCount:5,duration:900,crowding:'normal',nextBusArrival:180,nextBusCrowding:'normal'},{type:'walk',distance:200,duration:120,polyline:[],instruction:'步行200米到达目的地'}], predictions:[{timeOffset:15,estimatedDuration:2000,congestionLevel:'slow',confidence:0.8},{timeOffset:30,estimatedDuration:1800,congestionLevel:'free',confidence:0.75}] };
    case 'bike': return { id:'bw1', mode:'bike', distance:7200, duration:1500, calories:216, polyline:coords, steps:[], bikeLaneRatio:0.65 };
    case 'walk': return { id:'bw2', mode:'walk', distance:6800, duration:4200, calories:340, polyline:coords, steps:[] };
    default: return mockRouteResult('drive');
  }
}

function mockBusRealtime(lineId: string) {
  return {
    busId: lineId + '_v1', lineId, lineName: MOCK_BUS_LINES.find(b=>b.id===lineId)?.name||'1路',
    plate: '京A'+String(Math.floor(Math.random()*90000)+10000)+'D',
    lat: 39.90+Math.random()*0.06, lng: 116.38+Math.random()*0.08,
    speed: 15+Math.random()*30, direction:'上行',
    nextStop: '王府井', nextStopArrivalSeconds: Math.floor(Math.random()*300),
    crowding: (['empty','normal','crowded','full'] as const)[Math.floor(Math.random()*4)],
    timestamp: Date.now()
  };
}

export function fetchInterceptor() {
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const parsedUrl = new URL(rawUrl, window.location.origin);
    if (parsedUrl.origin !== window.location.origin || !parsedUrl.pathname.startsWith('/api')) {
      return originalFetch.call(window, input, init);
    }
    const url = parsedUrl.pathname + parsedUrl.search;

    await delay();
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const pathname = parsedUrl.pathname;

    // 用户作用域接口：身份只从 Bearer Token 中解析，不接受 userId 参数。
    if (pathname === '/api/trips' || pathname.startsWith('/api/trips/')) {
      const userId = mockUserId(input, init);
      if (!userId) return response({ code: 401, message: '请先登录', data: null }, 401);

      if (pathname === '/api/trips' && method === 'GET') {
        return response(json(listMockTrips(userId)));
      }
      if (pathname === '/api/trips' && method === 'POST') {
        const body = await requestBody(input, init) as CreateTripRequest;
        if (!body.clientSessionId || !body.origin || !body.destination || !body.routeSnapshot) {
          return response({ code: 400, message: '出行参数不完整', data: null }, 400);
        }
        return response(json(createMockTrip(userId, body)));
      }

      const actionMatch = pathname.match(/^\/api\/trips\/([^/]+)\/(complete|cancel)$/);
      if (actionMatch && method === 'POST') {
        const tripId = decodeURIComponent(actionMatch[1]);
        const before = findMockTrip(userId, tripId);
        const trip = finishMockTrip(userId, tripId, actionMatch[2] === 'complete' ? 'completed' : 'cancelled');
        if (!trip) return response({ code: 404, message: '出行记录不存在', data: null }, 404);
        if (before?.status === 'in_progress' && actionMatch[2] === 'complete' && trip.earnedPoints > 0) addPoints(trip.earnedPoints, userId);
        return response(json(trip));
      }

      const detailMatch = pathname.match(/^\/api\/trips\/([^/]+)$/);
      if (detailMatch && method === 'GET') {
        const trip = findMockTrip(userId, decodeURIComponent(detailMatch[1]));
        return trip ? response(json(trip)) : response({ code: 404, message: '出行记录不存在', data: null }, 404);
      }
      return response({ code: 405, message: '不支持的操作', data: null }, 405);
    }

    // 交通数据
    if (url === '/api/traffic/congestion') return new Response(JSON.stringify(json(MOCK_ROADS)), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/traffic/alerts') return new Response(JSON.stringify(json(MOCK_ALERTS)), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/traffic/snapshot') return new Response(JSON.stringify(json({ cityIndex:6.8, avgSpeed:28, congestedRoadCount:23, totalRoadCount:86, timestamp:Date.now(), districtRanking:[{district:'朝阳区',index:7.2,avgSpeed:22,trend:'up'},{district:'海淀区',index:6.9,avgSpeed:25,trend:'stable'},{district:'西城区',index:6.5,avgSpeed:30,trend:'down'}], trend24h:Array.from({length:24},(_,i)=>({hour:i,index:[3,2.5,2.2,2.1,2.3,3.5,5.8,7.2,8.5,7.8,6.5,5.8,5.2,5.0,5.5,6.0,6.8,8.0,8.8,7.5,6.2,5.0,4.5,3.8][i]})) })), { headers:{'Content-Type':'application/json'} });

    // 路径规划
    if (url.startsWith('/api/route/plan')) return new Response(JSON.stringify(json([mockRouteResult('drive'), mockRouteResult('bus'), mockRouteResult('bike')])), { headers:{'Content-Type':'application/json'} });
    if (url.startsWith('/api/route/bus/realtime/')) { const lid = url.split('/').pop()!; return new Response(JSON.stringify(json(mockBusRealtime(lid))), { headers:{'Content-Type':'application/json'} }); }

    // 公交地铁
    if (url === '/api/transit/bus-lines') {
      return new Response(JSON.stringify(json(MOCK_BUS_LINES.map(b => ({
        id: b.id, mode: 'bus', name: b.name, direction: `${b.from} → ${b.to}`,
        from: b.from, to: b.to, first: '05:30', last: '23:00', color: '#1677ff',
        status: 'normal', source: 'mock',
        stations: b.stops.map((s, i) => ({ id: `${b.id}_s${i}`, name: s, sequence: i })),
      })))), { headers:{'Content-Type':'application/json'} });
    }
    if (url === '/api/transit/metro-lines') {
      return new Response(JSON.stringify(json(MOCK_METRO_LINES.map(m => ({
        id: m.id, mode: 'metro', name: m.name.replace('(环线)',''), direction: MOCK_METRO_META[m.id]?.direction || `${m.from} → ${m.to}`,
        from: m.from, to: m.to, first: MOCK_METRO_META[m.id]?.first || '05:00', last: MOCK_METRO_META[m.id]?.last || '23:00',
        color: MOCK_METRO_META[m.id]?.color || '#c23a30', status: 'normal', source: 'mock',
        stations: m.stations.map((s, i) => ({ id: `${m.id}_s${i}`, name: s, sequence: i, transferLines: MOCK_METRO_TRANSFERS[s] })),
      })))), { headers:{'Content-Type':'application/json'} });
    }

    // 公交/地铁线路详情（含完整站点、首末班、换乘）
    if (url.match(/\/api\/transit\/bus\//)) {
      const lid = url.split('/').pop()!;
      const b = MOCK_BUS_LINES.find(x => x.id === lid);
      if (!b) return new Response(JSON.stringify({ code: 404, message: '线路不存在', data: null }), { headers:{'Content-Type':'application/json'} });
      return new Response(JSON.stringify(json({
        id: b.id, mode: 'bus', name: b.name, direction: `${b.from} → ${b.to}`,
        from: b.from, to: b.to, first: '05:30', last: '23:00', color: '#1677ff',
        status: 'normal', source: 'mock',
        stations: b.stops.map((s, i) => ({ id: `${b.id}_s${i}`, name: s, sequence: i })),
      })), { headers:{'Content-Type':'application/json'} });
    }
    if (url.match(/\/api\/transit\/metro\//)) {
      const lid = url.split('/').pop()!;
      const m = MOCK_METRO_LINES.find(x => x.id === lid);
      if (!m) return new Response(JSON.stringify({ code: 404, message: '线路不存在', data: null }), { headers:{'Content-Type':'application/json'} });
      return new Response(JSON.stringify(json({
        id: m.id, mode: 'metro', name: m.name.replace('(环线)',''), direction: MOCK_METRO_META[m.id]?.direction || `${m.from} → ${m.to}`,
        from: m.from, to: m.to, first: MOCK_METRO_META[m.id]?.first || '05:00', last: MOCK_METRO_META[m.id]?.last || '23:00',
        color: MOCK_METRO_META[m.id]?.color || '#c23a30', status: 'normal', source: 'mock',
        stations: m.stations.map((s, i) => ({ id: `${m.id}_s${i}`, name: s, sequence: i, transferLines: MOCK_METRO_TRANSFERS[s] })),
      })), { headers:{'Content-Type':'application/json'} });
    }

    // 公交/地铁搜索（线路 / 站点）
    if (url.startsWith('/api/transit/search')) {
      const q = decodeURIComponent(new URL(url, 'http://x').searchParams.get('q') || '').trim();
      const results: any[] = [];
      if (q) {
        MOCK_BUS_LINES.forEach(b => {
          if (b.name.includes(q) || b.stops.some(s => s.includes(q))) {
            results.push({ type: 'line', mode: 'bus', id: b.id, name: b.name, subtitle: `${b.from} → ${b.to}` });
          }
        });
        MOCK_METRO_LINES.forEach(m => {
          const name = m.name.replace('(环线)','');
          if (name.includes(q) || m.stations.some(s => s.includes(q))) {
            results.push({ type: 'line', mode: 'metro', id: m.id, name, subtitle: MOCK_METRO_META[m.id]?.direction || '' });
          }
          m.stations.forEach(s => {
            if (s.includes(q) && !results.some(r => r.type === 'station' && r.name === s)) {
              results.push({ type: 'station', mode: 'metro', id: `${m.id}_${s}`, name: s, transferLines: MOCK_METRO_TRANSFERS[s] });
            }
          });
        });
        MOCK_BUS_LINES.forEach(b => {
          b.stops.forEach(s => {
            if (s.includes(q) && !results.some(r => r.type === 'station' && r.name === s)) {
              results.push({ type: 'station', mode: 'bus', id: `${b.id}_${s}`, name: s });
            }
          });
        });
      }
      return new Response(JSON.stringify(json(results.slice(0, 12))), { headers:{'Content-Type':'application/json'} });
    }

    // 附近公交/地铁站（返回 type 字段，与真实后端一致；前端 getNearbyStations 读 station.type）
    if (url.startsWith('/api/transit/nearby')) {
      const sorted = [...MOCK_NEARBY_STATIONS].sort((a, b) => a.distance - b.distance)
        .map(s => ({ ...s, type: s.mode }));
      return new Response(JSON.stringify(json(sorted)), { headers:{'Content-Type':'application/json'} });
    }

    // 实时到站信息（演示：随机生成倒计时）
    if (url.startsWith('/api/transit/arrival')) {
      const params = new URL(url, 'http://x').searchParams;
      const lineId = params.get('lineId') || '';
      const stationId = params.get('stationId') || '';
      const line = MOCK_BUS_LINES.find(x => x.id === lineId) || MOCK_METRO_LINES.find(x => x.id === lineId);
      const crowdLevels = ['empty', 'normal', 'crowded', 'full'] as const;
      return new Response(JSON.stringify(json({
        lineId, stationId,
        lineName: line?.name || lineId,
        nextArrivalSeconds: 40 + Math.floor(Math.random() * 260),
        followingArrivalSeconds: 300 + Math.floor(Math.random() * 480),
        crowdLevel: crowdLevels[Math.floor(Math.random() * 4)],
        updatedAt: Date.now(),
        source: 'mock',
      })), { headers:{'Content-Type':'application/json'} });
    }

    // 无障碍设施（平民端查询）：mock 环境下返回演示数据，对齐后端契约
    if (url === '/api/accessibility/stations') {
      return new Response(JSON.stringify(json(DEMO_ACCESSIBLE_FACILITIES.map(f => ({ ...f, source: 'backend' })))), { headers: { 'Content-Type': 'application/json' } });
    }

    // 定制公交（mock 模拟后端：班次实例 / 预约）。真实后端实现后前端零改动。
    if (url === '/api/custom-bus/schedules' && method === 'GET') {
      const params = new URL(url, 'http://x').searchParams;
      const dateStr = params.get('date') || new Date().toISOString().slice(0, 10);
      const now = new Date();
      const nowMs = Date.now();
      // 用模板生成完整班次实例，再映射到 shared CustomBusSchedule 契约
      const instances = instancesForDate(now, new Date(`${dateStr}T00:00:00`));
      const schedules = instances.map(instance => {
        const depart = new Date(`${dateStr}T${instance.departTime}:00`);
        const cutoff = new Date(depart.getTime() - CUTOFF_MINUTES * 60 * 1000);
        const status = computeBusStatus(instance, now);
        return {
          id: instance.id,
          templateId: instance.templateId,
          scheduleId: instance.scheduleId,
          from: instance.from,
          to: instance.to,
          boardingPointId: instance.boardingPointId,
          date: instance.date,
          departTime: instance.departTime,
          arriveTime: instance.arriveTime,
          price: instance.price,
          totalSeats: instance.seats,
          bookedSeats: 0,
          remainingSeats: instance.seats,
          type: instance.type,
          status,
          cutoffAt: cutoff.getTime(),
        };
      });
      // 对齐后端真实形状：{ date, schedules }（CustomBusSchedulesResponse）
      return new Response(JSON.stringify(json({ date: dateStr, schedules })), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url === '/api/custom-bus/reservations' && method === 'GET') {
      const userId = mockUserId(input, init);
      if (!userId) return response({ code: 401, message: '请先登录', data: null }, 401);
      return response(json([]));
    }
    if (url === '/api/custom-bus/reservations' && method === 'POST') {
      const userId = mockUserId(input, init);
      if (!userId) return response({ code: 401, message: '请先登录', data: null }, 401);
      const body = await requestBody(input, init);
      const scheduleInstanceId = String(body.scheduleInstanceId || '');
      if (!scheduleInstanceId) return response({ code: 400, message: '班次实例缺失', data: null }, 400);
      return response(json({
        id: `cbres_${Date.now().toString(36)}`,
        reservationNo: 'CB' + Date.now().toString(36).toUpperCase(),
        scheduleInstanceId,
        templateId: scheduleInstanceId.split('-').slice(0, 2).join('-'),
        routeName: '定制公交',
        scheduleId: scheduleInstanceId,
        date: new Date().toISOString().slice(0, 10),
        departureTime: '',
        boardingPoint: '',
        destination: '',
        price: Number(body.passengerCount || 1) * 8,
        passengerCount: Number(body.passengerCount || 1),
        status: 'pending',
        createdAt: Date.now(),
      }));
    }

    // 停车充电
    if (url === '/api/parking/lots') return new Response(JSON.stringify(json(MOCK_PARKING_LOTS)), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/parking/charging') return new Response(JSON.stringify(json(MOCK_CHARGING_STATIONS)), { headers:{'Content-Type':'application/json'} });

    // 用户上报：列表和详情均由 Token 限定用户作用域。
    if (url === '/api/events/mine' || url === '/api/report/list') {
      const userId = mockUserId(input, init);
      if (!userId) return response({ code: 401, message: '请先登录', data: null }, 401);
      return response(json(getReports(userId).map(item => ({ ...item, createTime: item.createdAt }))));
    }
    if (url.match(/\/api\/report\/detail\//)) {
      const userId = mockUserId(input, init);
      if (!userId) return response({ code: 401, message: '请先登录', data: null }, 401);
      const reportId = decodeURIComponent(url.split('/').pop() || '');
      const report = getReports(userId).find(item => item.id === reportId);
      return report ? response(json({ ...report, createTime: report.createdAt })) : response({ code: 404, message: '上报记录不存在', data: null }, 404);
    }
    if (url === '/api/report/query') return new Response(JSON.stringify(json(MOCK_WORK_ORDERS[2])), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/report/submit' && method === 'POST') {
      const userId = mockUserId(input, init);
      if (!userId) return response({ code: 401, message: '请先登录', data: null }, 401);
      const body = await requestBody(input, init);
      const now = Date.now();
      const report = { id: `report_${now.toString(36)}`, workOrderNo: `ZT${now.toString(36).toUpperCase()}`, category: body.category || '其他问题', description: body.description || '', location: body.address || '', status: 'pending' as const, createdAt: now };
      addReport(report, userId);
      return response(json({ ...report, createTime: now }));
    }

    // 新闻
    if (url === '/api/news/list') return new Response(JSON.stringify(json(MOCK_NEWS)), { headers:{'Content-Type':'application/json'} });
    if (url.match(/\/api\/news\/detail\//)) return new Response(JSON.stringify(json(MOCK_NEWS[0])), { headers:{'Content-Type':'application/json'} });

    // ====== 积分兑换系统（完整后端逻辑） ======

    // GET /api/points — 查询当前用户积分（从持久化层读取，非前端写死）
    if (url === '/api/points') {
      const userId = mockUserId(input, init);
      if (!userId) return response({ code: 401, message: '请先登录', data: null }, 401);
      const points = getUserPoints(userId);
      return new Response(JSON.stringify(json({ points })), { headers:{'Content-Type':'application/json'} });
    }

    // GET /api/rewards — 兑换商品列表（可扩展，从"后端"定义积分配额）
    if (url === '/api/rewards') {
      return new Response(JSON.stringify(json(MOCK_CARBON_REWARDS)), { headers:{'Content-Type':'application/json'} });
    }

    // POST /api/rewards/redeem — 执行兑换（积分不足由"后端"判断，前端无法篡改）
    if (url === '/api/rewards/redeem' && method === 'POST') {
      const userId = mockUserId(input, init);
      if (!userId) return response({ code: 401, message: '请先登录', data: null }, 401);
      const body = await requestBody(input, init);
      const rewardId = body.rewardId;
      const reward = MOCK_CARBON_REWARDS.find(r => r.id === rewardId);
      if (!reward) return new Response(JSON.stringify({ code: 404, message: '商品不存在', data: null }), { headers:{'Content-Type':'application/json'} });

      const userPoints = getUserPoints(userId);
      if (userPoints < reward.cost) {
        return new Response(JSON.stringify({
          code: 400, message: `积分不足，当前积分${userPoints}，需要${reward.cost}积分`,
          data: { required: reward.cost, current: userPoints }
        }), { headers:{'Content-Type':'application/json'} });
      }

      // 事务模拟：扣积分 + 建兑换记录（两步都成功才返回成功）
      const deducted = deductPoints(reward.cost, userId);
      if (!deducted.success) {
        return new Response(JSON.stringify({ code: 500, message: '积分扣减失败，请重试', data: null }), { headers:{'Content-Type':'application/json'} });
      }

      const now = new Date();
      const expires = new Date(now.getTime() + 30 * 86400000); // 30天有效期
      addRedemption({
        id: 'rd_' + Date.now().toString(36),
        user_id: userId,
        reward_id: reward.id,
        reward_name: reward.name,
        points_cost: reward.cost,
        status: 'unused',
        redeemed_at: now.toISOString(),
        expires_at: expires.toISOString(),
      }, userId);

      return new Response(JSON.stringify(json({
        success: true,
        remainingPoints: deducted.remaining,
        rewardName: reward.name,
        pointsCost: reward.cost,
      })), { headers:{'Content-Type':'application/json'} });
    }

    // GET /api/redemptions — 当前用户兑换记录
    if (url === '/api/redemptions') {
      const userId = mockUserId(input, init);
      if (!userId) return response({ code: 401, message: '请先登录', data: null }, 401);
      return new Response(JSON.stringify(json(getRedemptions(userId))), { headers:{'Content-Type':'application/json'} });
    }

    // 碳积分统计（首页展示用，合并持久化积分）
    if (url === '/api/carbon/stats') {
      const userId = mockUserId(input, init);
      if (!userId) return response({ code: 401, message: '请先登录', data: null }, 401);
      const currentPoints = getUserPoints(userId);
      const completedTrips = listMockTrips(userId).filter(trip => trip.status === 'completed' && (trip.carbonSaved > 0 || trip.earnedPoints > 0));
      return new Response(JSON.stringify(json({
        totalPoints: currentPoints,
        totalCarbonSaved: completedTrips.reduce((sum, trip) => sum + trip.carbonSaved, 0),
        treeEquivalent: Number((currentPoints / 1000).toFixed(2)),
        carDistanceSaved: Math.round(currentPoints / 50),
        rankPercent: 15,
        records: completedTrips.map(trip => ({ id: trip.id, type: trip.mode, date: trip.startedAt, distance: trip.actualDistance ?? trip.estimatedDistance, duration: trip.actualDuration ?? trip.estimatedDuration, carbonSaved: trip.carbonSaved, points: trip.earnedPoints, route: `${trip.origin.name} → ${trip.destination.name}` }))
      })), { headers:{'Content-Type':'application/json'} });
    }

    // ====== 多账号认证（验证码 / 密码） ======
    // 发送验证码（演示环境：明文回传验证码，与真实后端契约对齐 { expiresIn, code, demo:true }）
    if (url === '/api/user/send-code' && method === 'POST') {
      const body = await requestBody(input, init);
      const phone = String(body.phone || '').trim();
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return new Response(JSON.stringify({ code: 'INVALID_PHONE', message: '手机号格式不正确', data: null }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      // 演示环境固定验证码 123456（与 verify-code 校验一致），真实后端会回传随机验证码
      return new Response(JSON.stringify(json({ expiresIn: 300, code: '123456', demo: true })), { headers: { 'Content-Type': 'application/json' } });
    }

    // 验证码登录：手机号 + 6 位验证码；未注册手机号自动注册（与真实后端契约对齐）
    if (url === '/api/auth/verify-code' && method === 'POST') {
      const body = await requestBody(input, init);
      const phone = String(body.phone || '').trim();
      const code = String(body.code || '').trim();
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return new Response(JSON.stringify({ code: 'INVALID_PHONE', message: '手机号格式不正确', data: null }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (!/^\d{6}$/.test(code)) {
        return new Response(JSON.stringify({ code: 'INVALID_CODE', message: '验证码格式不正确', data: null }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      // 演示环境固定校验码 123456（无短信网关，真实环境由后端校验）
      if (code !== '123456') {
        return new Response(JSON.stringify({ code: 'CODE_MISMATCH', message: '验证码错误', data: null }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      let account = findAccount(phone);
      if (!account) {
        // 未注册手机号自动注册：用户名 u + 后四位
        const username = `u${phone.slice(-4)}`;
        const reg = registerAccount({ username, phone, email: '', password: phone.slice(-6), nickname: username });
        account = reg.account || null;
      }
      if (!account) {
        return new Response(JSON.stringify({ code: 'REGISTER_FAILED', message: '自动注册失败', data: null }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      const user = {
        id: account.id, username: account.username, nickname: account.nickname,
        phone: account.phone, email: account.email || '', avatar: account.avatar || '', role: account.role,
        isVerified: true, carbonCredits: account.carbonCredits,
        token: makeMockToken(account.id),
      };
      return new Response(JSON.stringify(json(user)), { headers: { 'Content-Type': 'application/json' } });
    }

    // 登录：支持两种 body
    //   验证码: { phone, code }
    //   密码:   { account, password }   account = 用户名/手机号/邮箱
    if ((url === '/api/user/login' || url === '/api/auth/login') && method === 'POST') {
      const body = await requestBody(input, init);

      // 密码登录
      if (body.account && body.password) {
        const account = findAccount(body.account);
        if (!account || account.passwordHash !== hashPassword(body.password)) {
          return new Response(JSON.stringify({ code: 'INVALID_CREDENTIALS', message: '账号或密码错误', data: null }), { headers:{'Content-Type':'application/json'} });
        }
        const user = {
          id: account.id, username: account.username, nickname: account.nickname,
          phone: account.phone, email: account.email, role: account.role,
          isVerified: true, carbonCredits: account.carbonCredits,
          token: makeMockToken(account.id),
        };
        return new Response(JSON.stringify(json(user)), { headers:{'Content-Type':'application/json'} });
      }

      // 验证码登录（仅手机号）
      if (body.phone) {
        const account = findAccount(body.phone);
        if (!account) return response({ code: 'INVALID_CREDENTIALS', message: '该手机号尚未注册', data: null }, 401);
        const user = {
          id: account.id, username: account.username, nickname: account.nickname,
          phone: account.phone, email: account.email || '', role: account.role,
          isVerified: true, carbonCredits: account.carbonCredits,
          token: makeMockToken(account.id),
        };
        return new Response(JSON.stringify(json(user)), { headers:{'Content-Type':'application/json'} });
      }
      return new Response(JSON.stringify({ code: 'INVALID_CREDENTIALS', message: '账号或密码错误', data: null }), { headers:{'Content-Type':'application/json'} });
    }

    // 注册：用户名 + 手机号 + 邮箱(可选) + 密码，检查重复
    if (url === '/api/user/register' && method === 'POST') {
      const body = await requestBody(input, init);
      const result = registerAccount({
        username: body.username || body.nickname || '',
        phone: body.phone || '',
        email: body.email || '',
        password: body.password || '',
        nickname: body.nickname || body.username || '',
      });
      if (result.error) {
        const msg = result.error === 'username_exists' ? '该用户名已存在'
          : result.error === 'phone_exists' ? '该手机号已注册'
          : '该邮箱已注册';
        return new Response(JSON.stringify({ code: result.error, message: msg, data: null }), { headers:{'Content-Type':'application/json'} });
      }
      const acc = result.account!;
      const user = {
        id: acc.id, username: acc.username, nickname: acc.nickname,
        phone: acc.phone, email: acc.email, role: acc.role,
        isVerified: false, carbonCredits: 0,
        token: makeMockToken(acc.id),
      };
      return new Response(JSON.stringify(json(user)), { headers:{'Content-Type':'application/json'} });
    }

    if (url === '/api/user/profile') {
      const userId = mockUserId(input, init);
      if (!userId) return response({ code: 401, message: '请先登录', data: null }, 401);
      const acc = findAccountById(userId);
      if (!acc) return response({ code: 404, message: '用户不存在', data: null }, 404);
      return new Response(JSON.stringify(json({
        id: acc.id, phone: acc.phone, nickname: acc.nickname || acc.username, realName: acc.nickname || acc.username, isVerified: true, carbonCredits: getUserPoints(userId)
      })), { headers:{'Content-Type':'application/json'} });
    }

    return new Response(JSON.stringify(json(null)), { headers:{'Content-Type':'application/json'} });
  };
}
