import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, LocateFixed, Plus, X } from 'lucide-react';
import { loadAMap } from '../../lib/amap';
import AIAssistant from '../../components/AIAssistant';
import TravelModeSelector, { normalizeTravelMode, type TravelModeOption } from '../../components/travel/TravelModeSelector';
import styles from './HomePage.module.css';
import { apiGet } from '../../services/apiClient';
import { planAmapRoute, resolveRouteLocations } from '../../services/routePlanningService';
import { useTravelLocationStore } from '../../stores/travelLocationStore';
import { useTravelPlanStore } from '../../stores/travelPlanStore';
import DepartureTimeSelect from '../../components/travel/DepartureTimeSelect';
import { restoreDepartureState, type DepartureState } from '../../utils/departureTime';
import { fromLegacyRouteMode, parseTravelMode } from '../../types/travelMode';

interface Alert { id:string; category:string; title:string; summary:string; severity:string; publishTime:number }
interface News { id:string; title:string; summary:string; source:string; publishTime:number }
interface Snapshot { cityIndex:number; avgSpeed:number; congestedRoadCount:number; totalRoadCount:number; trend24h:{hour:number;index:number}[] }

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const homeRoutePolyline = useRef<any>(null);
  const homeRouteRequestId = useRef(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const { origin, setOrigin, locate, status: locationStatus, error: locationError } = useTravelLocationStore();
  const [destination, setDestination] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [departure, setDeparture] = useState<DepartureState>(restoreDepartureState);
  const [selectedMode, setSelectedMode] = useState<TravelModeOption>('driving');
  const quickDestinations = ['天安门', '王府井', '北京南站', '国贸CBD', '三里屯', '北京西站'];

  const setManualOrigin = (value: string) => setOrigin({
    name: value,
    address: value,
    lng: null,
    lat: null,
    source: 'manual',
    timestamp: Date.now(),
  });

  const swapRoute = () => {
    const previousOrigin = origin.address;
    setManualOrigin(destination);
    setDestination(previousOrigin);
    setWaypoints(points => [...points].reverse());
  };

  const startRoute = () => {
    if (!origin.address.trim() || !destination.trim()) return;
    const openResult = () => navigate('/travel/result', {
      state: {
        origin: origin.address,
        originCoords: origin.lng != null && origin.lat != null ? { lng: origin.lng, lat: origin.lat } : null,
        originSource: origin.source,
        destination: destination.trim(),
        waypoints: waypoints.map(point => point.trim()).filter(Boolean),
        mode: selectedMode,
        departTime: departure.departureTimeLabel,
        departureMode: departure.departureMode,
        departureAt: departure.departureAt,
        departureTimeLabel: departure.departureTimeLabel,
      },
    });
    const transitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !transitionDocument.startViewTransition) {
      openResult();
      return;
    }
    transitionDocument.startViewTransition(openResult);
  };

  const selectTravelMode = (mode: TravelModeOption) => {
    if (!destination.trim()) {
      window.alert('请填写目的地');
      return;
    }
    setSelectedMode(mode);
  };

  const queryDestination = searchParams.get('destination')?.trim() || '';
  const queryOrigin = searchParams.get('origin')?.trim() || '';
  const queryMode = parseTravelMode(searchParams.get('mode'));

  // AI/分享链接参数优先；没有 URL 参数时才恢复上一次规划草稿。
  useEffect(() => {
    const draft = useTravelPlanStore.getState();
    if (queryDestination) setDestination(queryDestination);
    else if (draft.destination?.name && !destination) setDestination(draft.destination.name);

    if (queryOrigin) setManualOrigin(queryOrigin);

    if (queryMode) setSelectedMode(queryMode);
    else if (draft.mode) setSelectedMode(fromLegacyRouteMode(draft.mode, draft.profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDestination, queryMode, queryOrigin]);

  // 加载高德地图（大图显示）
  useEffect(() => {
    if (mapInstance.current) return;
    setMapError('');
    loadAMap()
      .then((AMap) => {
        if (!mapContainer.current) return;
        const map = new AMap.Map(mapContainer.current, {
          zoom: 12,
          center: [116.40, 39.90],
          viewMode: '2D',
          resizeEnable: true,
        });
        // 实时路况图层
        map.add(new AMap.TileLayer.Traffic({ zIndex: 10 }));
        map.addControl(new AMap.Scale({ position: 'LB' }));
        map.addControl(new AMap.ToolBar({ position: 'RT', liteStyle: true }));
        // 几个示例事件标记
        const incidents = [
          { position: [116.432, 39.940], title: '二环路东直门桥事故', type: 'accident' },
          { position: [116.390, 39.858], title: '三环十里河施工', type: 'construction' },
          { position: [116.390, 39.908], title: '长安街临时管制', type: 'control' },
        ];
        incidents.forEach(inc => {
          const color = inc.type === 'accident' ? '#f5222d' : inc.type === 'construction' ? '#faad14' : '#1677ff';
          const m = new AMap.Marker({
            position: inc.position as [number, number],
            icon: new AMap.Icon({
              size: new AMap.Size(28, 28),
              image: 'data:image/svg+xml,' + encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="${color}" stroke="#fff" stroke-width="2"/><text x="14" y="19" text-anchor="middle" font-size="13">${inc.type==='accident'?'✕':inc.type==='construction'?'▲':'⛔'}</text></svg>`
              ),
            }),
            title: inc.title,
          });
          m.on('click', () => {
            const win = new AMap.InfoWindow({
              content: `<div style="padding:8px;font-size:13px"><b>${inc.title}</b><br/>北京市 · 实时交通事件</div>`,
              offset: new AMap.Pixel(0, -30),
            });
            win.open(map, inc.position as [number, number]);
          });
          map.add(m);
        });
        mapInstance.current = map;
        setMapLoaded(true);
      })
      .catch((e) => {
        console.error('AMap load error:', e);
        setMapError('地图加载失败，请检查高德 Key、安全码和域名白名单');
      });
    return () => { if (mapInstance.current) { mapInstance.current.destroy(); mapInstance.current = null; } };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapLoaded) return;

    if (homeRoutePolyline.current) {
      map.remove(homeRoutePolyline.current);
      homeRoutePolyline.current = null;
    }

    if (!origin.address.trim() || !destination.trim()) return;

    const requestId = ++homeRouteRequestId.current;
    const routeMode = normalizeTravelMode(selectedMode);
    resolveRouteLocations(
      origin.address,
      destination,
      origin.lng != null && origin.lat != null ? { lng: origin.lng, lat: origin.lat } : null,
    )
      .then(({ start, end }) => planAmapRoute(routeMode, start, end))
      .then((route) => {
        if (requestId !== homeRouteRequestId.current || !mapInstance.current) return;
        const AMap = (window as any).AMap;
        if (!AMap?.Polyline) return;
        const polyline = new AMap.Polyline({
          path: route.path,
          strokeColor: '#1677ff',
          strokeWeight: 6,
          strokeOpacity: 0.95,
          strokeStyle: 'solid',
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: 80,
        });
        mapInstance.current.add(polyline);
        homeRoutePolyline.current = polyline;
        mapInstance.current.setFitView([polyline], false, [70, 70, 100, 440]);
      })
      .catch(error => console.warn('Home route planning failed:', error));

    return () => {
      homeRouteRequestId.current += 1;
    };
  }, [destination, mapLoaded, origin.address, origin.lat, origin.lng, selectedMode]);

  // 加载数据
  useEffect(() => {
    apiGet<Array<{
      id:string; type?:string; category?:string; title:string; description?:string; summary?:string;
      severity:string; time?:number; publishTime?:number;
    }>>('/traffic/alerts')
      .then(data => setAlerts(data.map(item => ({
        id:item.id, category:item.category || item.type || 'other', title:item.title,
        summary:item.summary || item.description || '',
        severity:item.severity,
        publishTime:item.publishTime ?? item.time ?? Date.now(),
      }))))
      .catch(() => setAlerts([]));
    apiGet<News[]>('/news/list').then(data => setNews(data.slice(0, 4))).catch(() => setNews([]));
    apiGet<Partial<Snapshot> & { congestionIndex?:number; activeAlerts?:number }>('/traffic/snapshot')
      .then(data => setSnapshot({
        cityIndex:data.cityIndex ?? data.congestionIndex ?? 0,
        avgSpeed:data.avgSpeed ?? 0,
        congestedRoadCount:data.congestedRoadCount ?? data.activeAlerts ?? 0,
        totalRoadCount:data.totalRoadCount ?? 0,
        trend24h:data.trend24h ?? [],
      }))
      .catch(() => setSnapshot(null));
  }, []);

  const severityColor = (s:string) => (s==='critical'?'#f5222d':s==='warning'?'#faad14':'#1677ff');
  const severityBg = (s:string) => (s==='critical'?'#fff1f0':s==='warning'?'#fff7e6':'#e6f4ff');
  const alertIcon = (c:string) => ({accident:'🚨',construction:'🚧',weather:'🌧️',control:'🚫',congestion:'🚦'}[c] || '⚠️');
  const formatRelative = (ts:number) => { const d=Date.now()-ts; if(d<3600000)return `${Math.max(1,Math.floor(d/60000))}分钟前`; if(d<86400000)return `${Math.floor(d/3600000)}小时前`; return `${Math.floor(d/86400000)}天前`; };

  return (
    <div>
      {/* ===== 大图地图 Hero ===== */}
      <section className={styles.hero}>
        <div ref={mapContainer} className={styles.heroMap} />
        {!mapLoaded && (
          <div className={styles.mapLoading}>
            {mapError || '🗺️ 地图加载中...'}
          </div>
        )}

        {/* 左侧：AI 出行规划 */}
        <div className={styles.heroLeft}>
          <div className={styles.aiBox}>
            <div className={styles.aiBoxTitle}>AI智能出行助手</div>
            <div className={styles.routeEditor}>
              <div className={styles.locationInputs}>
                <div className={styles.locationInputRow}>
                  <span className={`${styles.poiDot} ${styles.originDot}`} />
                  <input
                    className={styles.locationInput}
                    aria-label="出发地"
                    placeholder="请输入出发地"
                    value={origin.address}
                    onChange={event => setManualOrigin(event.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.locationButton}
                    onClick={() => void locate()}
                    title="获取当前位置"
                    aria-label="获取当前位置"
                    disabled={locationStatus === 'locating'}
                  >
                    <LocateFixed size={18} aria-hidden="true" />
                  </button>
                </div>
                {waypoints.map((waypoint, index) => (
                  <div className={styles.locationInputRow} key={index}>
                    <span className={`${styles.poiDot} ${styles.waypointDot}`} />
                    <input
                      className={styles.locationInput}
                      aria-label={`途经点${index + 1}`}
                      placeholder={`请输入途经点${index + 1}`}
                      value={waypoint}
                      onChange={event => setWaypoints(points => points.map((point, pointIndex) => pointIndex === index ? event.target.value : point))}
                    />
                    <button
                      type="button"
                      className={styles.locationButton}
                      onClick={() => setWaypoints(points => points.filter((_, pointIndex) => pointIndex !== index))}
                      title="删除途经点"
                      aria-label={`删除途经点${index + 1}`}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <div className={styles.locationInputRow}>
                  <span className={`${styles.poiDot} ${styles.destinationDot}`} />
                  <input
                    className={styles.locationInput}
                    aria-label="目的地"
                    placeholder="请输入目的地"
                    value={destination}
                    onChange={event => setDestination(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') startRoute(); }}
                  />
                </div>
              </div>
              <div className={styles.routeActions}>
                <button type="button" className={styles.routeActionButton} onClick={swapRoute} title="切换出发地和目的地" aria-label="切换出发地和目的地">
                  <ArrowUpDown size={19} aria-hidden="true" />
                </button>
                <button type="button" className={styles.routeActionButton} onClick={() => setWaypoints(points => [...points, ''])} title="添加途经点" aria-label="添加途经点">
                  <Plus size={20} aria-hidden="true" />
                </button>
              </div>
            </div>
            {locationError && locationStatus !== 'success' && <div className={styles.locationError}>{locationError}</div>}
            <div className={styles.departRow}>
              <span>出发时间</span>
              <DepartureTimeSelect value={departure} onChange={setDeparture} />
            </div>
            <button type="button" className={styles.startButton} onClick={startRoute} disabled={!origin.address.trim() || !destination.trim()}>出发</button>
            <div className={styles.popularSection}>
              <div className={styles.popularTitle}>热门目的地</div>
              <div className={styles.popularList}>
                {quickDestinations.map(place => (
                  <button type="button" key={place} className={styles.popularDestination} onClick={() => setDestination(place)}>{place}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <TravelModeSelector value={selectedMode} onChange={selectTravelMode} className={styles.heroModeSelector} />

        {/* 实时预警浮动标签 */}
        <div className={styles.alertFloat}>
          {alerts.slice(0,3).map(a => (
            <div key={a.id} className={styles.alertFloatItem}>
              <span style={{color:severityColor(a.severity)}}>{alertIcon(a.category)}</span>
              <span className={styles.alertFloatTitle}>{a.title}</span>
              <span className={styles.alertFloatTime}>{formatRelative(a.publishTime)}</span>
            </div>
          ))}
          {snapshot && (
            <div className={styles.indexCard}>
              <div className={styles.indexHead}>
                <span>北京 · 拥堵指数</span>
                <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>模拟数据 · 非官方实时</span>
              </div>
              <div className={styles.indexBody}>
                <span className={styles.indexNum} style={{ color: snapshot.cityIndex>7?'#f5222d':snapshot.cityIndex>5?'#ff7a00':'#52c41a' }}>
                  {snapshot.cityIndex}
                </span>
                <div className={styles.indexMeta}>
                  <div>平均车速 <b>{snapshot.avgSpeed} km/h</b></div>
                  <div>拥堵路段 <b style={{color:'#f5222d'}}>{snapshot.congestedRoadCount}</b>/{snapshot.totalRoadCount}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== 功能模块（规整网格） ===== */}
      <section className={styles.features}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>出行服务</h2>
          <span className={styles.sectionMore} onClick={()=>navigate('/services')}>全部服务 →</span>
        </div>
        <div className={styles.featureGrid}>
          {[
            { icon:'🧭', title:'一体化出行规划', desc:'驾车/公交/骑行多模式 · AI拥堵预测', path:'/travel', color:'#1677ff' },
            { icon:'🅿️', title:'智慧停车诱导', desc:'空位信息 · 收费标准 · 导航直达', path:'/parking', color:'#722ed1' },
            { icon:'⚡', title:'充电桩查询', desc:'站点信息 · 功率 · 扫码充电', path:'/parking', color:'#13c2c2' },
            { icon:'📷', title:'事件上报', desc:'拍照上报 · 工单追踪 · 处理反馈', path:'/report', color:'#fa541c' },
            { icon:'📰', title:'交通资讯', desc:'施工公告 · 管制通知 · 出行提示', path:'/news', color:'#eb2f96' },
            { icon:'🌳', title:'绿色碳普惠', desc:'绿色出行积累碳积分 · 兑换权益', path:'/carbon', color:'#52c41a' },
            { icon:'🧰', title:'便民服务', desc:'违章查询 · 车驾管 · 移车求助', path:'/services', color:'#fa8c16' },
            { icon:'👴', title:'长辈简易模式', desc:'大字体 · 语音交互 · 极简操作', path:'/elderly', color:'#a0d911' },
          ].map(f => (
            <div key={f.title} className={styles.featureCard} onClick={()=>navigate(f.path)}>
              <div className={styles.featureIcon} style={{ background: f.color + '18', color: f.color }}>{f.icon}</div>
              <div className={styles.featureInfo}>
                <div className={styles.featureTitle}>{f.title}</div>
                <div className={styles.featureDesc}>{f.desc}</div>
              </div>
              <span className={styles.featureArrow}>→</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 24h 拥堵趋势 + 实时预警 ===== */}
      <section className={styles.bottomSection}>
        <div className={styles.siteCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>📊 24小时拥堵趋势</h2>
            <span className={styles.sectionMore}>实时数据</span>
          </div>
          {snapshot && (
            <div className={styles.sparkArea}>
              <div className={styles.sparkline}>
                {snapshot.trend24h.map((p,i)=>(
                  <div key={i} className={styles.sparkBar}
                    style={{ height:`${Math.max(10,p.index*9)}px`, background: p.index>7?'#f5222d':p.index>5?'#ff7a00':p.index>3?'#fadb14':'#52c41a' }}
                    title={`${p.hour}:00 指数${p.index}`}/>
                ))}
              </div>
              <div className={styles.sparkLabels}><span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
            </div>
          )}
        </div>

        <div className={styles.siteCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>📰 交通资讯</h2>
            <span className={styles.sectionMore} onClick={()=>navigate('/news')}>更多 →</span>
          </div>
          <div className={styles.newsList}>
            {news.map(n => (
              <div key={n.id} className={styles.newsItem} onClick={()=>navigate(`/news/${n.id}`)}>
                <div className={styles.newsTitle}>{n.title}</div>
                <div className={styles.newsMeta}>
                  <span>{n.source}</span>
                  <span>{formatRelative(n.publishTime)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: 24 }} />
      <AIAssistant />
    </div>
  );
};

export default HomePage;
