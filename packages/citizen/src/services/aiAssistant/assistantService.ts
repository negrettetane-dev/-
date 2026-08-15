// ===== 智途云枢 · 小枢出行助手 核心服务 =====
// 职责：意图 → 调用真实业务 Service/API → 组装可信回复（文本 + 结构化卡片 + 来源标识）。
// 原则：
//   1. 只调用真实存在的 Service/API，不伪造事实数据；
//   2. 模拟/演示/预测数据必须显式标注；
//   3. 个人数据查询必须基于登录态（未登录不调用个人接口）；
//   4. API 失败时返回明确错误类型，不编造结果。

import { apiGet } from '../apiClient';
import { recognizeIntent } from './intentRouter';
import { searchTransit, getBusLines, getMetroLines } from '../transitService';
import { getRouteForecast } from '../routeForecastService';
import { FORECAST_LEVEL_LABEL } from '../../types/routeForecast';
import type {
  AssistantCard,
  AssistantCardAction,
  AssistantContext,
  AssistantDataSource,
  AssistantMessage,
  IntentParseResult,
} from '../../types/aiAssistant';

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${++seq}_${Date.now()}`;

const SRC = {
  real: 'real' as const,
  demo: 'demo' as const,
  simulated: 'simulated' as const,
  unknown: 'unknown' as const,
};

function msg(text: string, cards?: AssistantCard[]): AssistantMessage {
  return { id: nextId('m'), role: 'ai', text, cards, createdAt: Date.now() };
}

function modeLabel(mode?: string): string {
  return ({ drive: '驾车', bus: '公交', bike: '骑行', walk: '步行' } as Record<string, string>)[mode || 'drive'] || '驾车';
}

/** 入口：根据输入返回一条可信回复 */
export async function respond(input: string, ctx: AssistantContext): Promise<AssistantMessage> {
  const parsed = recognizeIntent(input);
  switch (parsed.intent) {
    case 'route_plan': return handleRoutePlan(parsed, ctx);
    case 'route_compare': return handleRouteCompare(parsed, ctx);
    case 'traffic_query': return handleTraffic(parsed);
    case 'transit_query': return handleTransit(input);
    case 'parking_query': return handleParking();
    case 'charging_query': return handleCharging();
    case 'account_query': return handleAccount(ctx);
    case 'report_help': return handleReport(input, ctx);
    case 'route_forecast': return handleForecast(parsed);
    case 'platform_help': return handlePlatformHelp();
    default: return handleUnknown();
  }
}

/** 输入对应的「处理中」状态文案（不统一显示「正在思考」） */
export function thinkingLabel(input: string): string {
  switch (recognizeIntent(input).intent) {
    case 'route_plan':
    case 'route_compare': return '正在准备路线规划…';
    case 'traffic_query': return '正在查询实时路况…';
    case 'transit_query': return '正在查询公交地铁…';
    case 'parking_query': return '正在查找附近停车场…';
    case 'charging_query': return '正在查找充电站…';
    case 'account_query': return '正在读取你的积分信息…';
    case 'report_help': return '正在处理上报信息…';
    case 'route_forecast': return '正在生成拥堵预测…';
    default: return '正在理解你的需求…';
  }
}

// ===== 路线规划 =====
// 真实计算由 RouteResultPage 的 AMap 三路规划完成，这里不伪造耗时/距离。
function handleRoutePlan(parsed: IntentParseResult, ctx: AssistantContext): AssistantMessage {
  const dest = parsed.destination;
  if (!dest) {
    return msg('可以。你想从哪里出发、去哪里？如果允许，我也可以使用你的当前位置作为起点。');
  }
  const originText = ctx.originName
    ? `已使用你的当前位置「${ctx.originName}」作为起点。`
    : '起点可在规划页选择或定位。';
  return msg(
    `我可以为你规划前往「${dest}」的路线。${originText}路线需要调用高德实时路线数据计算（驾车/公交/骑行/步行多方案），请进入规划页查看具体耗时与拥堵情况。`,
    [{
      id: nextId('c'),
      kind: 'route',
      title: `前往 ${dest}`,
      subtitle: '进入规划页查看多模式方案（高德实时路线数据）',
      source: SRC.real,
      sourceLabel: '高德实时路线',
      actions: [{ label: '去规划路线', path: '/travel', state: { dest }, primary: true }],
    }],
  );
}

// ===== 多方式比较 =====
function handleRouteCompare(parsed: IntentParseResult, ctx: AssistantContext): AssistantMessage {
  const dest = parsed.destination;
  const originText = ctx.originName ? `已使用当前位置「${ctx.originName}」作为起点。` : '';
  return msg(
    `多种出行方式（驾车/公交/骑行/步行）的对比需要调用高德实时路线数据计算，我无法在这里给出准确的耗时。${originText}请进入规划页，系统会并发展示多模式方案供你比较。`,
    [{
      id: nextId('c'),
      kind: 'route',
      title: dest ? `比较到「${dest}」的出行方式` : '比较出行方式',
      subtitle: '规划页并发展示驾车 / 公交 / 骑行 / 步行方案',
      source: SRC.real,
      sourceLabel: '高德实时路线',
      actions: [{ label: '开始比较', path: '/travel', state: dest ? { dest } : undefined, primary: true }],
    }],
  );
}

// ===== 实时路况 =====
interface SnapshotShape {
  cityIndex?: number;
  congestionIndex?: number;
  avgSpeed?: number;
  congestedRoadCount?: number;
  activeAlerts?: number;
  totalRoadCount?: number;
}
interface AlertShape { id: string; title: string; severity?: string; publishTime?: number; time?: number; category?: string; type?: string }

async function handleTraffic(parsed: IntentParseResult): Promise<AssistantMessage> {
  try {
    const [snap, alerts] = await Promise.all([
      apiGet<SnapshotShape>('/traffic/snapshot'),
      apiGet<AlertShape[]>('/traffic/alerts').catch(() => [] as AlertShape[]),
    ]);
    const cityIndex = snap.cityIndex ?? snap.congestionIndex ?? 0;
    const avgSpeed = snap.avgSpeed ?? 0;
    const congested = snap.congestedRoadCount ?? snap.activeAlerts ?? 0;
    const total = snap.totalRoadCount ?? 0;

    const cards: AssistantCard[] = [{
      id: nextId('c'),
      kind: 'forecast',
      title: '北京 · 全市拥堵概览',
      rows: [
        { label: '拥堵指数', value: String(cityIndex), valueColor: cityIndex > 7 ? '#f5222d' : cityIndex > 5 ? '#ff7a00' : '#52c41a' },
        { label: '平均车速', value: `${avgSpeed} km/h` },
        { label: '拥堵路段', value: `${congested}/${total}` },
      ],
      source: SRC.simulated,
      sourceLabel: '模拟数据 · 非官方实时',
    }];

    if (alerts.length > 0) {
      cards.push({
        id: nextId('c'),
        kind: 'info',
        title: '实时交通事件',
        rows: alerts.slice(0, 3).map(a => ({ label: a.title, value: relativeTime(a.publishTime ?? a.time ?? 0) })),
        source: SRC.real,
        sourceLabel: '交通事件数据',
      });
    }

    const roadNote = parsed.destination
      ? `关于「${parsed.destination}」路段的具体实时拥堵，我暂无法提供精确数值，请打开首页地图查看高德实时路况图层。`
      : '具体某条路段的实时拥堵，请打开首页地图查看高德实时路况图层。';
    return msg(`以下为全市拥堵概览（模拟数据，非官方实时）。${roadNote}`, cards);
  } catch {
    return msg('当前实时交通数据暂时无法获取，我不能准确判断此刻的拥堵情况。你可以稍后重试，或先打开首页地图查看高德实时路况图层。');
  }
}

// ===== 公交地铁查询 =====
async function handleTransit(input: string): Promise<AssistantMessage> {
  const q = extractTransitQuery(input);
  try {
    if (q) {
      const results = await searchTransit(q);
      if (results.length === 0) {
        return msg(`没有找到与「${q}」匹配的公交/地铁线路或站点。你可以换个关键词，或进入出行页查看全部线路。`, [{
          id: nextId('c'),
          kind: 'info',
          title: '未找到结果',
          subtitle: `关键词：${q}`,
          source: SRC.real,
          sourceLabel: '公交地铁数据',
          actions: [{ label: '查看全部线路', path: '/travel', primary: true }],
        }]);
      }
      const cards: AssistantCard[] = results.slice(0, 4).map(r => ({
        id: nextId('c'),
        kind: 'transit',
        title: `${r.type === 'line' ? (r.mode === 'metro' ? '🚇' : '🚌') : '📍'} ${r.name}`,
        subtitle: r.subtitle || (r.transferLines?.length ? `换乘 ${r.transferLines.join(' / ')}` : ''),
        source: SRC.real,
        sourceLabel: '公交地铁数据',
        actions: r.type === 'line'
          ? [{ label: '查看详情', path: r.mode === 'bus' ? `/travel/bus/${r.id}` : `/travel/metro/${r.id}`, primary: true }]
          : undefined,
      }));
      return msg(`为你找到与「${q}」相关的线路/站点：`, cards);
    }

    const [busLines, metroLines] = await Promise.all([getBusLines(), getMetroLines()]);
    const cards: AssistantCard[] = [
      {
        id: nextId('c'),
        kind: 'transit',
        title: '公交线路',
        subtitle: `共 ${busLines.length} 条`,
        rows: busLines.slice(0, 3).map(b => ({ label: `🚌 ${b.name}`, value: `${b.from} → ${b.to}` })),
        source: SRC.real,
        sourceLabel: '公交地铁数据',
        actions: [{ label: '查看全部', path: '/travel', primary: true }],
      },
      {
        id: nextId('c'),
        kind: 'transit',
        title: '地铁路线',
        subtitle: `共 ${metroLines.length} 条`,
        rows: metroLines.slice(0, 3).map(m => ({ label: `🚇 ${m.name}`, value: m.stations.slice(0, 4).map(s => s.name).join(' → ') })),
        source: SRC.real,
        sourceLabel: '公交地铁数据',
        actions: [{ label: '查看全部', path: '/travel', primary: true }],
      },
    ];
    return msg('以下是系统内的公交与地铁线路概览（真实线路数据）：', cards);
  } catch {
    return msg('公交地铁数据暂时无法获取，请稍后重试，或进入出行页查看。');
  }
}

function extractTransitQuery(text: string): string {
  // 线路号：300路 / 300 / 1号线 / 10号线
  let m = text.match(/(\d{1,3})\s*(?:路|号线)/);
  if (m) return m[1];
  // 站名（紧跟「几路/到站/换乘」等）
  m = text.match(/([一-龥]{2,12}?)(?:几路|几号线|到站|首末班|换乘|怎么坐|公交|地铁)/);
  if (m?.[1]) return m[1];
  return '';
}

// ===== 停车场 =====
interface ParkingLotShape {
  id: string; name: string; address: string; position: [number, number];
  totalSpots: number; availableSpots: number; price: string; type: string; distance: number; hasCharging: boolean;
}

async function handleParking(): Promise<AssistantMessage> {
  try {
    const lots = await apiGet<ParkingLotShape[]>('/parking/lots');
    if (!lots.length) return msg('当前没有可用的停车场数据，请稍后重试。');
    const cards: AssistantCard[] = lots.slice(0, 3).map(p => ({
      id: nextId('c'),
      kind: 'parking',
      title: p.name,
      subtitle: p.address,
      rows: [
        { label: '空位', value: `${p.availableSpots}/${p.totalSpots}`, valueColor: p.availableSpots / p.totalSpots > 0.3 ? '#52c41a' : p.availableSpots / p.totalSpots > 0.1 ? '#faad14' : '#f5222d' },
        { label: '价格', value: p.price },
        ...(p.hasCharging ? [{ label: '充电', value: '支持 ⚡' }] : []),
      ],
      source: SRC.demo,
      sourceLabel: '演示余位',
      actions: [{ label: '导航至此', path: '/travel/result', state: { origin: '我的位置', destination: p.name, mode: 'drive' }, primary: true }],
    }));
    return msg('为你找到附近的停车场（余位为演示数据，非实时）：', cards);
  } catch {
    return msg('停车场数据暂时无法获取，请稍后重试或进入停车页查看。');
  }
}

// ===== 充电站 =====
interface ChargingStationShape {
  id: string; name: string; address: string; position: [number, number]; operator: string;
  totalPiles: number; availablePiles: number; power: string; price: string; distance: number; status: string;
}

async function handleCharging(): Promise<AssistantMessage> {
  try {
    const stations = await apiGet<ChargingStationShape[]>('/parking/charging');
    if (!stations.length) return msg('当前没有可用的充电站数据，请稍后重试。');
    const cards: AssistantCard[] = stations.slice(0, 3).map(c => ({
      id: nextId('c'),
      kind: 'charging',
      title: c.name,
      subtitle: `${c.address} · ${c.operator}`,
      rows: [
        { label: '空闲桩', value: `${c.availablePiles}/${c.totalPiles}`, valueColor: '#52c41a' },
        { label: '功率', value: c.power },
        { label: '价格', value: c.price },
        ...(c.status === 'offline' ? [{ label: '状态', value: '离线', valueColor: '#f5222d' }] : []),
      ],
      source: SRC.demo,
      sourceLabel: '演示空闲桩',
      actions: [{ label: '扫码充电', path: '/charging/scan', state: { stationId: c.id, stationName: c.name, operator: c.operator, power: c.power, price: c.price, address: c.address }, primary: true }],
    }));
    return msg('为你找到附近的充电站（空闲桩为演示数据，非实时）：', cards);
  } catch {
    return msg('充电站数据暂时无法获取，请稍后重试或进入停车页查看。');
  }
}

// ===== 账户/积分（个人数据，需登录） =====
async function handleAccount(ctx: AssistantContext): Promise<AssistantMessage> {
  if (!ctx.isLoggedIn) {
    return msg('登录后可以查看你的个人积分、碳积分与出行记录。', [{
      id: nextId('c'),
      kind: 'account',
      title: '尚未登录',
      subtitle: '个人数据仅对当前登录用户开放',
      source: SRC.unknown,
      sourceLabel: '个人数据',
      actions: [{ label: '立即登录', path: '/login', primary: true }],
    }]);
  }
  try {
    const data = await apiGet<{ points: number }>('/points');
    return msg('以下是你当前的积分情况（仅当前登录账号）：', [{
      id: nextId('c'),
      kind: 'account',
      title: '我的积分',
      rows: [{ label: '当前积分', value: `${data.points ?? 0} 分`, valueColor: '#1677ff' }],
      source: SRC.real,
      sourceLabel: '账户数据',
      actions: [
        { label: '查看碳积分/兑换', path: '/carbon', primary: true },
        { label: '我的出行', path: '/profile/trips' },
      ],
    }]);
  } catch {
    return msg('积分信息暂时无法获取，请稍后重试。');
  }
}

// ===== 上报/进度 =====
function handleReport(input: string, ctx: AssistantContext): AssistantMessage {
  const personal = /我的|进度|处理(结果|了吗|到哪)/.test(input);
  if (personal && !ctx.isLoggedIn) {
    return msg('登录后可以查看你上报工单的处理进度。你也可以通过「工单查询」免登录查询单条工单。', [{
      id: nextId('c'),
      kind: 'info',
      title: '需要登录',
      subtitle: '个人上报进度仅对当前登录用户开放',
      source: SRC.unknown,
      sourceLabel: '个人数据',
      actions: [
        { label: '立即登录', path: '/login', primary: true },
        { label: '免登录查工单', path: '/report/query' },
      ],
    }]);
  }
  const actions: AssistantCardAction[] = [{ label: '去上报', path: '/report', primary: true }];
  if (personal && ctx.isLoggedIn) actions.push({ label: '我的上报进度', path: '/profile/reports' });
  actions.push({ label: '免登录查工单', path: '/report/query' });
  return msg('你可以通过「事件上报」提交交通问题，并在「我的上报」查看处理进度：', [{
    id: nextId('c'),
    kind: 'info',
    title: '事件上报',
    subtitle: '拍照上报交通问题，工单可追踪处理进度',
    source: SRC.unknown,
    sourceLabel: '平台功能',
    actions,
  }]);
}

// ===== 拥堵预测（模拟，必须标注） =====
async function handleForecast(parsed: IntentParseResult): Promise<AssistantMessage> {
  const mode = parsed.mode || 'drive';
  try {
    const result = await getRouteForecast(mode);
    const rows = result.points.map(p => ({
      label: p.offsetMinutes === 0 ? '现在' : `+${p.offsetMinutes}分钟`,
      value: `${FORECAST_LEVEL_LABEL[p.level]} · 约${p.estimatedDuration}分钟`,
      valueColor: p.level === 'free' ? '#52c41a' : p.level === 'slow' ? '#fadb14' : p.level === 'congested' ? '#ff7a00' : '#f5222d',
    }));
    return msg('以下为基于历史数据的拥堵趋势预测，**非官方实时数据**，仅供参考：', [{
      id: nextId('c'),
      kind: 'forecast',
      title: `${modeLabel(mode)} · 未来拥堵趋势`,
      rows,
      source: SRC.simulated,
      sourceLabel: '模拟预测',
      actions: [{ label: '进入规划页', path: '/travel', primary: true }],
    }]);
  } catch {
    return msg('预测数据暂时无法获取，请稍后重试。');
  }
}

// ===== 平台帮助 / 兜底 =====
function handlePlatformHelp(): AssistantMessage {
  return msg('我是小枢，智途云枢的出行助手。我可以帮你：\n· 规划路线（驾车/公交/骑行/步行）\n· 查询公交地铁线路\n· 查询停车场与充电桩\n· 查看全市拥堵概览\n· 查询个人积分与出行记录（需登录）\n· 上报交通问题并追踪进度', [{
    id: nextId('c'),
    kind: 'info',
    title: '试试这些功能',
    source: SRC.unknown,
    sourceLabel: '平台功能',
    actions: [
      { label: '规划路线', path: '/travel', primary: true },
      { label: '找停车', path: '/parking' },
      { label: '上报问题', path: '/report' },
    ],
  }]);
}

function handleUnknown(): AssistantMessage {
  return msg('我主要帮助你处理城市出行、路线、路况、停车、充电、公交地铁和平台账户相关问题。你可以问我：「去北京南站怎么走？」「附近哪里有停车场？」「我的积分还有多少？」', [{
    id: nextId('c'),
    kind: 'info',
    title: '我可以帮你',
    source: SRC.unknown,
    sourceLabel: '平台功能',
    actions: [
      { label: '规划路线', path: '/travel', primary: true },
      { label: '查看服务', path: '/services' },
    ],
  }]);
}

// ===== 工具 =====
function relativeTime(ts: number): string {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 3600000) return `${Math.max(1, Math.floor(d / 60000))}分钟前`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}小时前`;
  return `${Math.floor(d / 86400000)}天前`;
}
