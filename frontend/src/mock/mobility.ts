import { cities } from './data'
import type { MobilityPoi, MobilityUser, MobilityWeather, SmsChallenge, TaxiEstimate } from '../types'

const categories: Record<string, string[]> = {
  transit: ['地铁换乘站', '公交枢纽'],
  parking: ['智慧停车场', 'P+R停车场'],
  food: ['城市餐饮街区', '便民餐饮中心'],
  hotel: ['城市商务酒店', '交通驿站'],
  hospital: ['城市综合医院', '社区医疗中心'],
  charging: ['新能源充电站', '快速充电中心'],
}
const weather: Record<string, Omit<MobilityWeather, 'city' | 'updated_at' | 'data_mode'>> = {
  beijing: { condition: '阵雨', temperature_c: 27, feels_like_c: 29, humidity: 72, wind: '东南风 3级', visibility_km: 8, advice: '午后短时降雨，慢行出行注意路面湿滑。' },
  xiamen: { condition: '多云有阵雨', temperature_c: 30, feels_like_c: 33, humidity: 78, wind: '东风 4级', visibility_km: 10, advice: '跨岛通道侧风较强，骑行请降低速度。' },
  fuzhou: { condition: '中雨', temperature_c: 28, feels_like_c: 31, humidity: 84, wind: '东北风 2级', visibility_km: 6, advice: '低洼路段存在积水风险，优先选择公共交通。' },
}
const smsCodes = new Map<string, string>()

function profile(city: string) {
  const result = cities.find(item => item.code === city)
  if (!result) throw new Error('暂不支持该城市')
  return result
}

function distanceKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }) {
  const dx = (a.lng - b.lng) * 111 * Math.cos(a.lat * Math.PI / 180)
  const dy = (a.lat - b.lat) * 111
  return Math.sqrt(dx * dx + dy * dy)
}

function catalog(city: string): MobilityPoi[] {
  const current = profile(city)
  const base = current.pois.map(item => ({ ...item, category: 'landmark', address: `${current.name}重点区域` }))
  let index = 0
  const generated = Object.entries(categories).flatMap(([category, names]) => names.map(name => {
    index += 1
    return {
      id: `${city}-${category}-${index}`, name, category,
      address: `${current.districts[index % current.districts.length]}示范点`,
      lng: Number((current.center.lng + ((index % 4) - 1.5) * .009).toFixed(6)),
      lat: Number((current.center.lat + ((index % 3) - 1) * .008).toFixed(6)),
    }
  }))
  return [...base, ...generated]
}

export function mobilitySearch(city: string, query: string) {
  const keyword = query.trim().toLowerCase()
  return catalog(city).filter(item => item.name.toLowerCase().includes(keyword) || item.address.toLowerCase().includes(keyword)).slice(0, 10)
}

export function mobilityNearby(city: string, lng: number, lat: number, category = 'all') {
  return catalog(city)
    .filter(item => category === 'all' || item.category === category)
    .map(item => {
      const distance = distanceKm({ lng, lat }, item)
      return { ...item, distance_km: Number(distance.toFixed(2)), walking_minutes: Math.max(1, Math.round(distance / 4.5 * 60)) }
    })
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 12)
}

export function mobilityWeather(city: string): MobilityWeather {
  return { city, ...weather[city], updated_at: new Date().toISOString(), data_mode: 'simulation' }
}

export function mobilityTaxi(city: string, origin: { lng: number; lat: number }, destination: { lng: number; lat: number }): TaxiEstimate {
  const distance = Math.max(.8, distanceKm(origin, destination) * 1.25)
  return { city, distance_km: Number(distance.toFixed(1)), estimated_minutes: Math.max(4, Math.round(distance / 28 * 60 + 3)), estimated_fare_yuan: Number((13 + Math.max(0, distance - 3) * 2.4).toFixed(1)), surge_level: 'normal', data_mode: 'simulation' }
}

export function requestSms(phone: string): SmsChallenge {
  const code = '246810'
  smsCodes.set(phone, code)
  return { challenge_id: `sms-${phone.slice(-4)}`, expires_in_seconds: 300, demo_code: code, data_mode: 'simulation' }
}

export function verifySms(phone: string, code: string): MobilityUser {
  if (smsCodes.get(phone) !== code) throw new Error('验证码无效或已过期')
  smsCodes.delete(phone)
  return { user_id: `user-${phone.slice(-6)}`, masked_phone: `${phone.slice(0, 3)}****${phone.slice(-4)}`, display_name: '智途用户', token: `demo-session-${phone.slice(-6)}`, data_mode: 'simulation' }
}
