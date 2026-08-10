import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Travel.module.css';

interface BusLine { id:string; name:string; from:string; to:string; stops:string[]; price:number }
interface MetroLine { id:string; name:string; from:string; to:string; stations:string[] }

const TravelPlanPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<string>('drive');
  const [origin, setOrigin] = useState('我的位置');
  const [dest, setDest] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [departTime, setDepartTime] = useState('现在出发');
  const [busLines, setBusLines] = useState<BusLine[]>([]);
  const [metroLines, setMetroLines] = useState<MetroLine[]>([]);

  useEffect(() => {
    fetch('/api/transit/bus-lines').then(r=>r.json()).then(d=>setBusLines(d.data||[]));
    fetch('/api/transit/metro-lines').then(r=>r.json()).then(d=>setMetroLines(d.data||[]));
  }, []);

  const modes = [
    { key:'new-energy', icon:'⚡', label:'新能源' },
    { key:'drive', icon:'🚗', label:'驾车' },
    { key:'bus', icon:'🚌', label:'公交地铁' },
    { key:'bike', icon:'🚲', label:'骑行' },
    { key:'walk', icon:'🚶', label:'步行' },
    { key:'accessible', icon:'♿', label:'无障碍' },
  ];

  const quickDests = ['天安门', '王府井', '北京南站', '国贸CBD', '三里屯', '北京西站'];

  const handleSearch = () => {
    if (!dest.trim()) return;
    navigate('/travel/result', {
      state: {
        origin,
        destination: dest,
        waypoints: waypoints.map(point => point.trim()).filter(Boolean),
        mode,
      },
    });
  };

  const handleSwapRoute = () => {
    setOrigin(dest);
    setDest(origin);
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
              <input className={styles.poiInput} aria-label="起始点" value={origin} onChange={e=>setOrigin(e.target.value)}/>
              <span className={styles.locBtn} aria-hidden="true">📍</span>
            </div>
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
                <button
                  type="button"
                  className={styles.removeWaypointBtn}
                  aria-label={`删除途经点${index + 1}`}
                  title="删除途经点"
                  onClick={() => handleRemoveWaypoint(index)}
                >
                  −
                </button>
              </div>
            ))}
            <div className={styles.inputRow}>
              <span className={styles.poiDot} style={{background:'#f5222d'}}/>
              <input className={styles.poiInput} aria-label="目的地" placeholder="输入目的地" value={dest} onChange={e=>setDest(e.target.value)}/>
            </div>
          </div>
          <div className={styles.routeActions}>
            <button
              type="button"
              className={styles.routeActionBtn}
              aria-label="反转路线"
              title="反转起始点、途经点和目的地"
              onClick={handleSwapRoute}
            >
              ⇅
            </button>
            <button
              type="button"
              className={styles.routeActionBtn}
              aria-label="添加途经点"
              title="添加途经点"
              onClick={handleAddWaypoint}
            >
              +
            </button>
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

      {/* Bus & Metro Info */}
      <div className={styles.transitSection}>
        <div className={styles.sectionTitle}>🚌 实时公交</div>
        <div className={styles.busList}>
          {busLines.slice(0,4).map(b => (
            <div key={b.id} className={styles.busCard}>
              <div className={styles.busHeader}>
                <span className={styles.busName}>{b.name}</span>
                <span className={styles.busRoute}>{b.from} → {b.to}</span>
              </div>
              <div className={styles.busMeta}>
                <span>💰 ¥{b.price}</span>
                <span>🕐 约{Math.floor(Math.random()*10)+2}分钟到站</span>
                <span className={styles.crowding}>
                  {['🟢宽松','🟡适中','🟠拥挤','🔴满载'][Math.floor(Math.random()*4)]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.transitSection}>
        <div className={styles.sectionTitle}>🚇 地铁路线</div>
        <div className={styles.metroList}>
          {metroLines.map(m => (
            <div key={m.id} className={styles.metroCard}>
              <span className={styles.metroName}>{m.name}</span>
              <span className={styles.metroStations}>{m.stations.slice(0,4).join(' → ')} → ...</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Bus Banner */}
      <div className={styles.customBusBanner}>
        <span>🚌💡 通勤距离超过15km？试试定制公交预约，一人一座直达</span>
        <button className={styles.customBusBtn}>去预约 →</button>
      </div>

      <div style={{height:24}}/>
    </div>
  );
};

export default TravelPlanPage;
