import React, { useEffect, useRef, useState } from 'react';
import { loadAMap } from '../../lib/amap';
import { reverseGeocodeDetail, isValidCoord } from '../../services/locationService';
import type { ReportLocation } from '../../types/reportLocation';
import styles from './ReportLocationPicker.module.css';

interface Props {
  /** 初始位置（自动定位结果） */
  initial?: { lng: number; lat: number; address: string } | null;
  onConfirm: (loc: ReportLocation) => void;
  onCancel: () => void;
}

const ReportLocationPicker: React.FC<Props> = ({ initial, onConfirm, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pinRef = useRef<any>(null);
  const disposedRef = useRef(false);

  const [selected, setSelected] = useState<{ lng: number; lat: number } | null>(
    initial?.lng && initial?.lat ? { lng: initial.lng, lat: initial.lat } : null,
  );
  const [address, setAddress] = useState(initial?.address || '');
  const [addrStatus, setAddrStatus] = useState<'idle' | 'resolving' | 'ok' | 'error'>(initial?.address ? 'ok' : 'idle');
  const [mapError, setMapError] = useState('');
  // 搜索
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; address: string; lng: number; lat: number; districtCode?: string; city?: string }>>([]);
  const [searchError, setSearchError] = useState('');
  // 已确认信息（用于确认时回填）
  const [confirmedInfo, setConfirmedInfo] = useState<{ poiName?: string; districtCode?: string; city?: string }>({});

  const resolveAddress = (lng: number, lat: number) => {
    setAddrStatus('resolving');
    reverseGeocodeDetail(lng, lat)
      .then(detail => {
        if (disposedRef.current) return;
        setAddress(detail.address);
        setConfirmedInfo(prev => ({ ...prev, districtCode: detail.adcode, city: detail.city }));
        setAddrStatus('ok');
      })
      .catch(() => {
        if (disposedRef.current) return;
        setAddress('地址解析失败，可手动填写');
        setAddrStatus('error');
      });
  };

  const pickAt = (lng: number, lat: number) => {
    if (!isValidCoord(lng, lat)) return;
    setSelected({ lng, lat });
    resolveAddress(lng, lat);
  };

  // 初始化地图（中心固定图钉，拖动地图即换点）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    loadAMap().then((AMap: any) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const center = selected ? [selected.lng, selected.lat] : (initial?.lng ? [initial.lng, initial.lat] : [116.40, 39.90]);
      const map = new AMap.Map(containerRef.current, {
        zoom: 16,
        center: center as [number, number],
        viewMode: '2D',
        resizeEnable: true,
      });
      mapRef.current = map;

      // 中心固定图钉（不可拖动；拖动地图后更新中心坐标）
      const pin = new AMap.Marker({
        position: center as [number, number],
        anchor: 'center',
        content: '<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;background:#f5222d;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;border-radius:50%;background:#fff;transform:rotate(45deg);"></div></div>',
        offset: new AMap.Pixel(-17, -34),
      });
      map.add(pin);
      pinRef.current = pin;

      // 停止拖动后取中心坐标
      const handleMoveEnd = () => {
        if (disposedRef.current) return;
        const c = map.getCenter();
        const lng = Number(c?.lng);
        const lat = Number(c?.lat);
        pickAt(lng, lat);
      };
      map.on('moveend', handleMoveEnd);
      map.on('zoomchange', handleMoveEnd);

      if (selected?.lng && selected?.lat) {
        setAddrStatus('resolving');
        reverseGeocodeDetail(selected.lng, selected.lat)
          .then(detail => {
            if (disposedRef.current) return;
            setAddress(detail.address);
            setConfirmedInfo(prev => ({ ...prev, districtCode: detail.adcode, city: detail.city }));
            setAddrStatus('ok');
          })
          .catch(() => { if (!disposedRef.current) { setAddress(initial?.address || '地址解析失败'); setAddrStatus('ok'); } });
      }

      mapRef.current._moveEnd = handleMoveEnd;
    }).catch((e: unknown) => {
      if (cancelled) return;
      console.error('选点地图初始化失败:', e);
      setMapError('地图加载失败，请检查高德 Key / 网络');
    });

    return () => {
      cancelled = true;
      disposedRef.current = true;
      if (mapRef.current) {
        const h = mapRef.current._moveEnd;
        if (h) { mapRef.current.off('moveend', h); mapRef.current.off('zoomchange', h); }
        mapRef.current.destroy?.();
        mapRef.current = null;
      }
      pinRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = async () => {
    const q = searchText.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const AMap = await loadAMap();
      const results = await new Promise<Array<{ name: string; address: string; lng: number; lat: number; districtCode?: string; city?: string }>>((resolve, reject) => {
        AMap.plugin(['AMap.PlaceSearch'], () => {
          const placeSearch = new AMap.PlaceSearch({ pageSize: 8, pageIndex: 1 });
          placeSearch.search(q, (status: string, result: any) => {
            const pois = result?.poiList?.pois;
            if (status !== 'complete' || !Array.isArray(pois) || pois.length === 0) {
              reject(new Error('not-found'));
              return;
            }
            resolve(pois.map((p: any): { name: string; address: string; lng: number; lat: number; districtCode?: string; city?: string } | null => {
              const lng = Number(p?.location?.lng);
              const lat = Number(p?.location?.lat);
              if (!isValidCoord(lng, lat)) return null;
              return {
                name: String(p.name || q),
                address: String(p.address || p.pname + p.cityname + p.adname || ''),
                lng, lat,
                districtCode: p.adcode ? String(p.adcode) : undefined,
                city: p.cityname ? String(p.cityname) : undefined,
              };
            }).filter((x: unknown): x is { name: string; address: string; lng: number; lat: number; districtCode?: string; city?: string } => !!x));
          });
        });
      });
      setSearchResults(results);
      if (results.length === 0) setSearchError(`未找到「${q}」，请换一个关键词`);
    } catch {
      setSearchError(`未找到「${q}」，请换一个关键词`);
    } finally {
      setSearching(false);
    }
  };

  const chooseResult = (item: { name: string; address: string; lng: number; lat: number; districtCode?: string; city?: string }) => {
    setSelected({ lng: item.lng, lat: item.lat });
    setAddress(item.address || item.name);
    setConfirmedInfo({ poiName: item.name, districtCode: item.districtCode, city: item.city });
    setAddrStatus('ok');
    const map = mapRef.current;
    if (map) map.setCenter([item.lng, item.lat]);
    setSearchText('');
    setSearchResults([]);
  };

  const canConfirm = !!selected && isValidCoord(selected.lng, selected.lat) && !!address.trim();

  const handleConfirm = () => {
    if (!selected || !canConfirm) return;
    onConfirm({
      address: address.trim(),
      longitude: selected.lng,
      latitude: selected.lat,
      locationType: confirmedInfo.poiName ? 'search' : 'manual',
      locationStatus: 'verified',
      poiName: confirmedInfo.poiName,
      districtCode: confirmedInfo.districtCode,
      city: confirmedInfo.city,
      locatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>选择事件发生位置</span>
          <span className={styles.modalClose} onClick={onCancel}>✕</span>
        </div>

        <div className={styles.mapWrap}>
          <div ref={containerRef} className={styles.mapContainer} />
          {mapError && <div className={styles.mapError}>{mapError}</div>}
          {!mapError && <div className={styles.mapHint}>📍 拖动地图，中心图钉即为事件位置</div>}
        </div>

        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            placeholder="搜索地点，如：五一广场 / 长沙火车站"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void doSearch(); }}
          />
          <button className={styles.searchBtn} onClick={() => void doSearch()} disabled={searching}>
            {searching ? '搜索中...' : '搜索'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            {searchResults.map((item, i) => (
              <div key={i} className={styles.searchResultItem} onClick={() => chooseResult(item)}>
                <div className={styles.searchResultName}>{item.name}</div>
                <div className={styles.searchResultAddr}>{item.address}</div>
              </div>
            ))}
          </div>
        )}
        {searchError && <div className={styles.searchError}>{searchError}</div>}

        <div className={styles.pickerBody}>
          {addrStatus === 'resolving' && <div className={styles.pickerResolving}>正在解析地址...</div>}
          {addrStatus === 'ok' && <div className={styles.pickerAddress}>{address}</div>}
          {addrStatus === 'error' && <div className={styles.pickerError}>{address}</div>}
          {selected && (
            <div className={styles.coordText}>
              经度 {selected.lng.toFixed(6)} · 纬度 {selected.lat.toFixed(6)}
              {confirmedInfo.poiName ? ` · ${confirmedInfo.poiName}` : ''}
            </div>
          )}
        </div>

        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onCancel}>取消</button>
          <button className={styles.confirmBtn} onClick={handleConfirm} disabled={!canConfirm}>确认位置</button>
        </div>
      </div>
    </div>
  );
};

export default ReportLocationPicker;
