import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAMap } from '../../lib/amap';
import styles from './Parking.module.css';
import { apiGet } from '../../services/apiClient';

interface ParkingLot { id:string; name:string; address:string; position:[number,number]; totalSpots:number; availableSpots:number; price:string; type:string; distance:number; hasCharging:boolean }
interface ChargingStation { id:string; name:string; address:string; position:[number,number]; operator:string; totalPiles:number; availablePiles:number; power:string; price:string; distance:number; status:string }

const ParkingPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'parking'|'charging'>('parking');
  const [viewMode, setViewMode] = useState<'list'|'map'>('list');
  const [parking, setParking] = useState<ParkingLot[]>([]);
  const [charging, setCharging] = useState<ChargingStation[]>([]);
  const [mapError, setMapError] = useState('');
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    apiGet<ParkingLot[]>('/parking/lots').then(setParking).catch(() => setParking([]));
    apiGet<ChargingStation[]>('/parking/charging').then(setCharging).catch(() => setCharging([]));
  }, []);

  // 加载地图
  useEffect(() => {
    if (viewMode !== 'map' || mapRef.current) return;

    setMapError('');
    loadAMap()
      .then((AMap) => {
        if (!mapContainer.current) return;
        const map = new AMap.Map(mapContainer.current, {
          zoom: 14,
          center: [116.40, 39.90],
          resizeEnable: true,
        });
        mapRef.current = map;
      })
      .catch((error) => {
        console.error('AMap 加载失败:', error);
        setMapError('地图加载失败，请检查高德 Key、安全码和域名白名单');
      });
    return () => { if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null; } };
  }, [viewMode]);

  // 地图上打标记
  useEffect(() => {
    if (!mapRef.current || viewMode !== 'map') return;
    const map = mapRef.current;
    map.clearMap();

    const AMap = (window as any).AMap;
    if (!AMap || !AMap.Marker) return;

    if (tab === 'parking') {
      const markers = parking.map(p => {
        const m = new AMap.Marker({
          position: p.position,
          title: p.name,
          label: { content: `<div style="background:#1677ff;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;white-space:nowrap">${p.name}</div>`, direction: 'top' },
        });
        m.on('click', () => {
          const info = `<div style="padding:8px;font-size:13px"><b>${p.name}</b><br/>空位: ${p.availableSpots}/${p.totalSpots}<br/>${p.price}</div>`;
          const infoWin = new AMap.InfoWindow({ content: info, offset: new AMap.Pixel(0, -30) });
          infoWin.open(map, p.position);
        });
        return m;
      });
      map.add(markers);
      map.setFitView(null, false, [60, 60, 60, 60]);
    } else {
      const markers = charging.map(c => {
        const m = new AMap.Marker({
          position: c.position,
          title: c.name,
          icon: new AMap.Icon({
            size: new AMap.Size(24, 24),
            image: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#52c41a"/><text x="12" y="17" text-anchor="middle" font-size="14">⚡</text></svg>'),
          }),
          label: { content: `<div style="background:#52c41a;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px">${c.name}</div>`, direction: 'top' },
        });
        m.on('click', () => {
          const info = `<div style="padding:8px;font-size:13px"><b>${c.name}</b><br/>空闲: ${c.availablePiles}/${c.totalPiles}<br/>${c.power} · ${c.price}</div>`;
          const infoWin = new AMap.InfoWindow({ content: info, offset: new AMap.Pixel(0, -30) });
          infoWin.open(map, c.position);
        });
        return m;
      });
      map.add(markers);
      map.setFitView(null, false, [60, 60, 60, 60]);
    }
  }, [parking, charging, tab, viewMode]);

  const ratioColor = (avail:number, total:number) => {
    const r = avail/total;
    return r>0.3?'#52c41a':r>0.1?'#faad14':'#f5222d';
  };

  return (
    <div className={styles.page}>
      <div className={styles.tabRow}>
        <button className={`${styles.tab} ${tab==='parking'?styles.tabActive:''}`} onClick={()=>setTab('parking')}>🅿️ 停车场</button>
        <button className={`${styles.tab} ${tab==='charging'?styles.tabActive:''}`} onClick={()=>setTab('charging')}>⚡ 充电桩</button>
      </div>

      {/* 视图切换 */}
      <div style={{display:'flex', justifyContent:'flex-end', marginBottom:8}}>
        <button onClick={()=>setViewMode(viewMode==='list'?'map':'list')}
          style={{padding:'6px 14px',border:'1px solid var(--primary)',borderRadius:20,background:viewMode==='map'?'var(--primary)':'#fff',color:viewMode==='map'?'#fff':'var(--primary)',fontSize:13,cursor:'pointer'}}>
          {viewMode==='list'?'🗺️ 地图视图':'📋 列表视图'}
        </button>
      </div>

      {viewMode === 'map' ? (
        <div style={{position:'relative', minHeight:400, flex:1, borderRadius:12, overflow:'hidden'}}>
          <div ref={mapContainer} style={{width:'100%', height:'100%', minHeight:400}} />
          {mapError && (
            <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center', padding:24, background:'#f7f8fa', color:'#d4380d', textAlign:'center'}}>
              {mapError}
            </div>
          )}
        </div>
      ) : (
        <>
          {tab === 'parking' && (
            <div className={styles.list}>
              {parking.map(p => (
                <div key={p.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.lotName}>{p.name}</span>
                      <span style={{fontSize:11,color:'var(--primary)',marginLeft:6,background:'var(--primary-light)',padding:'2px 6px',borderRadius:4}}>{p.type==='underground'?'地下':p.type==='ground'?'地面':'路侧'}</span>
                      {p.hasCharging && <span style={{fontSize:10,marginLeft:4}}>⚡有充电桩</span>}
                    </div>
                    <span style={{fontSize:12,color:'var(--text-hint)'}}>{(p.distance/1000).toFixed(1)}km</span>
                  </div>
                  <div className={styles.cardBody}>{p.address}</div>
                  <div className={styles.cardFooter}>
                    <div>
                      <span className={styles.spotNum} style={{color:ratioColor(p.availableSpots,p.totalSpots)}}>{p.availableSpots}</span>
                      <span style={{color:'var(--text-secondary)'}}>/{p.totalSpots} 空位</span>
                      <div className={styles.progressBar}>
                        <div style={{width:`${(p.availableSpots/p.totalSpots)*100}%`,height:'100%',background:ratioColor(p.availableSpots,p.totalSpots),borderRadius:3,transition:'width 0.5s'}}/>
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:600,color:'#f5222d',fontSize:15}}>{p.price}</div>
                      <button className={styles.navBtn} onClick={() => {
                        const [lng, lat] = p.position;
                        navigate(`/travel/result`, { state: { origin: '我的位置', destination: p.name, mode: 'drive' } });
                      }}>🧭 导航至此</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'charging' && (
            <div className={styles.list}>
              {charging.map(c => (
                <div key={c.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.lotName}>{c.name}</span>
                      <span style={{fontSize:11,background:c.status==='online'?'#e6ffe6':c.status==='offline'?'#fff1f0':'#fff7e6',color:c.status==='online'?'#52c41a':c.status==='offline'?'#f5222d':'#faad14',padding:'2px 6px',borderRadius:4,marginLeft:6}}>
                        {c.status==='online'?'在线':'离线'}
                      </span>
                    </div>
                    <span style={{fontSize:12,color:'var(--text-hint)'}}>{(c.distance/1000).toFixed(1)}km</span>
                  </div>
                  <div className={styles.cardBody}>{c.address} · {c.operator}</div>
                  <div className={styles.cardFooter}>
                    <div>
                      <span className={styles.spotNum} style={{color:'#52c41a'}}>{c.availablePiles}</span>
                      <span style={{color:'var(--text-secondary)'}}>/{c.totalPiles} 空闲桩</span>
                      <span style={{fontSize:11,color:'var(--text-hint)',marginLeft:6}}>⚡{c.power}</span>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:600,fontSize:15}}>{c.price}</div>
                      <button className={styles.navBtn} onClick={() => navigate('/charging/scan', { state: {
                        stationId: c.id,
                        stationName: c.name,
                        operator: c.operator,
                        power: c.power,
                        price: c.price,
                        address: c.address,
                      } })}>🔌 扫码充电</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{height:24}}/>
    </div>
  );
};

export default ParkingPage;
