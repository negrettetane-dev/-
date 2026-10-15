import React, { useEffect, useRef, useState } from 'react';
import { loadAMap } from '../../lib/amap';
import { geocodeLocation, reverseGeocode, isValidCoord, type ResolvedLocation } from '../../services/locationService';
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
  const resolveRequestRef = useRef(0);

  const [selected, setSelected] = useState<{ lng: number; lat: number } | null>(null);
  const [address, setAddress] = useState('');
  const [addrStatus, setAddrStatus] = useState<'idle' | 'resolving' | 'ok' | 'error'>('idle');
  const [mapError, setMapError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const pickAt = (lng: number, lat: number) => {
    if (!isValidCoord(lng, lat)) return;
    const requestId = ++resolveRequestRef.current;
    const fallbackAddress = `地图选定位置（${lng.toFixed(6)}, ${lat.toFixed(6)}）`;
    setSelected({ lng, lat });
    setAddress(fallbackAddress);
    setAddrStatus('resolving');
    reverseGeocode(lng, lat).then(addr => {
      if (disposedRef.current || requestId !== resolveRequestRef.current) return;
      setAddress(addr);
      setAddrStatus('ok');
    }).catch(() => {
      if (disposedRef.current || requestId !== resolveRequestRef.current) return;
      setAddrStatus('error');
    });
  };

  const readLngLat = (value: any) => {
    const lng = typeof value?.getLng === 'function' ? value.getLng() : value?.lng;
    const lat = typeof value?.getLat === 'function' ? value.getLat() : value?.lat;
    return { lng: Number(lng), lat: Number(lat) };
  };

  // 初始化地图（只一次）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    loadAMap().then((AMap: any) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const center = initial ? [initial.lng, initial.lat] : [116.40, 39.90];
      const map = new AMap.Map(containerRef.current, {
        zoom: 15,
        center: center as [number, number],
        viewMode: '2D',
        mapStyle: 'amap://styles/normal',
        features: ['bg', 'road', 'building', 'point'],
        showBuildingBlock: true,
        resizeEnable: true,
      });
      mapRef.current = map;

      const marker = new AMap.Marker({
        position: center as [number, number],
        anchor: 'center',
        draggable: true,
      });
      map.add(marker);
      markerRef.current = marker;

      const selectPosition = (lng: number, lat: number) => {
        if (!isValidCoord(lng, lat)) return;
        marker.setPosition([lng, lat]);
        map.panTo([lng, lat]);
        pickAt(lng, lat);
      };

      const handleMapClick = (event: any) => {
        if (disposedRef.current) return;
        const position = readLngLat(event?.lnglat || event);
        selectPosition(position.lng, position.lat);
      };
      const handleMarkerDragEnd = (event: any) => {
        if (disposedRef.current) return;
        const position = readLngLat(event?.lnglat || marker.getPosition());
        selectPosition(position.lng, position.lat);
      };
      map.on('click', handleMapClick);
      marker.on('dragend', handleMarkerDragEnd);

      // 有初始位置时预填地址；没有初始位置时也将地图中心作为可确认的默认选点
      if (initial && isValidCoord(initial.lng, initial.lat)) {
        setSelected({ lng: initial.lng, lat: initial.lat });
        setAddress(initial.address || `地图选定位置（${initial.lng.toFixed(6)}, ${initial.lat.toFixed(6)}）`);
        if (initial.address) {
          setAddrStatus('ok');
        } else {
          pickAt(initial.lng, initial.lat);
        }
      } else {
        const [lng, lat] = center as [number, number];
        pickAt(lng, lat);
      }

      mapRef.current._pickHandler = handleMapClick;
      mapRef.current._dragHandler = handleMarkerDragEnd;
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
        const dragHandler = mapRef.current._dragHandler;
        if (h) mapRef.current.off('click', h);
        if (dragHandler) markerRef.current?.off('dragend', dragHandler);
        mapRef.current.destroy?.();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, []);

  const canConfirm = !!selected && isValidCoord(selected.lng, selected.lat);

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query) {
      setSearchError('请输入地点或地址');
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const result = await geocodeLocation(query, initial?.city || '全国');
      if (!isValidCoord(result.lng, result.lat)) throw new Error('invalid-coord');
      markerRef.current?.setPosition([result.lng, result.lat]);
      mapRef.current?.setZoomAndCenter?.(16, [result.lng, result.lat]);
      pickAt(result.lng, result.lat);
    } catch {
      setSearchError('未找到该地点，请换个关键词重试');
    } finally {
      setSearching(false);
    }
  };

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

        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            value={searchText}
            onChange={e => { setSearchText(e.target.value); setSearchError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') void handleSearch(); }}
            placeholder="手动输入地点或地址"
            aria-label="手动输入地点或地址"
          />
          <button className={styles.searchBtn} onClick={() => void handleSearch()} disabled={searching}>
            {searching ? '搜索中' : '搜索'}
          </button>
        </div>
        {searchError && <div className={styles.searchError}>{searchError}</div>}

        <div className={styles.pickerBody}>
          {addrStatus === 'resolving' && (
            <>
              <div className={styles.pickerAddress}>{address}</div>
              <div className={styles.pickerResolving}>已选择新位置，正在解析详细地址...</div>
            </>
          )}
          {addrStatus === 'ok' && <div className={styles.pickerAddress}>{address}</div>}
          {addrStatus === 'error' && (
            <div className={styles.pickerError}>详细地址解析失败，将使用地图坐标确认位置：{address}</div>
          )}
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
