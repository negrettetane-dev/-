// ===== 智途云枢 · 定位服务 =====
// 优先使用高德 Geolocation（GCJ-02 坐标系），降级浏览器定位。
// 逆地理编码使用高德 Geocoder。

import { loadAMap } from '../lib/amap';
import type { UnifiedLocation } from '../stores/travelLocationStore';

export interface LocatedPosition {
  lng: number;
  lat: number;
  accuracy?: number;
}

export interface ResolvedLocation extends LocatedPosition {
  address: string;
  source: 'geolocation' | 'map';
  city?: string;
  adcode?: string;
}

export interface GeocodedLocation extends LocatedPosition {
  name: string;
  address: string;
  city?: string;
  adcode?: string;
}

export interface ReverseGeocodeResult {
  address: string;
  city?: string;
  adcode?: string;
}

/** 高德定位：优先（GCJ-02，与高德地图一致） */
function locateWithAMap(timeout = 10000): Promise<LocatedPosition> {
  return loadAMap().then((AMap: any) => new Promise<LocatedPosition>((resolve, reject) => {
    const geolocation = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout,
      maximumAge: 0,
      convert: true,
      showButton: false,
      showMarker: false,
      showCircle: false,
    });
    geolocation.getCurrentPosition((status: string, result: any) => {
      if (status === 'complete' && result?.position) {
        resolve({
          lng: Number(result.position.lng),
          lat: Number(result.position.lat),
          accuracy: result.accuracy,
        });
      } else {
        reject(new Error(result?.message || '定位失败'));
      }
    });
  }));
}

/** 浏览器定位：降级（WGS84，可能略有偏移） */
function locateWithBrowser(timeout = 10000): Promise<LocatedPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('browser-unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lng: pos.coords.longitude, lat: pos.coords.latitude, accuracy: pos.coords.accuracy });
      },
      (err) => {
        reject(new Error(err.code === 1 ? 'permission-denied' : err.code === 3 ? 'timeout' : '定位失败'));
      },
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    );
  });
}

/** 获取当前位置：高德优先，浏览器降级 */
export function getCurrentLocation(timeout = 10000): Promise<LocatedPosition> {
  return locateWithAMap(timeout).catch(() => locateWithBrowser(timeout));
}

/** 逆地理编码：坐标 → 地址 */
export function reverseGeocode(lng: number, lat: number): Promise<string> {
  return loadAMap().then((AMap: any) => new Promise<string>((resolve, reject) => {
    const geocoder = new AMap.Geocoder();
    geocoder.getAddress([lng, lat], (status: string, result: any) => {
      const address = result?.regeocode?.formattedAddress;
      if (status === 'complete' && address) {
        resolve(address);
      } else {
        reject(new Error('geocode-failed'));
      }
    });
  }));
}

/**
 * 地点候选搜索：用高德 PlaceSearch 做真实 POI 搜索，返回多个候选（用于长辈模式选点）。
 * 不用固定坐标表冒充真实搜索结果。
 */
export function searchLocationCandidates(
  query: string,
  opts: { city?: string; pageSize?: number } = {},
): Promise<UnifiedLocation[]> {
  const keyword = query.trim();
  if (!keyword) return Promise.reject(new Error('empty-location'));
  const city = opts.city || '北京';
  const pageSize = opts.pageSize || 5;

  return loadAMap().then((AMap: any) => new Promise<UnifiedLocation[]>((resolve, reject) => {
    AMap.plugin(['AMap.PlaceSearch'], () => {
      const placeSearch = new AMap.PlaceSearch({ city, pageSize, pageIndex: 1 });
      placeSearch.search(keyword, (status: string, result: any) => {
        const pois = result?.poiList?.pois;
        if (status !== 'complete' || !Array.isArray(pois) || pois.length === 0) {
          reject(new Error('location-not-found'));
          return;
        }
        const list = pois
          .map((p: any): UnifiedLocation | null => {
            const lng = Number(p?.location?.lng);
            const lat = Number(p?.location?.lat);
            if (!isValidCoord(lng, lat)) return null;
            return {
              name: String(p.name || keyword),
              address: String(p.address || p.pname + p.cityname + p.adname || ''),
              lng,
              lat,
              city: p.cityname ? String(p.cityname) : undefined,
              adcode: p.adcode ? String(p.adcode) : undefined,
              source: 'poi-search',
            };
          })
          .filter((item: UnifiedLocation | null): item is UnifiedLocation => item !== null);
        resolve(list);
      });
    });
  }));
}

