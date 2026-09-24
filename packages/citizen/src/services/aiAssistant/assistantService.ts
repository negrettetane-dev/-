// ===== 智途云枢 · 小枢出行助手 核心服务 =====
// 职责：意图 → 调用真实业务 Service/API → 组装可信回复（文本 + 结构化卡片 + 来源标识）。
// 原则：
//   1. 只调用真实存在的 Service/API，不伪造事实数据；
//   2. 模拟/演示/预测数据必须显式标注；
//   3. 个人数据查询必须基于登录态（未登录不调用个人接口）；
//   4. API 失败时返回明确错误类型，不编造结果。

import { apiGet } from '../apiClient';
import { aiChat } from '../aiChatService';
import { recognizeIntent } from './intentRouter';
import { searchTransit, getBusLines, getMetroLines } from '../transitService';
import { getRouteForecast } from '../routeForecastService';
import { buildTransitRouteOptions, planRouteCandidates, planTransitCandidates, resolveRouteLocations } from '../routePlanningService';
import { buildAccessibleOptions, computeAccessibleMetrics, type AccessibilityPreference } from '../accessibilityService';
import { getFacilityForStation, getFacilitySource, loadAccessibilityFacilities } from '../../data/accessibilityFacilities';
import { FORECAST_LEVEL_LABEL } from '../../types/routeForecast';
import { formatPrice } from '../../utils/price';
import type { PriceValue } from '../../types/price';
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
  const routeMetric = extractRouteMetricQuery(input);
  if (routeMetric) return handleRouteMetric(routeMetric, input);
  const parsed = withConversationContext(input, ctx);
  if (isExplicitRouteRequest(input, parsed)) {
    return handleRouteDecisionShell(input, parsed, ctx);
  }
  if (isRouteDecisionRequest(input) || isRoutePreferenceFollowUp(input, parsed, ctx)) {
    return handleRouteDecisionShell(input, parsed, ctx);
  }
  if (isRouteFollowUp(input, parsed, ctx)) {
    if (parsed.mode === 'bus' && parsed.origin && parsed.destination) {
      return handleTransit(`从${parsed.origin}到${parsed.destination}有没有公交地铁方案`);
    }
    return handleRouteDecisionShell(input, parsed, ctx);
  }
  switch (parsed.intent) {
    case 'route_plan': return handleRouteDecisionShell(input, parsed, ctx);
    case 'route_compare': return handleRouteDecisionShell(input, parsed, ctx);
    case 'traffic_query': return handleTraffic(parsed);
    case 'transit_query': return handleTransit(input);
    case 'parking_query': return handleParking();
    case 'charging_query': return handleCharging();
    case 'account_query': return handleAccount(ctx);
    case 'report_help': return handleReport(input, ctx);
    case 'route_forecast': return handleForecast(parsed);
    case 'platform_help': return handlePlatformHelp();
    default: return handleUnknown(input, ctx);
  }
}

function isExplicitRouteRequest(input: string, parsed: IntentParseResult): boolean {
  if (!parsed.origin || !parsed.destination) return false;
  return /怎么走|怎么去|如何去|路线|规划|导航|出发|前往|开车|驾车|自驾|坐车|骑行|步行/.test(input);
}

function withConversationContext(input: string, ctx: AssistantContext): IntentParseResult {
  const current = recognizeIntent(input);
  const inherited: Partial<IntentParseResult> = {};
  const previousUserMessages = (ctx.conversation || []).filter(message => message.role === 'user').reverse();
  for (const message of previousUserMessages) {
    const previous = recognizeIntent(message.content);
    inherited.destination ||= previous.destination;
    inherited.origin ||= previous.origin;
    inherited.mode ||= previous.mode;
    inherited.targetTime ||= previous.targetTime;
    if (inherited.destination && inherited.origin && inherited.mode && inherited.targetTime) break;
  }
  return {
    ...current,
    destination: current.destination || inherited.destination,
    origin: current.origin || inherited.origin || ctx.originName,
    mode: current.mode || inherited.mode,
    targetTime: current.targetTime || inherited.targetTime,
  };
}

