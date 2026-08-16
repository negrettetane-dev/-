import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, LocateFixed, Plus, X } from 'lucide-react';
import { loadAMap } from '../../lib/amap';
import AIAssistant from '../../components/AIAssistant';
import TravelModeSelector, { normalizeTravelMode, TRAVEL_MODE_OPTIONS, type TravelModeOption } from '../../components/travel/TravelModeSelector';
import styles from './HomePage.module.css';
import { apiGet } from '../../services/apiClient';
import { planAmapRoute, resolveRouteLocations } from '../../services/routePlanningService';
import { useTravelLocationStore } from '../../stores/travelLocationStore';
import { useTravelPlanStore } from '../../stores/travelPlanStore';
import DepartureTimeSelect from '../../components/travel/DepartureTimeSelect';
import { restoreDepartureState, type DepartureState } from '../../utils/departureTime';
import { fromLegacyRouteMode, parseTravelMode } from '../../types/travelMode';
import { useElderly } from '../../App';

interface News { id:string; category:string; title:string; summary:string; source:string; publishTime:number }
interface Snapshot { cityIndex:number; avgSpeed:number; congestedRoadCount:number; totalRoadCount:number; trend24h:{hour:number;index:number}[] }

const HOME_NEWS_CATEGORY_PRIORITY = ['control', 'construction', 'metro', 'bus', 'holiday'];

