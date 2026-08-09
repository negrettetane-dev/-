import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AIAssistant from '../../components/AIAssistant';
import { searchTransit, getNearbyStations } from '../../services/transitService';
import type { TransitLine, TransitSearchResult, NearbyStation } from '../../types/transit';
import styles from './Travel.module.css';

interface BusLine { id:string; name:string; from:string; to:string; stops:string[]; price:number }
interface MetroLine { id:string; name:string; from:string; to:string; stations:string[] }

const TravelPlanPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillDest = (location.state as { dest?: string })?.dest || '';
  const [mode, setMode] = useState<string>('drive');
  const [origin, setOrigin] = useState('我的位置');
  const [dest, setDest] = useState(prefillDest);
  const [departTime, setDepartTime] = useState('现在出发');
  const [busLines, setBusLines] = useState<BusLine[]>([]);
  const [metroLines, setMetroLines] = useState<MetroLine[]>([]);
  const [locating, setLocating] = useState(false);

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
    fetch('/api/transit/bus-lines').then(r=>r.json()).then(d=>setBusLines(d.data||[]));
    fetch('/api/transit/metro-lines').then(r=>r.json()).then(d=>setMetroLines(d.data||[]));

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
    { key:'drive', icon:'🚗', label:'驾车' },
    { key:'bus', icon:'🚌', label:'公交地铁' },
    { key:'bike', icon:'🚲', label:'骑行' },
    { key:'walk', icon:'🚶', label:'步行' },
  ];

  const quickDests = ['天安门', '王府井', '北京南站', '国贸CBD', '三里屯', '北京西站'];

  // 📍 获取真实地理位置
  const handleLocate = () => {
    if (!navigator.geolocation) {
      setOrigin('北京 · 天安门广场（无法获取定位）');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setOrigin(`经度 ${longitude.toFixed(4)}, 纬度 ${latitude.toFixed(4)}`);
        setLocating(false);
      },
      () => {
        // 降级：模拟北京坐标
        const lat = 39.9042 + (Math.random() - 0.5) * 0.05;
        const lng = 116.4074 + (Math.random() - 0.5) * 0.05;
        setOrigin(`北京市 · 当前位置 (${lng.toFixed(3)}, ${lat.toFixed(3)})`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  };

  // ⇅ 交换起终点
  const handleSwap = () => {
    if (origin === '我的位置') return;
    const tmp = origin;
    setOrigin(dest || '请输入目的地');
    setDest(tmp);
  };

  const handleSearch = () => {
    if (!dest.trim()) return;
    navigate('/travel/result', { state: { origin, destination: dest, mode } });
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
        <div className={styles.inputRow}>
          <span className={styles.poiDot} style={{background:'#52c41a'}}/>
          <input className={styles.poiInput} value={origin} onChange={e=>setOrigin(e.target.value)}/>
          <span className={styles.locBtn} onClick={handleLocate} title="获取当前位置">
            {locating ? '⏳' : '📍'}
          </span>
        </div>
        <div className={styles.inputRow}>
          <span className={styles.poiDot} style={{background:'#f5222d'}}/>
          <input className={styles.poiInput} placeholder="输入目的地" value={dest} onChange={e=>setDest(e.target.value)}/>
          <span className={styles.swapBtn} onClick={handleSwap} title="交换起终点">⇅</span>
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

      {/* 附近站点 */}
      <div className={styles.transitSection}>
        <div className={styles.sectionTitle}>📍 附近公交 / 地铁</div>
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

      {/* 实时公交 */}
      <div className={styles.transitSection}>
        <div className={styles.sectionTitle}>🚌 公交线路</div>
        <div className={styles.busList}>
          {busLines.slice(0, showAllMetro ? busLines.length : 4).map(b => (
            <div key={b.id} className={styles.busCard} onClick={() => navigate(`/travel/bus/${b.id}`)} style={{cursor:'pointer'}}>
              <div className={styles.busHeader}>
                <span className={styles.busName}>{b.name}</span>
                <span className={styles.busRoute}>{b.from} → {b.to}</span>
              </div>
              <div className={styles.busMeta}>
                <span>💰 {b.price ? `¥${b.price}` : '票价暂无数据'}</span>
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

      {/* 地铁线路 */}
      <div className={styles.transitSection}>
        <div className={styles.sectionTitle}>🚇 地铁路线</div>
        <div className={styles.metroList}>
          {metroLines.filter(m => showAllMetro || METRO_FEATURED.includes(m.id)).map(m => (
            <div key={m.id} className={styles.metroCard} onClick={() => navigate(`/travel/metro/${m.id}`)} style={{cursor:'pointer'}}>
              <span className={styles.metroName}>{m.name}</span>
              <span className={styles.metroStations}>
                {(Array.isArray(m.stations) && typeof m.stations[0] === 'object'
                  ? (m.stations as any[]).slice(0,4).map((s:any) => s.name).join(' → ')
                  : (m.stations as string[]).slice(0,4).join(' → ')
                )} → ...
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
