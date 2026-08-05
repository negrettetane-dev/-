import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Travel.module.css';

interface RouteData {
  id:string; mode:string; distance:number; duration:number;
  tolls?:number; cost?:number; calories?:number; bikeLaneRatio?:number;
  congestionSegments?:{level:string;ratio:number}[];
  predictions?:{timeOffset:number;estimatedDuration:number;congestionLevel:string;confidence:number}[];
  segments?:{type:string;lineName?:string;fromStation?:string;toStation?:string;fromStop?:string;toStop?:string;crowding?:string;nextBusArrival?:number}[];
  aiAdvice?:string; bestDepartTime?:number;
}

const RouteResultPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { origin = '我的位置', destination = '目的地', mode = 'drive' } = (location.state || {}) as { origin?:string; destination?:string; mode?:string };
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    fetch(`/api/route/plan?origin=${origin}&dest=${destination}&mode=${mode}`)
      .then(r=>r.json()).then(d=>d.data&&setRoutes(Array.isArray(d.data)?d.data:[d.data]));
  }, [origin, destination, mode]);

  const congestionColor = (l:string) => ({ free:'#52c41a', slow:'#fadb14', congested:'#ff7a00', blocked:'#f5222d' } as Record<string,string>)[l]||'#999';
  const crowdingEmoji = (c:string|undefined) => c==='empty'?'🟢':c==='normal'?'🟡':c==='crowded'?'🟠':'🔴';

  const formatDuration = (s:number) => s<3600?`${Math.floor(s/60)}分钟`:`${Math.floor(s/3600)}h${Math.floor((s%3600)/60)}min`;

  if (!routes.length) {
    return <div className={styles.page}><div style={{textAlign:'center',padding:40,color:'var(--text-hint)'}}>规划中...</div></div>;
  }

  const route = routes[selectedIdx];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.resultHeader}>
        <span onClick={()=>navigate(-1)} style={{cursor:'pointer',fontSize:18}}>←</span>
        <div className={styles.resultRoute}>
          <span>{origin}</span>
          <span style={{margin:'0 4px'}}>→</span>
          <span>{destination}</span>
        </div>
      </div>

      {/* Route map area - simplified visualization */}
      <div className={styles.resultMap}>
        <div style={{position:'relative',height:'100%',background:'#1a1a2e',borderRadius:12,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{color:'#fff',textAlign:'center'}}>
            <div style={{fontSize:40}}>🗺️</div>
            <div style={{fontSize:14,marginTop:8}}>{origin} → {destination}</div>
            <div style={{fontSize:12,color:'#ccc',marginTop:4}}>智能规划路线</div>
          </div>
          {/* Simulated route path */}
          <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%'}} viewBox="0 0 400 180">
            <path d="M20,90 Q100,30 200,90 T380,90" fill="none" stroke="#1677ff" strokeWidth="3" strokeDasharray="8,4"/>
            <circle cx="20" cy="90" r="6" fill="#52c41a"/>
            <circle cx="380" cy="90" r="6" fill="#f5222d"/>
            <text x="200" y="50" fill="#faad14" fontSize="14" textAnchor="middle">⚠ 拥堵路段</text>
          </svg>
        </div>
      </div>

      {/* Route options */}
      <div className={styles.optionScroll}>
        {routes.map((r,i)=>(
          <div key={r.id} className={`${styles.routeCard} ${i===selectedIdx?styles.routeCardActive:''}`} onClick={()=>setSelectedIdx(i)}>
            <div className={styles.routeCardHeader}>
              <span style={{fontSize:18}}>{r.mode==='drive'?'🚗':r.mode==='bus'?'🚌':r.mode==='bike'?'🚲':'🚶'}</span>
              <div>
                <span className={styles.routeDuration}>{formatDuration(r.duration)}</span>
                <span style={{fontSize:12,color:r.duration<routes[0].duration?'#52c41a':'var(--text-hint)',marginLeft:4}}>
                  {i===0?'推荐':i===1?'备选':'经济'}
                </span>
              </div>
              <span style={{color:'var(--text-secondary)',fontSize:13}}>
                {(r.distance/1000).toFixed(1)}km
              </span>
            </div>

            {/* Congestion prediction timeline */}
            {r.predictions && (
              <div className={styles.predictionRow}>
                {r.predictions.map((p,j)=>(
                  <div key={j} className={styles.predictionDot}>
                    <div style={{width:12,height:12,borderRadius:'50%',background:congestionColor(p.congestionLevel),margin:'0 auto'}}/>
                    <span style={{fontSize:9,color:'var(--text-hint)'}}>{p.timeOffset}min</span>
                  </div>
                ))}
                <span style={{fontSize:10,color:'var(--text-hint)',marginLeft:4}}>未来路况预测</span>
              </div>
            )}

            {/* Congestion bar */}
            {r.congestionSegments && (
              <div className={styles.congestionBar}>
                {r.congestionSegments.map((s,i)=>(
                  <div key={i} style={{flex:s.ratio,background:congestionColor(s.level),height:'100%',borderRadius:2}}/>
                ))}
              </div>
            )}

            {/* Transit segments */}
            {r.segments && (
              <div className={styles.segments}>
                {r.segments.map((s,i)=>(
                  <div key={i} className={styles.segment}>
                    <span>{s.type==='walk'?'🚶':s.type==='metro'?'🚇':'🚌'}</span>
                    <span style={{fontSize:12,fontWeight:500}}>{s.lineName||s.type}</span>
                    <span style={{fontSize:11,color:'var(--text-hint)'}}>
                      {s.fromStation||s.fromStop||''} → {s.toStation||s.toStop||''}
                    </span>
                    {s.crowding && <span>{crowdingEmoji(s.crowding)}</span>}
                    {s.nextBusArrival && <span style={{color:'var(--primary)',fontSize:11}}>{Math.floor(s.nextBusArrival/60)}分钟后到</span>}
                  </div>
                ))}
              </div>
            )}

            {/* AI Advice */}
            {r.aiAdvice && (
              <div className={styles.aiAdvice}>
                <span>🤖 AI建议：</span>
                <span>{r.aiAdvice}</span>
              </div>
            )}

            {/* Bike info */}
            {r.mode==='bike' && (
              <div className={styles.bikeInfo}>
                <span>🔥 约{r.calories}kcal</span>
                <span>🛣️ 自行车道占比 {(r.bikeLaneRatio||0)*100}%</span>
              </div>
            )}

            <button className={styles.navBtn}>🚀 开始导航</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RouteResultPage;
