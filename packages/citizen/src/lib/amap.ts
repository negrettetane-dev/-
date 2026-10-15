import AMapLoader from '@amap/amap-jsapi-loader';

type AMapSecurityConfig = {
  securityJsCode: string;
};

declare global {
  interface Window {
    _AMapSecurityConfig?: AMapSecurityConfig;
  }
}

const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || '';
const AMAP_VERSION = import.meta.env.VITE_AMAP_VERSION || '2.0';
const SECURITY_CODE = import.meta.env.VITE_AMAP_SECURITY_CODE || '';

const DEFAULT_PLUGINS = [
  'AMap.Scale',
  'AMap.ToolBar',
  'AMap.Geolocation',
  'AMap.InfoWindow',
  'AMap.TileLayer.Traffic',
  'AMap.HeatMap',
  'AMap.MarkerClusterer',
  'AMap.LineSearch',
  'AMap.Driving',
  'AMap.Transfer',
  'AMap.Walking',
  'AMap.Riding',
  'AMap.AutoComplete',
  'AMap.Geocoder',
];

let loadPromise: Promise<any> | null = null;

function configureSecurity() {
  if (SECURITY_CODE && typeof window !== 'undefined') {
    window._AMapSecurityConfig = { securityJsCode: SECURITY_CODE };
  }
}

export function loadAMap(): Promise<any> {
  configureSecurity();

  if (!AMAP_KEY) {
    return Promise.reject(new Error('Missing VITE_AMAP_KEY'));
  }

  if (!loadPromise) {
    loadPromise = AMapLoader.load({
      key: AMAP_KEY,
      version: AMAP_VERSION,
      plugins: DEFAULT_PLUGINS,
    }).catch((error: unknown) => {
      loadPromise = null;
      throw error;
    });
  }

  return loadPromise;
}

export { AMAP_KEY };
