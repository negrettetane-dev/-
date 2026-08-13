import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AIAssistant from '../../components/AIAssistant';
import DataSourceBadge from '../../components/DataSourceBadge';
import { searchTransit, getNearbyStations, getBusLines, getMetroLines } from '../../services/transitService';
import type { TransitLine, TransitSearchResult, NearbyStation } from '../../types/transit';
import { useTravelLocationStore } from '../../stores/travelLocationStore';
import styles from './Travel.module.css';

const TravelPlanPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillDest = (location.state as { dest?: string })?.dest || '';
  const { origin: locOrigin, setOrigin: setLocOrigin, locate, status: locStatus, error: locError } = useTravelLocationStore();
  const [mode, setMode] = useState<string>('drive');
  const [dest, setDest] = useState(prefillDest);
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [departTime, setDepartTime] = useState('现在出发');
  const [busLines, setBusLines] = useState<TransitLine[]>([]);
  const [metroLines, setMetroLines] = useState<TransitLine[]>([]);

  // 起点输入值允许为空；“请选择起点”只作为 placeholder，不能回填成用户无法删除的文本。
  const originText = locOrigin.lng != null ? locOrigin.address : locOrigin.address;

  // 公交/地铁搜索
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TransitSearchResult[]>([]);

  // 附近站点
  const [nearby, setNearby] = useState<NearbyStation[]>([]);
  const [nearbyError, setNearbyError] = useState('');

  // 地铁"查看全部"
  const [showAllMetro, setShowAllMetro] = useState(false);
  const METRO_FEATURED = ['m1', 'm2', 'm3', 'm4'];

  useEffect(() => {
    getBusLines().then(setBusLines).catch(() => setBusLines([]));
    getMetroLines().then(setMetroLines).catch(() => setMetroLines([]));

    // 附近站点（定位失败用演示数据，不崩溃）
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          getNearbyStations(pos.coords.latitude, pos.coords.longitude)
            .then(setNearby)
            .catch(() => setNearbyError('无法获取当前位置，显示演示站点'));
        },
        () => {
          getNearbyStations().then(setNearby);
          setNearbyError('无法获取当前位置，显示演示站点');
        },
        { timeout: 5000 }
      );
    } else {
      getNearbyStations().then(setNearby);
      setNearbyError('无法获取当前位置，显示演示站点');
    }
  }, []);

  // 防抖搜索
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      searchTransit(searchQuery).then(setSearchResults).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const modes = [
    { key:'new-energy', icon:'⚡', label:'新能源' },
    { key:'drive', icon:'🚗', label:'驾车' },
    { key:'bus', icon:'🚌', label:'公交地铁' },
    { key:'bike', icon:'🚲', label:'骑行' },
    { key:'walk', icon:'🚶', label:'步行' },
    { key:'accessible', icon:'♿', label:'无障碍' },
  ];

  const quickDests = ['天安门', '王府井', '北京南站', '国贸CBD', '三里屯', '北京西站'];

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

  // ⇅ 反转完整路线顺序
  const handleSwap = () => {
    setLocOrigin({
      name: dest || '请选择终点',
      address: dest,
      lng: null,
      lat: null,
      source: 'manual',
      timestamp: Date.now(),
    });
    setDest(originText);
    setWaypoints(currentWaypoints => [...currentWaypoints].reverse());
  };

  const handleAddWaypoint = () => {
    setWaypoints(currentWaypoints => [...currentWaypoints, '']);
  };

  const handleWaypointChange = (index: number, value: string) => {
    setWaypoints(currentWaypoints => currentWaypoints.map((point, pointIndex) => (
      pointIndex === index ? value : point
    )));
  };

  const handleRemoveWaypoint = (index: number) => {
    setWaypoints(currentWaypoints => currentWaypoints.filter((_, pointIndex) => pointIndex !== index));
  };

  const handleSearch = () => {
    if (!originText.trim() || !dest.trim()) return;
    navigate('/travel/result', {
      state: {
        origin: originText,
        originCoords: locOrigin.lng != null && locOrigin.lat != null ? { lng: locOrigin.lng, lat: locOrigin.lat } : null,
        originSource: locOrigin.source,
        destination: dest,
        waypoints: waypoints.map(point => point.trim()).filter(Boolean),
        mode,
      },
    });
  };

  return (
    <div className={styles.page}>
      {/* Mode Tabs */}
      <div className={styles.modeTabs}>
        {modes.map(m => (
          <div key={m.key} className={`${styles.modeTab} ${mode===m.key?styles.modeActive:''}`}
            onClick={()=>setMode(m.key)}>
            <span style={{fontSize:20}}>{m.icon}</span>
            <span style={{fontSize:12}}>{m.label}</span>
          </div>
        ))}
      </div>

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
              <input className={styles.poiInput} aria-label="目的地" placeholder="输入目的地" value={dest} onChange={e=>setDest(e.target.value)}/>
            </div>
          </div>
          <div className={styles.routeActions}>
            <button type="button" className={styles.routeActionBtn} onClick={handleSwap} title="反转完整路线" aria-label="反转路线">⇅</button>
            <button type="button" className={styles.routeActionBtn} onClick={handleAddWaypoint} title="添加途经点" aria-label="添加途经点">+</button>
          </div>
        </div>
        <div className={styles.departRow}>
          <span className={styles.departLabel}>出发时间</span>
          <select className={styles.departSelect} value={departTime} onChange={e=>setDepartTime(e.target.value)}>
            <option>现在出发</option>
            <option>30分钟后</option>
            <option>1小时后</option>
            <option>自定义时间</option>
          </select>
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
            <div key={d} className={styles.quickDest} onClick={()=>setDest(d)}>{d}</div>
          ))}
        </div>
      </div>

      {/* 公交地铁搜索 */}
      <div className={styles.transitSection}>
        <div className={styles.sectionTitle}>🔍 搜索公交 / 地铁</div>
        <div className={styles.searchBox}>
          <input
            className={styles.searchInput}
            placeholder="输入线路或站点，如 300 / 西直门"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            {searchResults.map(r => (
              <div key={r.type + r.id} className={styles.searchResultItem} onClick={() => {
                if (r.type === 'line') navigate(r.mode === 'bus' ? `/travel/bus/${r.id}` : `/travel/metro/${r.id}`);
              }}>
                <span className={styles.searchResultType}>{r.type === 'line' ? '🚏 线路' : '📍 站点'}</span>
                <span className={styles.searchResultName}>
                  {r.name}
                  {r.transferLines && r.transferLines.length > 0 && (
                    <span style={{ fontSize: 11, color: '#1677ff', marginLeft: 6 }}>换乘 {r.transferLines.join('/')}</span>
                  )}
                </span>
                {r.subtitle && <span className={styles.searchResultSub}>{r.subtitle}</span>}
              </div>
            ))}
          </div>
        )}
        {searchQuery.trim() && searchResults.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-hint)', padding: 10 }}>未找到相关线路或站点</div>
        )}
      </div>

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
