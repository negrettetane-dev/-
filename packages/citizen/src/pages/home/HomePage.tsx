import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAMap } from '../../lib/amap';
import AIAssistant from '../../components/AIAssistant';
import styles from './HomePage.module.css';

interface Alert { id:string; category:string; title:string; summary:string; severity:string; publishTime:number }
interface News { id:string; title:string; summary:string; source:string; publishTime:number }
interface Snapshot { cityIndex:number; avgSpeed:number; congestedRoadCount:number; totalRoadCount:number; trend24h:{hour:number;index:number}[] }

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // 北京 POI 提示词库
  const ALL_SUGGESTIONS = [
    '天安门广场', '故宫博物院', '王府井步行街', '国贸CBD', '三里屯太古里',
    '北京南站', '北京西站', '北京站', '首都国际机场', '大兴国际机场',
    '中关村软件园', '西单大悦城', '望京SOHO', '五棵松体育馆', '颐和园',
    '圆明园', '鸟巢·水立方', '簋街', '南锣鼓巷', '后海酒吧街',
    '北京动物园', '朝阳大悦城', '蓝色港湾', '华熙LIVE', '金融街',
    '北京大学', '清华大学', '中国人民大学', '北京航空航天大学', '北京理工大学',
    '西二旗', '上地', '亦庄开发区', '通州万达', '回龙观', '天通苑',
  ];

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (val.trim().length > 0) {
      const filtered = ALL_SUGGESTIONS.filter(s => s.includes(val.trim()));
      setSuggestions(filtered.slice(0, 6));
    } else {
      setSuggestions([]);
    }
  };

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

  // 加载数据
  useEffect(() => {
    fetch('/api/traffic/alerts').then(r=>r.json()).then(d=>setAlerts(d.data||[]));
    fetch('/api/news/list').then(r=>r.json()).then(d=>setNews(d.data?.slice(0,4)||[]));
    fetch('/api/traffic/snapshot').then(r=>r.json()).then(d=>setSnapshot(d.data));
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

        {/* 左侧：AI出行助手搜索 */}
        <div className={styles.heroLeft}>
          <div className={styles.aiBox}>
            <div className={styles.aiBoxTitle}>🤖 AI智能出行助手</div>
            <div className={styles.searchRow}>
              <div className={styles.searchWrapper}>
                <input
                  className={styles.searchInput}
                  placeholder="输入目的地，如：天安门"
                  value={query}
                  onChange={e=>handleQueryChange(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter' && query.trim()) navigate('/travel', { state: { dest: query.trim() } }); }}
                  onBlur={()=>setTimeout(()=>setSuggestions([]),200)}
                  onFocus={()=>{ if(query.trim()) handleQueryChange(query); }}
                />
                {/* 自动补全下拉 */}
                {suggestions.length > 0 && (
                  <div className={styles.suggestDropdown}>
                    {suggestions.map(s => (
                      <div key={s} className={styles.suggestItem} onMouseDown={e=>{ e.preventDefault(); setQuery(s); navigate('/travel', { state: { dest: s } }); }}>
                        <span className={styles.suggestIcon}>📍</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className={styles.searchBtn} onClick={() => query.trim() ? navigate('/travel', { state: { dest: query.trim() } }) : navigate('/travel')}>出行规划</button>
            </div>
            <div className={styles.aiHint}>AI结合实时路况+拥堵预测，为您推荐最优路线</div>
          </div>

          {/* 拥堵指数卡片 */}
          {snapshot && (
            <div className={styles.indexCard}>
              <div className={styles.indexHead}>
                <span>北京 · 实时拥堵指数</span>
                <span className={styles.indexTrend}>↑ 较昨日</span>
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

        {/* 底部：快捷出行入口 */}
        <div className={styles.heroQuick}>
          {[
            { icon:'🚗', label:'驾车出行', path:'/travel' },
            { icon:'🚌', label:'公交地铁', path:'/travel' },
            { icon:'🚲', label:'骑行导航', path:'/travel' },
            { icon:'🚶', label:'步行导航', path:'/travel' },
            { icon:'🅿️', label:'停车充电', path:'/parking' },
          ].map(item => (
            <div key={item.label} className={styles.heroQuickItem} onClick={()=>navigate(item.path)}>
              <span className={styles.heroQuickIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* 实时预警浮动标签 */}
        <div className={styles.alertFloat}>
          {alerts.slice(0,3).map(a => (
            <div key={a.id} className={styles.alertFloatItem}>
              <span style={{color:severityColor(a.severity)}}>{alertIcon(a.category)}</span>
              <span className={styles.alertFloatTitle}>{a.title}</span>
              <span className={styles.alertFloatTime}>{formatRelative(a.publishTime)}</span>
            </div>
          ))}
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
            { icon:'🅿️', title:'智慧停车诱导', desc:'实时空位 · 收费标准 · 导航直达', path:'/parking', color:'#722ed1' },
            { icon:'⚡', title:'充电桩查询', desc:'空闲状态 · 功率 · 扫码充电', path:'/parking', color:'#13c2c2' },
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
