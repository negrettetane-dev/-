import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import AIAssistant from '../../components/AIAssistant';
import DataSourceBadge from '../../components/DataSourceBadge';
import { getNearbyStations, getBusLines, getMetroLines } from '../../services/transitService';
import type { TransitLine, NearbyStation } from '../../types/transit';
import { useTravelLocationStore, type UnifiedLocation } from '../../stores/travelLocationStore';
import { useTravelPlanStore, createRouteRequestSnapshot } from '../../stores/travelPlanStore';
import { parseTravelPlanParams, TRAVEL_ENTRIES, type TravelMode, type TravelProfile } from '../../types/travelPlan';
import DepartureTimeSelect from '../../components/travel/DepartureTimeSelect';
import TransitSearchPanel from '../../components/travel/TransitSearchPanel';
import styles from './Travel.module.css';

const TravelPlanPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const prefillDest = (location.state as { dest?: string })?.dest || '';
  // 起点：唯一真值在 travelLocationStore；终点：唯一真值在 travelPlanStore（两者同构 UnifiedLocation）
  const { origin: locOrigin, setOrigin: setLocOrigin, locate, status: locStatus, error: locError } = useTravelLocationStore();
  const {
    destination,
    waypoints,
    mode,
    profile,
    strategy,
    departure,
    setDestination,
    setWaypoints,
    setMode,
    setProfile,
    setStrategy,
    setDeparture,
    swap,
  } = useTravelPlanStore();

  // 起点输入值：定位成功后显示地址，否则显示名称
  const originText = locOrigin.address || locOrigin.name;

  // 公交/地铁模式：搜索模块的显示与请求条件（项目模式体系用 mode==='bus'，无障碍预设复用公交）
  const isTransitMode = mode === 'bus' || profile === 'accessible';

  // ===== 首次挂载：从 URL / 首页 state 初始化草稿，返回时（POP）不覆盖 store 最新值 =====
  const { mode: urlMode, profile: urlProfile } = parseTravelPlanParams(location.search);
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const hasDraft = Boolean(useTravelPlanStore.getState().destination?.name);
    if (!hasDraft) {
      // 无草稿：用 URL 参数 + 首页带入的目的地初始化
      setMode(urlMode);
      setProfile(urlProfile);
      if (prefillDest && navigationType !== 'POP') {
        setDestination({ name: prefillDest, address: prefillDest, lng: null, lat: null, source: 'manual' });
      }
    }
    // hasDraft（返回/刷新恢复）：保留 store 最新草稿，不反向改写
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 用户切换入口时同步 URL（store 为真值，URL 仅表达入口）
  useEffect(() => {
    const qs = profile !== 'standard' ? `?mode=${mode}&profile=${profile}` : `?mode=${mode}`;
    const target = `/travel${qs}`;
    if (location.pathname + location.search !== target) {
      navigate(target, { replace: true, state: { dest: destination?.name || '' } });
    }
  }, [mode, profile, destination, location.pathname, location.search, navigate]);

  // 公交/地铁线路列表
  const [busLines, setBusLines] = useState<TransitLine[]>([]);
  const [metroLines, setMetroLines] = useState<TransitLine[]>([]);

  // 附近站点：独立加载状态（与搜索结果互不影响）
  const [nearby, setNearby] = useState<NearbyStation[]>([]);
  const [nearbyStatus, setNearbyStatus] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');
  const [nearbyError, setNearbyError] = useState('');

  // 地铁"查看全部"
  const [showAllMetro, setShowAllMetro] = useState(false);
  const METRO_FEATURED = ['m1', 'm2', 'm3', 'm4'];

  useEffect(() => {
    getBusLines().then(setBusLines).catch(() => setBusLines([]));
    getMetroLines().then(setMetroLines).catch(() => setMetroLines([]));

    // 附近站点：无定位权限/超时 → 降级演示数据并标注；接口失败 → error（不影响搜索）
    setNearbyStatus('loading');
    const apply = (list: NearbyStation[]) => { setNearby(list); setNearbyStatus(list.length ? 'success' : 'empty'); };
    const fail = () => setNearbyStatus('error');
    if (!('geolocation' in navigator)) {
      setNearbyError('当前环境不支持定位，显示演示站点');
      getNearbyStations().then(apply).catch(fail);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { getNearbyStations(pos.coords.latitude, pos.coords.longitude).then(apply).catch(fail); },
      () => {
        setNearbyError('无法获取当前位置，显示演示站点');
        getNearbyStations().then(apply).catch(fail);
      },
      { timeout: 5000 }
    );
  }, []);

  const quickDests = ['天安门', '王府井', '北京南站', '国贸CBD', '三里屯', '北京西站'];

  // 六个入口 → mode + profile（写入 store，切换入口即同步 URL）
  const handleEntrySelect = (m: { mode: TravelMode; profile: TravelProfile }) => {
    setMode(m.mode);
    setProfile(m.profile);
    setStrategy('推荐');
  };

  // 📍 获取真实位置（统一走 location store 高德定位，失败不伪造坐标）
  const handleLocate = () => { void locate(); };

  // 手动输入只代表待解析的地点名称，必须清除旧坐标，避免文字变了但 Marker/路线仍使用上一次定位。
  const handleOriginInput = (value: string) => {
    setLocOrigin({
      name: value,
      address: value,
      lng: null,
      lat: null,
      source: 'manual',
      timestamp: Date.now(),
    });
  };

  // 终点手动输入：同构 UnifiedLocation，清除坐标
  const handleDestInput = (value: string) => {
    setDestination({
      name: value,
      address: value,
      lng: null,
      lat: null,
      source: 'manual',
    });
  };

  // 搜索结果设为起点/终点：写入完整位置对象（含坐标，来源 poi-search）；缺坐标由面板禁用
  const handleSetOrigin = (loc: UnifiedLocation) => setLocOrigin(loc);
  const handleSetDestination = (loc: UnifiedLocation) => setDestination(loc);

  // ⇅ 反转完整路线顺序（交换 store 里的起终点完整对象 + 反转途经点）
  const handleSwap = () => { swap(); };

  const handleAddWaypoint = () => {
    setWaypoints([...waypoints, '']);
  };

  const handleWaypointChange = (index: number, value: string) => {
    setWaypoints(waypoints.map((point, pointIndex) => (
      pointIndex === index ? value : point
    )));
  };

  const handleRemoveWaypoint = (index: number) => {
    setWaypoints(waypoints.filter((_, pointIndex) => pointIndex !== index));
  };

  const handleSearch = () => {
    if (!originText.trim() || !destination?.name?.trim()) return;
    // 读取 store 生成路线请求快照（不清空草稿，供返回/刷新恢复）
    const snapshot = createRouteRequestSnapshot();
    if (!snapshot) return;
    navigate('/travel/result', { state: snapshot });
  };

  return (
    <div className={styles.page}>
      {/* 六个入口（内部不把新能源/无障碍当成独立路线引擎） */}
      <div className={styles.modeTabs}>
        {TRAVEL_ENTRIES.map(entry => {
          const isActive = entry.mode === mode && entry.profile === profile;
          return (
            <div key={entry.key} className={`${styles.modeTab} ${isActive?styles.modeActive:''}`}
              onClick={() => handleEntrySelect(entry)}>
              <span style={{fontSize:20}}>{entry.icon}</span>
              <span style={{fontSize:12}}>{entry.label}</span>
            </div>
          );
        })}
      </div>

      {/* 当前预设提示 */}
      {profile !== 'standard' && (
        <div style={{ padding: '8px 14px', background: '#f0f5ff', borderRadius: 8, fontSize: 12, color: '#1677ff', marginBottom: 12 }}>
          {profile === 'ev' ? '⚡ 新能源模式：复用驾车路线，支持沿途充电站' : '♿ 无障碍模式：复用公交路线，优先少步行/少换乘'}
        </div>
      )}

      {/* Input Area */}
      <div className={styles.inputArea}>
        <div className={styles.routeEditor}>
          <div className={styles.locationInputs}>
            <div className={styles.inputRow}>
              <span className={styles.poiDot} style={{background:'#52c41a'}}/>
              <input className={styles.poiInput} aria-label="起始点" value={originText} onChange={e=>handleOriginInput(e.target.value)} placeholder="请选择起点"/>
              <button type="button" className={styles.locationBtn} onClick={handleLocate} title="获取当前位置" aria-label="获取当前位置">
                {locStatus === 'locating' ? '⏳' : '📍'}
              </button>
            </div>
            {locError && locStatus !== 'success' && (
              <div style={{ fontSize: 12, color: '#d4380d', marginTop: 6 }}>⚠️ {locError}</div>
            )}
            {waypoints.map((waypoint, index) => (
              <div className={styles.inputRow} key={index}>
                <span className={styles.poiDot} style={{background:'#faad14'}}/>
                <input
                  className={styles.poiInput}
                  aria-label={`途经点${index + 1}`}
                  placeholder={`输入途经点${index + 1}`}
                  value={waypoint}
                  onChange={event => handleWaypointChange(index, event.target.value)}
                />
                <button type="button" className={styles.removeWaypointBtn} aria-label={`删除途经点${index + 1}`} title="删除途经点" onClick={() => handleRemoveWaypoint(index)}>−</button>
              </div>
            ))}
            <div className={styles.inputRow}>
              <span className={styles.poiDot} style={{background:'#f5222d'}}/>
              <input className={styles.poiInput} aria-label="目的地" placeholder="输入目的地" value={destination?.name || ''} onChange={e=>handleDestInput(e.target.value)}/>
            </div>
          </div>
          <div className={styles.routeActions}>
            <button type="button" className={styles.routeActionBtn} onClick={handleSwap} title="反转完整路线" aria-label="反转路线">⇅</button>
            <button type="button" className={styles.routeActionBtn} onClick={handleAddWaypoint} title="添加途经点" aria-label="添加途经点">+</button>
          </div>
        </div>
        <div className={styles.departRow}>
          <span className={styles.departLabel}>出发时间</span>
          <DepartureTimeSelect
            value={departure}
            onChange={(next) => setDeparture(next)}
          />
        </div>
        <button className={styles.searchBtn} onClick={handleSearch}>
          🔍 智能规划路线
        </button>
      </div>

      {/* Quick Destinations */}
      <div className={styles.quickSection}>
        <div className={styles.sectionTitle}>🔥 热门目的地</div>
        <div className={styles.quickGrid}>
          {quickDests.map(d => (
            <div key={d} className={styles.quickDest} onClick={()=>handleDestInput(d)}>{d}</div>
          ))}
        </div>
      </div>

      {/* ===== 下半页辅助服务（按入口配置驱动） ===== */}

      {/* 公交/地铁搜索（模式驱动：非公交模式隐藏但保留输入，不继续请求） */}
      <div className={styles.transitSection}>
        <div className={styles.sectionTitle}>🔍 搜索公交 / 地铁</div>
        <TransitSearchPanel active={isTransitMode} onSetOrigin={handleSetOrigin} onSetDestination={handleSetDestination} />
      </div>

      {/* 附近站点 / 公交线路 / 地铁路线（仅公交模式显示） */}
      {isTransitMode ? (
        <>
      {/* 附近站点（距离为演示/来源待确认） */}
      <div className={styles.transitSection}>
        <div className={styles.sectionTitle}>
          📍 附近公交 / 地铁
          <DataSourceBadge source="unknown" />
        </div>
        {nearbyError && <div style={{ fontSize: 12, color: '#faad14', marginBottom: 8 }}>⚠️ {nearbyError}</div>}
        <div className={styles.nearbyList}>
          {nearby.map(n => (
            <div key={n.id} className={styles.nearbyItem}>
              <div className={styles.nearbyName}>
                {n.mode === 'metro' ? '🚇' : '🚌'} {n.name}
                <span style={{ fontSize: 11, color: 'var(--text-hint)', marginLeft: 6 }}>{n.lines.join(' · ')}</span>
              </div>
              <span className={styles.nearbyDist}>{n.distance}m</span>
            </div>
          ))}
        </div>
      </div>

      {/* 公交线路（数据来源待确认） */}
      <div className={styles.transitSection}>
        <div className={styles.sectionTitle}>
          🚌 公交线路
          <DataSourceBadge source="unknown" />
        </div>
        <div className={styles.busList}>
          {busLines.slice(0, showAllMetro ? busLines.length : 4).map(b => (
            <div key={b.id} className={styles.busCard} onClick={() => navigate(`/travel/bus/${b.id}`)} style={{cursor:'pointer'}}>
              <div className={styles.busHeader}>
                <span className={styles.busName}>{b.name}</span>
                <span className={styles.busRoute}>{b.from} → {b.to}</span>
              </div>
              <div className={styles.busMeta}>
                <span>💰 {b.fare !== undefined ? `¥${b.fare}` : '票价暂无数据'}</span>
                <span>🕐 约{Math.floor(Math.random()*10)+2}分钟到站</span>
                <span className={styles.crowding} style={{color:'var(--text-hint)',fontSize:11}}>
                  （演示到站时间）
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.showAllBtn} onClick={() => setShowAllMetro(!showAllMetro)}>
          {showAllMetro ? '收起' : `查看全部线路（${busLines.length}条）`}
        </div>
      </div>

      {/* 地铁线路（数据来源待确认） */}
      <div className={styles.transitSection}>
        <div className={styles.sectionTitle}>
          🚇 地铁路线
          <DataSourceBadge source="unknown" />
        </div>
        <div className={styles.metroList}>
          {metroLines.filter(m => showAllMetro || METRO_FEATURED.includes(m.id)).map(m => (
            <div key={m.id} className={styles.metroCard} onClick={() => navigate(`/travel/metro/${m.id}`)} style={{cursor:'pointer'}}>
              <span className={styles.metroName}>{m.name}</span>
              <span className={styles.metroStations}>
                {m.stations.slice(0, 4).map(station => station.name).join(' → ')} → ...
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>›</span>
            </div>
          ))}
        </div>
        <div className={styles.showAllBtn} onClick={() => setShowAllMetro(!showAllMetro)}>
          {showAllMetro ? '收起' : `查看全部线路（${metroLines.length}条）`}
        </div>
      </div>
        </>
      ) : (
        <div className={styles.transitSection}>
          <div className={styles.sectionTitle}>🔧 辅助服务</div>
          {profile === 'ev' ? (
            <>
              <div className={styles.customBusBanner} style={{ marginTop: 0 }} onClick={() => navigate('/charging/scan')}>
                <span>⚡ 新能源辅助：扫码充电</span>
                <span style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600 }}>去充电 →</span>
              </div>
              <div className={styles.nearbyList} style={{ marginTop: 12 }}>
                {[{ name: '附近充电站', desc: '可查看充电桩状态与扫码启动' }].map(i => (
                  <div key={i.name} className={styles.nearbyItem}>
                    <span className={styles.nearbyName}>⚡ {i.name}</span>
                    <span className={styles.nearbyDist}><button style={{ border: 'none', background: 'var(--primary)', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }} onClick={() => navigate('/parking')}>去查看</button></span>
                  </div>
                ))}
              </div>
            </>
          ) : mode === 'drive' ? (
            <div className={styles.nearbyItem}>
              <span className={styles.nearbyName}>🅿️ 附近停车场</span>
              <span className={styles.nearbyDist}><button style={{ border: 'none', background: 'var(--primary)', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }} onClick={() => navigate('/parking')}>去停车充电</button></span>
            </div>
          ) : mode === 'bike' ? (
            <div className={styles.nearbyItem}>
              <span className={styles.nearbyName}>🚲 共享单车 / 骑行服务</span>
              <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>数据暂未接入</span>
            </div>
          ) : mode === 'walk' ? (
            <div className={styles.nearbyItem}>
              <span className={styles.nearbyName}>🚶 周边步行信息</span>
              <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>数据暂未接入</span>
            </div>
          ) : (
            <div className={styles.nearbyItem}>
              <span className={styles.nearbyName}>📋 出行辅助</span>
              <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>数据暂未接入</span>
            </div>
          )}
        </div>
      )}

      {/* QR Code entry */}
      <div className={styles.qrBanner} onClick={() => navigate('/qrcode')}>
        <span>📱 乘车码 · 公交地铁一码通行</span>
        <span style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 600 }}>立即使用 →</span>
      </div>

      {/* Custom Bus Banner */}
      <div className={styles.customBusBanner}>
        <span>🚌💡 通勤距离超过15km？试试定制公交预约，一人一座直达</span>
        <button className={styles.customBusBtn} onClick={() => navigate('/travel/custom-bus')}>去预约 →</button>
      </div>

      <div style={{height:24}}/>
      <AIAssistant />
    </div>
  );
};

export default TravelPlanPage;
