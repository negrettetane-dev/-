import React, { useEffect, useState } from 'react';
import styles from './Carbon.module.css';

interface CarbonRecord { id:string; type:string; date:string; distance:number; duration:number; carbonSaved:number; points:number; route?:string }
interface Stats { totalPoints:number; totalCarbonSaved:number; treeEquivalent:number; carDistanceSaved:number; rankPercent:number; records:CarbonRecord[] }
interface Reward { id:string; name:string; description:string; cost:number; type:string; stock:number }

const CarbonPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    fetch('/api/carbon/stats').then(r=>r.json()).then(d=>setStats(d.data));
    fetch('/api/carbon/rewards').then(r=>r.json()).then(d=>setRewards(d.data||[]));
  }, []);

  const typeEmoji: { [key: string]: string } = { bus:'🚌', metro:'🚇', bike:'🚲', walk:'🚶' };

  if (!stats) return <div className={styles.page}><div style={{textAlign:'center',padding:40,color:'var(--text-hint)'}}>加载中...</div></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.title}>🌳 我的碳积分</span>
        <span className={styles.rank}>🏅 排名前 {stats.rankPercent}%</span>
      </div>

      {/* Score Ring */}
      <div className={styles.scoreRing}>
        <svg viewBox="0 0 120 120" width="140" height="140">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#eee" strokeWidth="8"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="#52c41a" strokeWidth="8"
            strokeDasharray={`${(stats.totalPoints/2000)*327} 327`} strokeLinecap="round"
            transform="rotate(-90 60 60)"/>
          <text x="60" y="55" textAnchor="middle" fill="#52c41a" fontSize="28" fontWeight="700">{stats.totalPoints}</text>
          <text x="60" y="72" textAnchor="middle" fill="#999" fontSize="10">碳积分</text>
        </svg>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{(stats.totalCarbonSaved/1000).toFixed(2)}kg</span>
          <span className={styles.statLabel}>碳减排总量</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>🌲 {stats.treeEquivalent}</span>
          <span className={styles.statLabel}>等效植树(棵)</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.carDistanceSaved}km</span>
          <span className={styles.statLabel}>减少驾车里程</span>
        </div>
      </div>

      {/* Green Forest */}
      <div className={styles.forest}>
        <div className={styles.sectionTitle}>🌳 绿色出行森林</div>
        <div className={styles.trees}>
          {Array.from({length:Math.min(11,Math.floor(stats.treeEquivalent*10))}).map((_,i)=>(
            <span key={i} style={{fontSize:28}}>🌲</span>
          ))}
          {stats.treeEquivalent < 0.2 && <span style={{color:'var(--text-hint)',fontSize:13}}>开始绿色出行，种下你的第一棵树！</span>}
        </div>
      </div>

      {/* Recent Records */}
      <div className={styles.records}>
        <div className={styles.sectionTitle}>📋 近期绿色出行</div>
        {stats.records.map(r=>(
          <div key={r.id} className={styles.record}>
            <span className={styles.recordIcon}>{typeEmoji[r.type]}</span>
            <div className={styles.recordBody}>
              <div className={styles.recordType}>{r.type==='bus'?'公交':r.type==='metro'?'地铁':r.type==='bike'?'骑行':'步行'}</div>
              <div className={styles.recordDetail}>
                {r.route} · {(r.distance/1000).toFixed(1)}km · {Math.floor(r.duration/60)}min
              </div>
            </div>
            <div className={styles.recordPoints}>+{r.points}</div>
          </div>
        ))}
      </div>

      {/* Rewards */}
      <div className={styles.rewards}>
        <div className={styles.sectionTitle}>🎁 积分兑换</div>
        <div className={styles.rewardGrid}>
          {rewards.map(rw=>(
            <div key={rw.id} className={styles.rewardCard}>
              <div className={styles.rewardName}>{rw.name}</div>
              <div className={styles.rewardDesc}>{rw.description}</div>
              <div className={styles.rewardFooter}>
                <span className={styles.rewardCost}>🪙 {rw.cost}积分</span>
                <button className={styles.redeemBtn} disabled={stats.totalPoints<rw.cost}>
                  {stats.totalPoints>=rw.cost?'兑换':'积分不足'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{height:32}}/>
    </div>
  );
};

export default CarbonPage;
