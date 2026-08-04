import { events, segments, summary, warnings, route as routeRecommendation } from './data'
import type { CitizenBusBooking, CitizenBusBookingRequest, CitizenCommuteLine, CitizenHomeSummary, CitizenSmartPlan, CitizenSmartPlanRequest, CitizenTripMonitor } from '../types'

const peakTimes: Record<string, string> = { beijing: '17:30', xiamen: '17:45', fuzhou: '17:30' }
const lineCatalog: Record<string, CitizenCommuteLine[]> = {
  beijing: [{ line_id: 'line_beijing_core_01', name: '核心区晚高峰接驳线', departure_times: ['17:30', '18:00', '18:30'], remaining_seats: 28 }],
  xiamen: [{ line_id: 'line_xiamen_island_01', name: '岛内外错峰通勤线', departure_times: ['17:45', '18:15', '18:45'], remaining_seats: 32 }],
  fuzhou: [{ line_id: 'line_fuzhou_station_01', name: '站城协同通勤线', departure_times: ['17:30', '18:00', '18:30'], remaining_seats: 25 }],
}

const routeRegistry = new Map<string, CitizenSmartPlan>()
const bookingRegistry = new Set<string>()
const lineSeats = new Map<string, number>()
let routeSequence = 0
let bookingSequence = 0

function getLines(city: string): CitizenCommuteLine[] {
  return (lineCatalog[city] || []).map(line => ({ ...line, departure_times: [...line.departure_times], remaining_seats: lineSeats.get(line.line_id) ?? line.remaining_seats }))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function riskType(segment: { weather_factor: number; event_factor: number }): 'waterlog' | 'accident' | 'congestion' {
  if (segment.weather_factor >= 30) return 'waterlog'
  if (segment.event_factor >= 35) return 'accident'
  return 'congestion'
}

export function citizenCommuteLines(city: string): CitizenCommuteLine[] {
  return getLines(city)
}

export function citizenHomeSummary(city: string): CitizenHomeSummary {
  const citySummary = summary(city)
  const cityWarnings = warnings(city)
  const weatherEvent = events(city).find(event => event.type === 'weather')
  const weatherWarning = cityWarnings.find(item => item.type === 'weather')
  const highEvents = cityWarnings.filter(item => item.level === 'red' || item.level === 'orange').length
  const weatherWarnings = cityWarnings.filter(item => item.type === 'weather').length
  const safety = clamp(Math.round(100 - citySummary.congestion_index * .25 - highEvents * 6 - weatherWarnings * 4), 0, 100)
  const crowded = citySummary.congestion_index >= 60
  return {
    city,
    travel_safety_index: safety,
    weather_notice: weatherWarning?.impact || weatherEvent?.description || '当前暂无显著天气风险',
    peak_notice: `晚高峰预计${peakTimes[city] || '17:30'}开启，建议提早20分钟出行`,
    recommended_transport: crowded || weatherWarning ? ['subway', 'bus'] : ['subway', 'shared_bike'],
    updated_at: new Date().toISOString(),
    data_mode: 'simulation',
  }
}

export function citizenSmartPlan(payload: CitizenSmartPlanRequest): CitizenSmartPlan {
  const selected = routeRecommendation(payload.city, payload.origin, payload.destination)
  const strategyMap = { fastest: 'fastest', congestion_avoid: 'low_congestion', safe_first: 'safe' } as const
  const selectedRoute = selected.items.find(item => item.strategy === strategyMap[payload.preference]) || selected.items[0]
  const citySegments = segments(payload.city)
  const riskSegments = citySegments.filter(segment => segment.congestion_index >= 60 || segment.weather_factor >= 30 || segment.event_factor >= 35)
  const avoided = payload.preference === 'safe_first'
    ? riskSegments.slice(0, 2).map(segment => `已避开${segment.name}天气/事件风险`)
    : riskSegments.slice(0, 1).map(segment => `已识别${segment.name}通行风险`)
  const pathNodes = [payload.origin, ...citySegments.slice(payload.preference === 'fastest' ? 0 : payload.preference === 'congestion_avoid' ? 1 : 2, 4).map(segment => segment.name), payload.destination]
  const routeId = `rt_${payload.city}_${String(++routeSequence).padStart(4, '0')}`
  const plan: CitizenSmartPlan = {
    route_id: routeId,
    city: payload.city,
    strategy: payload.preference,
    total_distance_km: selectedRoute.distance_km,
    estimated_minutes: selectedRoute.estimated_minutes,
    avoided_risks: avoided,
    path_nodes: pathNodes,
    path: selectedRoute.path,
    data_mode: 'simulation',
  }
  routeRegistry.set(routeId, plan)
  return plan
}

export function citizenTripMonitor(routeId: string): CitizenTripMonitor {
  const plan = routeRegistry.get(routeId)
  if (!plan) throw new Error('路线已失效，请重新规划')
  const citySegments = segments(plan.city)
  const cityWarnings = warnings(plan.city)
  const routeRisk = plan.strategy === 'safe_first'
    ? undefined
    : citySegments.find(segment => plan.path_nodes.includes(segment.name) && (segment.congestion_index >= 60 || segment.weather_factor >= 30 || segment.event_factor >= 35))
  const warningRisk = cityWarnings.find(item => item.segment_id && plan.path_nodes.includes(citySegments.find(segment => segment.id === item.segment_id)?.name || ''))
  const riskSegment = routeRisk || (warningRisk ? citySegments.find(segment => segment.id === warningRisk.segment_id) : undefined)
  if (!riskSegment) {
    return { route_id: routeId, has_risk_ahead: false, risk_type: null, description: '当前路线暂无显著风险', reroute_available: false, updated_at: new Date().toISOString(), data_mode: 'simulation' }
  }
  const type = riskType(riskSegment)
  return {
    route_id: routeId,
    has_risk_ahead: true,
    risk_type: type,
    description: `前方${riskSegment.name}存在${type === 'waterlog' ? '天气积水' : type === 'accident' ? '事件扰动' : '拥堵'}风险，建议切换备选路线`,
    reroute_available: plan.strategy !== 'safe_first',
    next_risk_segment: riskSegment.name,
    distance_to_risk_km: 1.5,
    updated_at: new Date().toISOString(),
    data_mode: 'simulation',
  }
}

export function citizenBusBooking(payload: CitizenBusBookingRequest): CitizenBusBooking {
  const city = payload.city || 'beijing'
  if (!payload.user_id.trim()) throw new Error('请输入用户编号')
  const line = getLines(city).find(item => item.line_id === payload.line_id)
  if (!line) throw new Error('当前城市暂无该通勤线路')
  if (!line.departure_times.includes(payload.shift_time)) throw new Error('该线路暂无此班次')
  const bookingKey = `${city}:${payload.user_id}:${payload.line_id}:${payload.shift_time}`
  if (bookingRegistry.has(bookingKey)) throw new Error('该用户已预约此班次')
  const remaining = lineSeats.get(line.line_id) ?? line.remaining_seats
  if (remaining <= 0) throw new Error('当前班次已满')
  bookingRegistry.add(bookingKey)
  lineSeats.set(line.line_id, remaining - 1)
  return { booking_id: `bk_${city}_${String(++bookingSequence).padStart(4, '0')}`, city, user_id: payload.user_id, line_id: payload.line_id, shift_time: payload.shift_time, status: 'confirmed', remaining_seats: remaining - 1, message: '预约成功，请提前10分钟到达候车点', data_mode: 'simulation' }
}