/** publishTime 是否属于今天 */
function isToday(ts: number): boolean {
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** 首页相关分类优先级：control/construction/metro/bus/holiday 靠前，其余靠后 */
function categoryPriority(category: string): number {
  const idx = HOME_NEWS_CATEGORY_PRIORITY.indexOf(category as (typeof HOME_NEWS_CATEGORY_PRIORITY)[number]);
  return idx === -1 ? HOME_NEWS_CATEGORY_PRIORITY.length : idx;
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { elderlyMode, disableElderlyMode } = useElderly();
  const [searchParams] = useSearchParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const homeRoutePolyline = useRef<any>(null);
  const homeRouteRequestId = useRef(0);
  const [news, setNews] = useState<News[]>([]);
  const [newsFailed, setNewsFailed] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshotFailed, setSnapshotFailed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  // 首页路线规划状态提示（避免「高亮按钮但地图没反应」的无反馈问题）
  const [routePreviewStatus, setRoutePreviewStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [routePreviewMessage, setRoutePreviewMessage] = useState('');
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
        // 实时路况图层（保留；不再叠加固定的“演示交通事件” Marker）
        map.add(new AMap.TileLayer.Traffic({ zIndex: 10 }));
        map.addControl(new AMap.Scale({ position: 'LB' }));
        map.addControl(new AMap.ToolBar({ position: 'RT', liteStyle: true }));
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
    setRoutePreviewStatus('loading');
    setRoutePreviewMessage(`正在规划${TRAVEL_MODE_OPTIONS.find(m => m.key === selectedMode)?.label || ''}路线...`);
    resolveRouteLocations(
      origin.address,
      destination,
      origin.lng != null && origin.lat != null ? { lng: origin.lng, lat: origin.lat } : null,
    )
      .then(({ start, end }) => planAmapRoute(routeMode, start, end))
      .then((route) => {
        if (requestId !== homeRouteRequestId.current || !mapInstance.current) return;
        // 空路径不静默成功：请求成功但没解析出有效路径 → 明确报错
        if (!route.path || route.path.length < 2) {
          throw new Error(`${selectedMode} 路线规划成功，但未解析到有效路径`);
        }
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
        setRoutePreviewStatus('success');
        setRoutePreviewMessage('');
      })
      .catch(error => {
        if (requestId !== homeRouteRequestId.current) return;
        console.warn('Home route planning failed:', error);
        setRoutePreviewStatus('error');
        setRoutePreviewMessage(error instanceof Error ? error.message : '暂未获取到该路线');
      });

    return () => {
      homeRouteRequestId.current += 1;
    };
  }, [destination, mapLoaded, origin.address, origin.lat, origin.lng, selectedMode]);

  // 加载数据
  useEffect(() => {
    // 今日交通资讯：复用 /news/list，保存完整数据，前端按 publishTime 筛选
    apiGet<News[]>('/news/list')
      .then(data => { setNews(data); setNewsFailed(false); })
      .catch(() => { setNews([]); setNewsFailed(true); });
    // 北京 · 交通运行参考：仍为模拟数据，失败不生成随机指数
    apiGet<Partial<Snapshot> & { congestionIndex?:number; activeAlerts?:number }>('/traffic/snapshot')
      .then(data => {
        setSnapshot({
          cityIndex:data.cityIndex ?? data.congestionIndex ?? 0,
          avgSpeed:data.avgSpeed ?? 0,
          congestedRoadCount:data.congestedRoadCount ?? data.activeAlerts ?? 0,
          totalRoadCount:data.totalRoadCount ?? 0,
          trend24h:data.trend24h ?? [],
        });
        setSnapshotFailed(false);
      })
      .catch(() => { setSnapshot(null); setSnapshotFailed(true); });
  }, []);

  // 今日交通资讯：publishTime 属于今天 → 优先首页相关分类（control/construction/metro/bus/holiday）→ 按时间倒序取最新 3 条
  const todayNews = useMemo(() => {
    const today = news
      .filter(n => isToday(n.publishTime))
      .sort((a, b) => {
        const pa = categoryPriority(a.category);
        const pb = categoryPriority(b.category);
        if (pa !== pb) return pa - pb;
        return b.publishTime - a.publishTime;
      });
    return today.slice(0, 3);
  }, [news]);

  const formatRelative = (ts:number) => { const d=Date.now()-ts; if(d<3600000)return `${Math.max(1,Math.floor(d/60000))}分钟前`; if(d<86400000)return `${Math.floor(d/3600000)}小时前`; return `${Math.floor(d/86400000)}天前`; };

  return (
    <div>
      {/* 长辈模式已开启：返回首页 ≠ 退出长辈模式，保持大字号（data-elderly 全局生效） */}
      {elderlyMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#fff7e6', borderBottom: '1px solid #ffe7ba', fontSize: 15 }}>
          <span style={{ fontWeight: 700 }}>👴 长辈模式已开启</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/elderly')} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #d9a94e', background: '#fff', color: '#8a5a00', fontSize: 14, cursor: 'pointer' }}>返回长辈首页</button>
            <button onClick={disableElderlyMode} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#faad14', color: '#fff', fontSize: 14, cursor: 'pointer' }}>退出长辈模式</button>
          </span>
        </div>
      )}

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

        {/* 路线规划状态提示：避免「高亮按钮但地图没反应」 */}
        {routePreviewStatus === 'loading' && (
          <div style={{ position: 'absolute', left: '50%', bottom: 76, transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '8px 16px', borderRadius: 20, fontSize: 13, zIndex: 30 }}>
            ⏳ {routePreviewMessage}
          </div>
        )}
        {routePreviewStatus === 'error' && (
          <div style={{ position: 'absolute', left: '50%', bottom: 76, transform: 'translateX(-50%)', background: 'rgba(245,34,45,0.9)', color: '#fff', padding: '8px 16px', borderRadius: 20, fontSize: 13, zIndex: 30 }}>
            ⚠️ {routePreviewMessage}
          </div>
        )}

        {/* 右侧浮动：今日交通资讯 + 北京 · 交通运行参考 */}
        <div className={styles.alertFloat}>
          {/* 今日交通资讯：当天发布、倒序、最新 3 条，优先首页相关分类 */}
          <div className={styles.alertNewsCard}>
            <div className={styles.indexHead}>
              <span>📰 今日交通资讯</span>
              <span className={styles.sectionMore} onClick={()=>navigate('/news')}>更多 →</span>
            </div>
            {newsFailed ? (
              <div className={styles.alertEmpty}>交通资讯暂时无法加载</div>
            ) : todayNews.length === 0 ? (
              <div className={styles.alertEmpty}>今日暂无新的交通资讯</div>
            ) : (
              todayNews.map(n => (
                <div key={n.id} className={styles.alertFloatItem} onClick={()=>navigate(`/news/${n.id}`)}>
                  <span className={styles.alertFloatTitle}>{n.title}</span>
                  <span className={styles.alertFloatTime}>{formatRelative(n.publishTime)}</span>
                </div>
              ))
            )}
          </div>

          {/* 北京 · 交通运行参考：模拟数据，非官方实时 */}
          <div className={styles.indexCard}>
            <div className={styles.indexHead}>
              <span>北京 · 交通运行参考</span>
              <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>模拟数据 · 非官方实时</span>
            </div>
            {snapshotFailed ? (
              <div className={styles.alertEmpty}>交通运行数据暂不可用</div>
            ) : snapshot ? (
              <div className={styles.indexBody}>
                <span className={styles.indexNum} style={{ color: snapshot.cityIndex>7?'#f5222d':snapshot.cityIndex>5?'#ff7a00':'#52c41a' }}>
                  {snapshot.cityIndex}
                </span>
                <div className={styles.indexMeta}>
                  <div>平均车速 <b>{snapshot.avgSpeed} km/h</b></div>
                  <div>拥堵路段 <b style={{color:'#f5222d'}}>{snapshot.congestedRoadCount}</b>/{snapshot.totalRoadCount}</div>
                </div>
              </div>
            ) : null}
          </div>
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

      {/* ===== 24h 拥堵趋势 + 交通资讯 ===== */}
      <section className={styles.bottomSection}>
        <div className={styles.siteCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>📊 24小时拥堵趋势</h2>
            <span className={styles.sectionMore}>模拟数据</span>
          </div>
          {snapshotFailed ? (
            <div className={styles.alertEmpty}>交通运行数据暂不可用</div>
          ) : snapshot ? (
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
          ) : null}
        </div>

        <div className={styles.siteCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>📰 交通资讯</h2>
            <span className={styles.sectionMore} onClick={()=>navigate('/news')}>更多 →</span>
          </div>
          {newsFailed ? (
            <div className={styles.alertEmpty}>交通资讯暂时无法加载</div>
          ) : (
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
          )}
        </div>
      </section>

      <div style={{ height: 24 }} />
      <AIAssistant />
    </div>
  );
};

export default HomePage;