function isRouteFollowUp(input: string, parsed: IntentParseResult, ctx: AssistantContext): boolean {
  if (!parsed.destination || !(ctx.conversation || []).some(message => message.role === 'user')) return false;
  return /(地铁|公交|开车|驾车|骑行|步行|走路).{0,8}(方案|可以|行吗|有没有|怎么走|呢)|(?:换成|改成|那)(地铁|公交|开车|驾车|骑行|步行)|^(地铁|公交|开车|驾车|骑行|步行)(呢|可以吗)?[？?]?$/i.test(input.trim());
}

function isRoutePreferenceFollowUp(input: string, parsed: IntentParseResult, ctx: AssistantContext): boolean {
  if (!parsed.destination || !(ctx.conversation || []).some(message => message.role === 'user')) return false;
  return /^(?:那)?(?:再)?(?:更|要|想要|改成)?(?:快|便宜|低碳|环保|少走路|少步行|少换乘|不换乘|无障碍)(?:一点|一些|优先|的方案|呢|可以吗)?[，。！？?\s]*$/.test(input.trim());
}

function isRouteDecisionRequest(input: string): boolean {
  return /(无障碍|老人|轮椅|视障|听障|婴儿车|少走路|少换乘|不换乘|低碳|环保|便宜|费用优先|时间优先|不想堵车|确认条件并生成方案)/.test(input)
    && /(去|到|路线|方案|出行|确认条件并生成方案)/.test(input);
}

