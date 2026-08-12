import React, { useEffect, useRef, useState } from 'react';
import { loadAMap } from '../../lib/amap';
import { reverseGeocode, normalizeLocationError, isValidCoord, type ResolvedLocation } from '../../services/locationService';
import styles from './LocationPickerModal.module.css';

interface Props {
  initial?: ResolvedLocation | null;
  onConfirm: (loc: ResolvedLocation) => void;
  onCancel: () => void;
}

const LocationPickerModal: React.FC<Props> = ({ initial, onConfirm, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const disposedRef = useRef(false);

  const [selected, setSelected] = useState<{ lng: number; lat: number } | null>(null);
  const [address, setAddress] = useState('');
  const [addrStatus, setAddrStatus] = useState<'idle' | 'resolving' | 'ok' | 'error'>('idle');
  const [mapError, setMapError] = useState('');

  const pickAt = (lng: number, lat: number) => {
    if (!isValidCoord(lng, lat)) return;
    setSelected({ lng, lat });
    setAddrStatus('resolving');
    reverseGeocode(lng, lat).then(addr => {
      if (disposedRef.current) return;
      setAddress(addr);
      setAddrStatus('ok');
    }).catch(() => {
      if (disposedRef.current) return;
      setAddress('地址解析失败，可通过地图重新选点');
      setAddrStatus('error');
    });
  };

  // 初始化地图（只一次）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    loadAMap().then((AMap: any) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const center = initial ? [initial.lng, initial.lat] : [116.40, 39.90];
      const map = new AMap.Map(containerRef.current, {
        zoom: 16,
        center: center as [number, number],
        viewMode: '2D',
        resizeEnable: true,
      });
      mapRef.current = map;

      const marker = new AMap.Marker({
        position: center as [number, number],
        anchor: 'center',
      });
      map.add(marker);
      markerRef.current = marker;

      const handleMapClick = (event: any) => {
        if (disposedRef.current) return;
        const lng = Number(event.lnglat?.lng);
        const lat = Number(event.lnglat?.lat);
        marker.setPosition([lng, lat]);
        map.panTo([lng, lat]);
        pickAt(lng, lat);
      };
      map.on('click', handleMapClick);

      // 有初始位置时预填地址
      if (initial?.lng && initial?.lat) {
        setSelected({ lng: initial.lng, lat: initial.lat });
        setAddress(initial.address);
        setAddrStatus('ok');
      }

      mapRef.current._pickHandler = handleMapClick;
    }).catch((e: unknown) => {
      if (cancelled) return;
      console.error('选点地图初始化失败:', e);
      setMapError('地图加载失败，请检查高德 Key / 网络');
    });

    return () => {
      cancelled = true;
      disposedRef.current = true;
      if (mapRef.current) {
        const h = mapRef.current._pickHandler;
        if (h) mapRef.current.off('click', h);
        mapRef.current.destroy?.();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, []);

  const canConfirm = !!selected && isValidCoord(selected.lng, selected.lat) && !!address.trim();

  const handleConfirm = () => {
    if (!selected || !canConfirm) return;
    onConfirm({ lng: selected.lng, lat: selected.lat, address: address.trim(), source: 'map' as const });
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>选择车辆位置</span>
          <span className={styles.modalClose} onClick={onCancel}>✕</span>
        </div>

        <div className={styles.mapWrap}>
          <div ref={containerRef} className={styles.mapContainer} />
          {mapError && <div className={styles.mapError}>{mapError}</div>}
          {!mapError && (
            <div className={styles.mapHint}>📍 点击地图选择车辆位置</div>
          )}
        </div>

        <div className={styles.pickerBody}>
          {addrStatus === 'resolving' && <div className={styles.pickerResolving}>正在解析地址...</div>}
          {addrStatus === 'ok' && <div className={styles.pickerAddress}>{address}</div>}
          {addrStatus === 'error' && <div className={styles.pickerError}>{address}</div>}
          {selected && (
            <div className={styles.coordText}>
              经度 {selected.lng.toFixed(6)} · 纬度 {selected.lat.toFixed(6)}
            </div>
          )}
        </div>

        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onCancel}>取消</button>
          <button className={styles.confirmBtn} onClick={handleConfirm} disabled={!canConfirm}>
            确认位置
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerModal;
