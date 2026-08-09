import React, { useEffect, useRef } from 'react';
import { loadAMap } from '../lib/amap';

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

    loadAMap()
      .then((AMap) => {
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
      })
      .catch((error) => {
        console.error('AMap 加载失败:', error);
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