async function handleRouteDecisionShell(input: string, parsed: IntentParseResult, ctx: AssistantContext): Promise<AssistantMessage> {
  const isConfirmed = input.includes('确认条件并生成方案');
  const destination = parsed.destination || '目的地待确认';
  const traveler = input.includes('无障碍出行（轮椅推车用户推荐）') ? '无障碍出行（轮椅推车用户推荐）'
    : /轮椅/.test(input) ? '轮椅用户'
    : /(无障碍|电梯|行李|行李箱|拖箱|拉杆箱|推车|婴儿车)/.test(input) ? '无障碍出行（轮椅推车用户推荐）'
    : /省力|老人|老年|长辈/.test(input) ? '省力出行（长辈推荐）'
      : /视障/.test(input) ? '视障用户' : '普通用户';
  const priorities = [
    /快|时间优先/.test(input) && '时间优先',
    /便宜|费用优先/.test(input) && '费用优先',
    /低碳|环保/.test(input) && '低碳优先',
    /少走路/.test(input) && '少步行',
    /少换乘|不换乘/.test(input) && '少换乘',
    /电梯|行李/.test(input) && '电梯优先',
    traveler === '省力出行（长辈推荐）' ? '省力优先' : traveler !== '普通用户' && '无障碍优先',
  ].filter(Boolean).join('、') || '综合均衡';

  if (!isConfirmed) {
    return msg('我先把这次出行条件整理出来。请确认或继续补充，确认后再进入路线规划。', [{
      id: nextId('c'),
      kind: 'condition',
      title: '出行条件确认',
      subtitle: '本次临时需求 · 不会覆盖长期偏好',
      rows: [
        { label: '起点', value: parsed.origin || ctx.originName || '使用当前位置' },
        { label: '目的地', value: destination },
        { label: '优先条件', value: priorities },
        { label: '出发时间', value: parsed.targetTime || '现在' },
      ],
      source: SRC.unknown,
      sourceLabel: 'AI 条件识别 · 待确认',
      editor: {
        origin: parsed.origin || ctx.originName || '',
        destination,
        traveler,
        priorities,
        travelerOptions: ['普通用户', '无障碍出行（轮椅推车用户推荐）', '省力出行（长辈推荐）', '轮椅用户', '视障用户'],
      },
      actions: [
        { label: '确认并生成方案', prompt: `确认条件并生成方案：从${parsed.origin || ctx.originName || '当前位置'}去${destination}，${traveler}，${priorities}`, promptTemplate: '确认条件并生成方案：从{origin}去{destination}，{traveler}，{priorities}', primary: true },
        { label: '改为少走路', prompt: `去${destination}，${traveler}，少走路并尽量少换乘`, promptTemplate: '从{origin}去{destination}，{traveler}，少走路并尽量少换乘' },
        { label: '改为低碳优先', prompt: `去${destination}，${traveler}，低碳优先`, promptTemplate: '从{origin}去{destination}，{traveler}，低碳优先' },
      ],
    }]);
  }

  const origin = parsed.origin || ctx.originName || '当前位置';
  let resolved: { start: [number, number]; end: [number, number] };
  try {
    resolved = await resolveRouteLocations(origin, destination);
  } catch {
    return msg('起点或目的地暂时无法解析，无法生成真实路线。请检查地点名称或先完成定位。');
  }

  const [driveResult, transitResult, bikeResult, walkResult] = await Promise.allSettled([
    planRouteCandidates('drive', resolved.start, resolved.end),
    planTransitCandidates(resolved.start, resolved.end),
    planRouteCandidates('bike', resolved.start, resolved.end),
    planRouteCandidates('walk', resolved.start, resolved.end),
  ]);
  const driveCandidates = driveResult.status === 'fulfilled' ? driveResult.value : [];
  const transitCandidates = transitResult.status === 'fulfilled' ? transitResult.value : [];
  const bikeCandidates = bikeResult.status === 'fulfilled' ? bikeResult.value : [];
  const walkCandidates = walkResult.status === 'fulfilled' ? walkResult.value : [];
  const accessibilityPreference: AccessibilityPreference[] | undefined = traveler === '视障用户'
    ? ['visual']
    : traveler === '无障碍出行（轮椅推车用户推荐）'
      ? ['wheelchair']
      : traveler === '轮椅用户'
        ? ['wheelchair']
        : undefined;
  const preferredRoute = accessibilityPreference
    ? buildAccessibleOptions(transitCandidates, accessibilityPreference)[0]?.route
    : undefined;
  const preferredTransit = traveler === '省力出行（长辈推荐）'
    ? [...transitCandidates].sort((left, right) =>
      left.walkingDistance - right.walkingDistance ||
      left.transferCount - right.transferCount ||
      left.route.duration - right.route.duration,
    )[0]
    : transitCandidates.find(candidate => candidate.route === preferredRoute);
  const transitOptions = buildTransitRouteOptions(transitCandidates);
  const fastestDrive = [...driveCandidates].sort((a, b) => a.route.duration - b.route.duration)[0]?.route;
  const fastestBike = [...bikeCandidates].sort((a, b) => a.route.duration - b.route.duration)[0]?.route;
  const fastestWalk = [...walkCandidates].sort((a, b) => a.route.duration - b.route.duration)[0]?.route;
  const transit = preferredTransit || transitOptions[0];
  const formatDuration = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} 分钟`;
  const formatDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} 公里` : `${Math.round(meters)} 米`;
  const congestion = (route: { congestionSegments?: { level: string; ratio: number }[] }) => {
    const segments = route.congestionSegments || [];
    if (!segments.length) return '暂无实时拥堵明细';
    const ratio = segments.filter(segment => segment.level !== 'free').reduce((sum, segment) => sum + segment.ratio, 0);
    return ratio >= 0.5 ? '高' : ratio >= 0.2 ? '中' : '低';
  };
  const planCards: AssistantCard[] = [];
  if (fastestDrive) {
    const driveRows = [
      { label: '预计用时', value: formatDuration(fastestDrive.duration) },
      { label: '总距离', value: formatDistance(fastestDrive.distance) },
      { label: '拥堵风险', value: congestion(fastestDrive) },
      { label: '预计碳排放', value: '较高 · 模型估算' },
    ];
    planCards.push({ id: nextId('c'), kind: 'route', title: '驾车方案', subtitle: `前往${destination} · 高德实时路线`, rows: driveRows, source: SRC.real, sourceLabel: '路线业务服务', actions: [{ label: '查看驾车方案', path: buildPlannerPath({ ...parsed, destination, mode: 'drive' }), primary: true }] });
    planCards.push({ id: nextId('c'), kind: 'route', title: '新能源方案', subtitle: `前往${destination} · 沿用实时驾车路线并叠加新能源服务`, rows: driveRows.map(row => row.label === '预计碳排放' ? { ...row, value: '较低 · 模型估算' } : row), source: SRC.real, sourceLabel: '路线与充电服务', actions: [{ label: '查看新能源方案', path: buildPlannerPath({ ...parsed, destination, mode: 'drive' }), state: { profile: 'ev' }, primary: true }] });
  }
  if (transit) {
    planCards.push({ id: nextId('c'), kind: 'route', title: '公交/地铁方案', subtitle: `前往${destination} · 高德实时公交方案`, rows: [
      { label: '预计用时', value: formatDuration(transit.route.duration) },
      { label: '总距离', value: formatDistance(transit.route.distance) },
      { label: '预计费用', value: `${transit.route.cost || 0} 元` },
      { label: '步行距离', value: formatDistance(transit.walkingDistance) },
      { label: '换乘次数', value: `${transit.transferCount} 次` },
      { label: '拥堵风险', value: '低（公共交通）' },
    ], source: SRC.real, sourceLabel: '公交路线业务服务', actions: [{ label: '采用此方案', path: buildPlannerPath({ ...parsed, destination, mode: 'bus' }), primary: true }, { label: '我更在意价格', prompt: `去${destination}，费用优先` }, { label: '我不想换乘', prompt: `去${destination}，不要换乘` }] });
  }
  if (fastestBike) {
    planCards.push({ id: nextId('c'), kind: 'route', title: '骑行方案', subtitle: `前往${destination} · 高德实时骑行路线`, rows: [
      { label: '预计用时', value: formatDuration(fastestBike.duration) },
      { label: '总距离', value: formatDistance(fastestBike.distance) },
      { label: '碳排放', value: '低' },
    ], source: SRC.real, sourceLabel: '高德骑行路线服务', actions: [{ label: '查看骑行方案', path: buildPlannerPath({ ...parsed, destination, mode: 'bike' }), primary: true }] });
  }
  if (fastestWalk) {
    planCards.push({ id: nextId('c'), kind: 'route', title: '步行方案', subtitle: `前往${destination} · 高德实时步行路线`, rows: [
      { label: '预计用时', value: formatDuration(fastestWalk.duration) },
      { label: '总距离', value: formatDistance(fastestWalk.distance) },
      { label: '碳排放', value: '低' },
    ], source: SRC.real, sourceLabel: '高德步行路线服务', actions: [{ label: '查看步行方案', path: buildPlannerPath({ ...parsed, destination, mode: 'walk' }), primary: true }] });
  }
  if (traveler !== '普通用户' || /电梯|行李/.test(input)) {
    await loadAccessibilityFacilities();
    const metrics = transit ? computeAccessibleMetrics(transit.segments) : null;
    const backendFacilities = metrics && getFacilitySource() === 'backend';
    const restrooms = backendFacilities ? metrics.stationNames.filter(name => getFacilityForStation(name)?.accessibleRestroom).length : 0;
    planCards.push({ id: nextId('c'), kind: 'accessibility', title: '无障碍风险检查', subtitle: backendFacilities ? `${traveler} · 后端设施数据` : `${traveler} · 设施状态待确认`, rows: backendFacilities ? [
      { label: '电梯覆盖站点', value: `${Math.round(metrics.elevatorCoverage * metrics.stationNames.length)}/${metrics.stationNames.length}` },
      { label: '楼梯风险入口', value: `${metrics.stairsRiskCount} 处`, valueColor: metrics.stairsRiskCount ? '#f5222d' : '#389e0d' },
      { label: '无障碍卫生间', value: `${restrooms} 个途经站点` },
      { label: '设施待确认站点', value: `${metrics.unknownFacilityCount} 个`, valueColor: metrics.unknownFacilityCount ? '#d46b08' : '#389e0d' },
      { label: '步行距离', value: formatDistance(metrics.walkingDistance) },
      { label: '换乘次数', value: `${metrics.transferCount} 次` },
    ] : [
      { label: '步行距离', value: transit ? formatDistance(transit.walkingDistance) : '暂无公交路线数据' },
      { label: '换乘次数', value: transit ? `${transit.transferCount} 次` : '暂无公交路线数据' },
      { label: '设施状态', value: '后端数据未成功加载，待确认', valueColor: '#d46b08' },
    ], source: backendFacilities ? SRC.real : SRC.unknown, sourceLabel: backendFacilities ? '无障碍设施服务' : '无障碍设施服务 · 待确认', actions: [{ label: '按无障碍条件重规划', prompt: `去${destination}，按${traveler}无障碍条件重新规划` }] });
  }
  if (!planCards.length) return msg('当前起点和目的地暂未返回可用的真实路线，请检查地点、定位和地图服务配置后重试。');

  const rankedCards = [...planCards].sort((left, right) => {
    const rank = (card: AssistantCard): number => {
      const title = card.title;
      if (/(无障碍|电梯|行李)/.test(input) || traveler !== '普通用户') {
        if (card.kind === 'accessibility') return -1;
      }
      if (/快|尽量快|时间优先|不想堵车/.test(input)) {
        if (card.kind === 'accessibility') return 99;
        const durationRow = card.rows?.find(row => row.label === '预计用时');
        const durationMinutes = durationRow ? Number.parseFloat(durationRow.value) : Number.POSITIVE_INFINITY;
        return Number.isFinite(durationMinutes) ? durationMinutes : 98;
      }
      if (/低碳|环保/.test(input)) {
        if (/公交|地铁/.test(title)) return 0;
        if (/新能源/.test(title)) return 2;
        if (/驾车/.test(title)) return 3;
      }
      if (/便宜|费用优先|少换乘|不换乘/.test(input)) {
        if (/公交|地铁/.test(title)) return 0;
        if (/新能源/.test(title)) return 2;
        if (/驾车/.test(title)) return 3;
      }
      return /AI 推荐/.test(title) ? 0 : /无障碍/.test(title) ? 1 : 2;
    };
    return rank(left) - rank(right);
  });

  const highlightedCards = rankedCards.map((card, index) => index === 0
    ? { ...card, title: card.title.startsWith('AI 推荐') ? card.title : `AI 推荐 · ${card.title}`, subtitle: `${card.subtitle || ''} · 已按${priorities}排序` }
    : card);
  return msg('已根据你的条件生成多模式出行方案。推荐顺序已按你的优先条件排序；碳排放为模型估算，设施状态以业务服务返回结果为准。', highlightedCards);
}

