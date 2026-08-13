// ===== 智途云枢 · 定位服务 =====
// 优先使用高德 Geolocation（GCJ-02 坐标系），降级浏览器定位。
// 逆地理编码使用高德 Geocoder。

import { loadAMap } from '../lib/amap';

export interface LocatedPosition {
  lng: number;
  lat: number;
  accuracy?: number;
}

export interface ResolvedLocation extends LocatedPosition {
  address: string;
  source: 'geolocation' | 'map';
}

export interface GeocodedLocation extends LocatedPosition {
  name: string;
  address: string;
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
        });
      } else {
        reject(new Error('location-not-found'));
      }
    });
  }));
}

/** 一步获取：定位 + 逆地理编码 */
export async function getCurrentResolvedLocation(timeout?: number): Promise<ResolvedLocation> {
  const pos = await getCurrentLocation(timeout);
  let address = '';
  try {
    address = await reverseGeocode(pos.lng, pos.lat);
  } catch {
    address = '地址解析失败，可通过地图重新选点';
  }
  return { lng: pos.lng, lat: pos.lat, accuracy: pos.accuracy, address, source: 'geolocation' as const };
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
