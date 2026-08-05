// ===== 简易 Fetch 拦截器 (替代 MSW) =====
import {
  MOCK_ROADS, MOCK_ALERTS, MOCK_BUS_LINES, MOCK_METRO_LINES,
  MOCK_PARKING_LOTS, MOCK_CHARGING_STATIONS, MOCK_WORK_ORDERS,
  MOCK_NEWS, MOCK_CARBON_RECORDS, MOCK_CARBON_REWARDS,
} from './data';

function delay(ms = 300 + Math.random() * 500) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function json(data: unknown, code = 0) {
  return { code, message: 'ok', data, timestamp: Date.now() };
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
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('/api')) return originalFetch.call(window, input, init);

    await delay();
    const method = init?.method || 'GET';

    // 交通数据
    if (url === '/api/traffic/congestion') return new Response(JSON.stringify(json(MOCK_ROADS)), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/traffic/alerts') return new Response(JSON.stringify(json(MOCK_ALERTS)), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/traffic/snapshot') return new Response(JSON.stringify(json({ cityIndex:6.8, avgSpeed:28, congestedRoadCount:23, totalRoadCount:86, timestamp:Date.now(), districtRanking:[{district:'朝阳区',index:7.2,avgSpeed:22,trend:'up'},{district:'海淀区',index:6.9,avgSpeed:25,trend:'stable'},{district:'西城区',index:6.5,avgSpeed:30,trend:'down'}], trend24h:Array.from({length:24},(_,i)=>({hour:i,index:[3,2.5,2.2,2.1,2.3,3.5,5.8,7.2,8.5,7.8,6.5,5.8,5.2,5.0,5.5,6.0,6.8,8.0,8.8,7.5,6.2,5.0,4.5,3.8][i]})) })), { headers:{'Content-Type':'application/json'} });

    // 路径规划
    if (url.startsWith('/api/route/plan')) return new Response(JSON.stringify(json([mockRouteResult('drive'), mockRouteResult('bus'), mockRouteResult('bike')])), { headers:{'Content-Type':'application/json'} });
    if (url.startsWith('/api/route/bus/realtime/')) { const lid = url.split('/').pop()!; return new Response(JSON.stringify(json(mockBusRealtime(lid))), { headers:{'Content-Type':'application/json'} }); }

    // 公交地铁
    if (url === '/api/transit/bus-lines') return new Response(JSON.stringify(json(MOCK_BUS_LINES)), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/transit/metro-lines') return new Response(JSON.stringify(json(MOCK_METRO_LINES)), { headers:{'Content-Type':'application/json'} });

    // 停车充电
    if (url === '/api/parking/lots') return new Response(JSON.stringify(json(MOCK_PARKING_LOTS)), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/parking/charging') return new Response(JSON.stringify(json(MOCK_CHARGING_STATIONS)), { headers:{'Content-Type':'application/json'} });

    // 事件上报
    if (url === '/api/report/list') return new Response(JSON.stringify(json(MOCK_WORK_ORDERS)), { headers:{'Content-Type':'application/json'} });
    if (url.match(/\/api\/report\/detail\//)) return new Response(JSON.stringify(json(MOCK_WORK_ORDERS[0])), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/report/query') return new Response(JSON.stringify(json(MOCK_WORK_ORDERS[2])), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/report/submit' && method === 'POST') return new Response(JSON.stringify(json({ ...MOCK_WORK_ORDERS[2], workOrderNo:'ZT'+Date.now().toString(36).toUpperCase() })), { headers:{'Content-Type':'application/json'} });

    // 新闻
    if (url === '/api/news/list') return new Response(JSON.stringify(json(MOCK_NEWS)), { headers:{'Content-Type':'application/json'} });
    if (url.match(/\/api\/news\/detail\//)) return new Response(JSON.stringify(json(MOCK_NEWS[0])), { headers:{'Content-Type':'application/json'} });

    // 碳积分
    if (url === '/api/carbon/stats') return new Response(JSON.stringify(json({ totalPoints:1250, totalCarbonSaved:5267, treeEquivalent:1.05, carDistanceSaved:26.3, rankPercent:15, records:MOCK_CARBON_RECORDS })), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/carbon/rewards') return new Response(JSON.stringify(json(MOCK_CARBON_REWARDS)), { headers:{'Content-Type':'application/json'} });

    // 用户
    if (url === '/api/user/send-code' && method === 'POST') return new Response(JSON.stringify(json({ success:true })), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/user/login' && method === 'POST') return new Response(JSON.stringify(json({ id:'u1', phone:'138****5678', nickname:'北京市民', isVerified:true, carbonCredits:1250, token:'mock_token_' + Date.now() })), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/user/register' && method === 'POST') return new Response(JSON.stringify(json({ id:'u1', phone:'138****5678', nickname:'北京市民', isVerified:false, carbonCredits:0, token:'mock_token_' + Date.now() })), { headers:{'Content-Type':'application/json'} });
    if (url === '/api/user/profile') return new Response(JSON.stringify(json({ id:'u1', phone:'138****5678', nickname:'北京市民', realName:'张先生', isVerified:true, carbonCredits:1250 })), { headers:{'Content-Type':'application/json'} });

    return new Response(JSON.stringify(json(null)), { headers:{'Content-Type':'application/json'} });
  };
}