type RouteMetric = 'walking' | 'transfer' | 'duration' | 'distance' | 'cost';

async function handleRouteMetric(query: { origin: string; destination: string; metric: RouteMetric }, input: string): Promise<AssistantMessage> {
  try {
    const { start, end } = await resolveRouteLocations(query.origin, query.destination);
    const [driveResult, transitResult] = await Promise.allSettled([
      planRouteCandidates('drive', start, end),
      planTransitCandidates(start, end),
    ]);
    const drive = driveResult.status === 'fulfilled' ? [...driveResult.value].sort((a, b) => a.route.duration - b.route.duration)[0]?.route : undefined;
    const transit = transitResult.status === 'fulfilled' ? buildTransitRouteOptions(transitResult.value)[0] : undefined;
    const formatDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} 公里` : `${Math.round(meters)} 米`;
    const formatDuration = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} 分钟`;
    const cards: AssistantCard[] = [];
    if (query.metric === 'walking' || query.metric === 'transfer' || query.metric === 'cost') {
      if (transit) cards.push({ id: nextId('c'), kind: 'transit', title: '公交/地铁真实指标', subtitle: `从${query.origin}到${query.destination}`, rows: [
        ...(query.metric === 'walking' ? [{ label: '步行距离', value: formatDistance(transit.walkingDistance) }] : []),
        ...(query.metric === 'transfer' ? [{ label: '换乘次数', value: `${transit.transferCount} 次` }] : []),
        ...(query.metric === 'cost' ? [{ label: '预计费用', value: `${transit.route.cost || 0} 元` }] : []),
        { label: '预计用时', value: formatDuration(transit.route.duration) },
      ], source: SRC.real, sourceLabel: '高德公交路线服务', actions: [{ label: '查看完整路线', path: buildPlannerPath({ intent: 'transit_query', origin: query.origin, destination: query.destination, mode: 'bus' }), primary: true }] });
    } else if (drive) {
      cards.push({ id: nextId('c'), kind: 'route', title: '驾车真实指标', subtitle: `从${query.origin}到${query.destination}`, rows: [
        ...(query.metric === 'duration' ? [{ label: '预计用时', value: formatDuration(drive.duration) }] : []),
        ...(query.metric === 'distance' ? [{ label: '总距离', value: formatDistance(drive.distance) }] : []),
      ], source: SRC.real, sourceLabel: '高德驾车路线服务', actions: [{ label: '查看完整路线', path: buildPlannerPath({ intent: 'route_plan', origin: query.origin, destination: query.destination, mode: 'drive' }), primary: true }] });
    }
    return cards.length ? msg(`已查询「${input}」对应的真实路线指标：`, cards) : msg('当前没有返回该指标的真实路线数据，请检查起点、目的地或稍后重试。');
  } catch {
    return msg('当前无法获取该指标的真实路线数据，请检查起点、目的地或稍后重试。');
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
      source: SRC.real,
      sourceLabel: '交通运行服务',
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
    return msg(`以下为全市拥堵概览。${roadNote}`, cards);
  } catch {
    return msg('当前实时交通数据暂时无法获取，我不能准确判断此刻的拥堵情况。你可以稍后重试，或先打开首页地图查看高德实时路况图层。');
  }
}

