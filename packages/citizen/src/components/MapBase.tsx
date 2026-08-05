import React, { useEffect, useRef } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';

// 高德地图 JS API Key 从环境变量读取
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || '';

let AMapInstance: any = null;
let loadPromise: Promise<any> | null = null;

function loadAMap(): Promise<any> {
  if (AMapInstance) return Promise.resolve(AMapInstance);
  if (loadPromise) return loadPromise;

  loadPromise = AMapLoader.load({
    key: AMAP_KEY,
    version: '2.0',
    plugins: [
      'AMap.Scale',
      'AMap.ToolBar',
      'AMap.Geolocation',
      'AMap.TileLayer.Traffic',
      'AMap.HeatMap',
      'AMap.MarkerClusterer',
      'AMap.Driving',
      'AMap.Transfer',
      'AMap.Walking',
      'AMap.Riding',
      'AMap.AutoComplete',
      'AMap.Geocoder',
    ],
  })
    .then((AMap) => {
      AMapInstance = AMap;
      return AMap;
    })
    .catch((e) => {
      loadPromise = null;
      console.error('AMap 加载失败:', e);
      throw e;
    });

  return loadPromise;
}

export interface MapBaseProps {
  center?: [number, number];
  zoom?: number;
  style?: React.CSSProperties;
  className?: string;
  onLoad?: (map: any, AMap: any) => void;
  children?: React.ReactNode;
  showTraffic?: boolean;
  showToolBar?: boolean;
  showGeolocation?: boolean;
}

const MapBase: React.FC<MapBaseProps> = ({
  center = [116.40, 39.90],
  zoom = 13,
  style,
  className,
  onLoad,
  showTraffic = true,
  showToolBar = true,
  showGeolocation = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let map: any = null;

    loadAMap().then((AMap) => {
      if (!containerRef.current) return;
      if (mapRef.current) { mapRef.current.destroy(); }

      map = new AMap.Map(containerRef.current, {
        zoom,
        center,
        viewMode: '2D',
        resizeEnable: true,
      });

      if (showToolBar) map.addControl(new AMap.ToolBar({ position: 'RT' }));
      if (showTraffic) {
        const trafficLayer = new AMap.TileLayer.Traffic({ zIndex: 10 });
        map.add(trafficLayer);
      }
      if (showGeolocation) {
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 10000,
          position: 'RB',
          offset: [10, 40],
          zoomToAccuracy: true,
        });
        map.addControl(geolocation);
      }

      mapRef.current = map;
      onLoad?.(map, AMap);
    });

    return () => {
      if (map) { map.destroy(); mapRef.current = null; }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
};

export { loadAMap };
export default MapBase;
