import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AIAssistant from '../../components/AIAssistant';
import DataSourceBadge from '../../components/DataSourceBadge';
import TravelModeSelector, { type TravelModeOption } from '../../components/travel/TravelModeSelector';
import { searchTransit, getNearbyStations, getBusLines, getMetroLines } from '../../services/transitService';
import type { TransitLine, TransitSearchResult, NearbyStation } from '../../types/transit';
import styles from './Travel.module.css';

const TravelPlanPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<TravelModeOption>('drive');
  const [busLines, setBusLines] = useState<TransitLine[]>([]);
  const [metroLines, setMetroLines] = useState<TransitLine[]>([]);

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

  return (
    <div className={styles.page}>
      <TravelModeSelector value={mode} onChange={setMode} className={styles.travelPageModeSelector} />

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