// ===== 公交地铁查询 =====
async function handleTransit(input: string): Promise<AssistantMessage> {
  const transitRoute = extractTransitRouteQuery(input);
  const q = extractTransitQuery(input);
  try {
    if (transitRoute) {
      const { origin, destination } = transitRoute;
      const { start, end } = await resolveRouteLocations(origin, destination);
      const candidates = await planTransitCandidates(start, end);
      const option = buildTransitRouteOptions(candidates)[0];
      if (!option) return msg(`暂未找到从「${origin}」到「${destination}」的真实公交/地铁方案。`);
      return msg(`已查询从「${origin}」到「${destination}」的真实公交/地铁方案：`, [{
        id: nextId('c'),
        kind: 'transit',
        title: `${option.icon} 公交/地铁路线`,
        subtitle: '高德实时公交规划结果',
        rows: [
          { label: '预计用时', value: `${Math.max(1, Math.round(option.route.duration / 60))} 分钟` },
          { label: '换乘次数', value: `${option.transferCount} 次` },
          { label: '步行距离', value: option.walkingDistance >= 1000 ? `${(option.walkingDistance / 1000).toFixed(1)} 公里` : `${Math.round(option.walkingDistance)} 米` },
          { label: '预计费用', value: `${option.route.cost || 0} 元` },
        ],
        source: SRC.real,
        sourceLabel: '高德公交路线服务',
        actions: [{ label: '查看完整路线', path: buildPlannerPath({ intent: 'transit_query', origin, destination, mode: 'bus' }), primary: true }],
      }]);
    }
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

function extractTransitRouteQuery(text: string): { origin: string; destination: string } | null {
  const match = text.match(/从\s*(.+?)\s*(?:到|去)\s*(.+?)(?=的?(?:步行距离|走路距离|总距离|全程距离|多少公里|换乘次数|换乘|费用|多少钱|价格|预计用时|用时|多久|需要多久|多长时间|要多久|路线|怎么走|怎么坐)|$)/);
  if (!match) return null;
  const origin = match[1].replace(/(?:开|出发)\s*$/g, '').replace(/[，,。！？?\s]+$/g, '').trim();
  const destination = match[2].replace(/[，,。！？?\s]+$/g, '').trim();
  return origin && destination ? { origin, destination } : null;
}

function extractRouteMetricQuery(text: string): { origin: string; destination: string; metric: RouteMetric } | null {
  const route = extractTransitRouteQuery(text);
  if (!route) return null;
  const metric = /步行距离|走路距离/.test(text)
    ? 'walking'
    : /换乘次数|换几次|换乘/.test(text)
      ? 'transfer'
      : /费用|多少钱|价格/.test(text)
        ? 'cost'
        : /总距离|全程距离|多少公里/.test(text)
          ? 'distance'
          : /预计用时|需要多久|多长时间|要多久/.test(text)
            ? 'duration'
            : null;
  return metric ? { ...route, metric } : null;
}

// ===== 停车场 =====
interface ParkingLotShape {
  id: string; name: string; address: string; position: [number, number];
  totalSpots: number; availableSpots: number; price: PriceValue; type: string; distance: number; hasCharging: boolean;
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
        { label: '价格', value: formatPrice(p.price) },
        ...(p.hasCharging ? [{ label: '充电', value: '支持 ⚡' }] : []),
      ],
      source: SRC.real,
      sourceLabel: '停车服务',
      actions: [{ label: '导航至此', path: '/travel/result', state: { origin: '我的位置', destination: p.name, mode: 'drive' }, primary: true }],
    }));
    return msg('为你找到附近的停车场：', cards);
  } catch {
    return msg('停车场数据暂时无法获取，请稍后重试或进入停车页查看。');
  }
}