/** 地理编码：地点名称/地址 → 高德 GCJ-02 坐标。 */
export function geocodeLocation(keyword: string, city = '北京'): Promise<GeocodedLocation> {
  const query = keyword.trim();
  if (!query) return Promise.reject(new Error('empty-location'));

  return loadAMap().then((AMap: any) => new Promise<GeocodedLocation>((resolve, reject) => {
    const geocoder = new AMap.Geocoder({ city });
    geocoder.getLocation(query, (status: string, result: any) => {
      const item = result?.geocodes?.[0];
      const location = item?.location;
      const lng = Number(location?.lng);
      const lat = Number(location?.lat);
      if (status === 'complete' && isValidCoord(lng, lat)) {
        resolve({
          name: query,
          address: String(item.formattedAddress || query),
          lng,
          lat,
          city: item.city ? String(item.city) : undefined,
          adcode: item.adcode ? String(item.adcode) : undefined,
        });
      } else {
        reject(new Error('location-not-found'));
      }
    });
  }));
}

/** 逆地理编码详情：坐标 → 地址 + 城市 + adcode（用于同城判断） */
export function reverseGeocodeDetail(lng: number, lat: number): Promise<ReverseGeocodeResult> {
  return loadAMap().then((AMap: any) => new Promise<ReverseGeocodeResult>((resolve, reject) => {
    const geocoder = new AMap.Geocoder();
    geocoder.getAddress([lng, lat], (status: string, result: any) => {
      const re = result?.regeocode;
      const comp = re?.addressComponent;
      if (status === 'complete' && re?.formattedAddress) {
        const city = Array.isArray(comp?.city) && comp.city[0] ? String(comp.city[0]) : comp?.province ? String(comp.province) : undefined;
        resolve({
          address: String(re.formattedAddress),
          city,
          adcode: comp?.adcode ? String(comp.adcode) : undefined,
        });
      } else {
        reject(new Error('geocode-failed'));
      }
    });
  }));
}

/** 一步获取：定位 + 逆地理编码 */
export async function getCurrentResolvedLocation(timeout?: number): Promise<ResolvedLocation> {
  const pos = await getCurrentLocation(timeout);
  let address = '';
  let city: string | undefined;
  let adcode: string | undefined;
  try {
    const detail = await reverseGeocodeDetail(pos.lng, pos.lat);
    address = detail.address;
    city = detail.city;
    adcode = detail.adcode;
  } catch {
    address = '地址解析失败，可通过地图重新选点';
  }
  return { lng: pos.lng, lat: pos.lat, accuracy: pos.accuracy, address, city, adcode, source: 'geolocation' as const };
}

/** 定位错误 → 中文提示 */
export function normalizeLocationError(error: unknown): string {
  const msg = error instanceof Error ? error.message : '';
  if (msg === 'permission-denied') return '无法获取当前位置，请允许定位权限或使用地图选点。';
  if (msg === 'timeout') return '定位超时，请重新定位或使用地图选点。';
  if (msg === 'browser-unsupported') return '当前环境不支持自动定位，请使用地图选点。';
  if (msg === 'geocode-failed') return '已获取坐标，但地址解析失败，请使用地图选点确认位置。';
  if (msg && /AMap|加载|SDK|script|网络/i.test(msg)) return '地图服务加载失败，请检查网络和高德地图配置。';
  return '无法获取当前位置，请允许定位权限或使用地图选点。';
}

/** 坐标合法性校验 */
export function isValidCoord(lng: number, lat: number): boolean {
  return Number.isFinite(lng) && Number.isFinite(lat)
    && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}