// ===== 充电站 =====
interface ChargingStationShape {
  id: string; name: string; address: string; position: [number, number]; operator: string;
  totalPiles: number; availablePiles: number; power: string; price: PriceValue; distance: number; status: string;
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
        { label: '价格', value: formatPrice(c.price) },
        ...(c.status === 'offline' ? [{ label: '状态', value: '离线', valueColor: '#f5222d' }] : []),
      ],
      source: SRC.real,
      sourceLabel: '充电服务',
      actions: [{ label: '扫码充电', path: '/charging/scan', state: { stationId: c.id, stationName: c.name, operator: c.operator, power: c.power, price: c.price, address: c.address }, primary: true }],
    }));
    return msg('为你找到附近的充电站：', cards);
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
  const actions: AssistantCardAction[] = [{
    label: '填写并确认上报',
    path: '/report',
    primary: true,
    requiresConfirmation: true,
    confirmTitle: '开始填写事件上报？',
    confirmDescription: '当前仅进入上报填写页，不会直接提交。后端接入后，正式提交工单仍需再次确认。',
  }];
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
      actions: [{ label: '进入规划页', path: '/', primary: true }],
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
      { label: '规划路线', path: '/', primary: true },
      { label: '找停车', path: '/parking' },
      { label: '上报问题', path: '/report' },
    ],
  }]);
}

function handleUnknown(input: string, ctx: AssistantContext): Promise<AssistantMessage> {
  // 工具类意图已在前面处理（走真实 Service，不编造数据）。
  // 识别不到意图的开放问题，交给大模型自然回复；失败回退到能力说明。
  return aiChat([...(ctx.conversation || []), { role: 'user', content: input }], ctx.conversationId)
    .then(content => msg(content))
    .catch(() => msg('我主要帮助你处理城市出行、路线、路况、停车、充电、公交地铁和平台账户相关问题。你可以问我：「去北京南站怎么走？」「附近哪里有停车场？」「我的积分还有多少？」', [{
      id: nextId('c'),
      kind: 'info',
      title: '我可以帮你',
      source: SRC.unknown,
      sourceLabel: '平台功能',
      actions: [
        { label: '规划路线', path: '/', primary: true },
        { label: '查看服务', path: '/services' },
      ],
    }]));
}

// ===== 工具 =====
function buildPlannerPath(parsed: IntentParseResult): string {
  const params = new URLSearchParams();
  if (parsed.destination) params.set('destination', parsed.destination);
  if (parsed.origin) params.set('origin', parsed.origin);
  const mode = parsed.mode === 'bus'
    ? 'transit'
    : parsed.mode === 'bike'
      ? 'riding'
      : parsed.mode === 'walk'
        ? 'walking'
        : 'driving';
  params.set('mode', mode);
  return `/?${params.toString()}`;
}

function relativeTime(ts: number): string {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 3600000) return `${Math.max(1, Math.floor(d / 60000))}分钟前`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}小时前`;
  return `${Math.floor(d / 86400000)}天前`;
}
