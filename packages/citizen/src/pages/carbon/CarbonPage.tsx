import React, { useEffect, useState, useCallback } from 'react';
import { getCarbonStats, addCarbonActivity } from '../../stores/persistence';
import { getRedemptions } from '../../stores/persistence';
import type { CarbonActivity, RedemptionRecord } from '../../stores/persistence';
import styles from './Carbon.module.css';

interface CarbonRecord { id:string; type:string; date:string; distance:number; duration:number; carbonSaved:number; points:number; route?:string }
interface Stats { totalPoints:number; totalCarbonSaved:number; treeEquivalent:number; carDistanceSaved:number; rankPercent:number; records:CarbonRecord[] }
interface Reward { id:number; name:string; description:string; cost:number; type:string; stock:number }

const CarbonPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [redeemMsg, setRedeemMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  const loadData = useCallback(() => {
    // 积分从独立 /api/points 读取（后端控制，前端不写死）
    fetch('/api/points').then(r=>r.json()).then(pd => {
      fetch('/api/carbon/stats').then(r=>r.json()).then(d=>{
        const base = d.data || {};
        setStats({
          totalPoints: pd.data?.points ?? 1250,
          totalCarbonSaved: base.totalCarbonSaved ?? 5267,
          treeEquivalent: Number((base.totalCarbonSaved / 5000).toFixed(2)) || 1.05,
          carDistanceSaved: Math.round((base.totalCarbonSaved || 5267) / 200),
          rankPercent: base.rankPercent ?? 15,
          records: base.records ?? [],
        });
      });
    });
    fetch('/api/rewards').then(r=>r.json()).then(d=>setRewards(d.data||[]));
    fetch('/api/redemptions').then(r=>r.json()).then(d=>setRedemptions(d.data||[]));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 模拟绿色出行
  const simulateGreenTrip = useCallback(() => {
    const trip: CarbonActivity = {
      id: 'ct_' + Date.now(),
      type: (['bus','metro','bike','walk'] as const)[Math.floor(Math.random()*4)],
      date: new Date().toISOString().slice(0, 10),
      distance: 3000 + Math.floor(Math.random() * 8000),
      duration: 600 + Math.floor(Math.random() * 1800),
      carbonSaved: Math.round(300 + Math.random() * 1200),
      points: Math.round(10 + Math.random() * 40),
      route: ['西单→王府井','国贸→中关村','天安门→前门','望京→三里屯'][Math.floor(Math.random()*4)],
    };
    addCarbonActivity(trip);
    setStats(prev => {
      if (!prev) return prev;
      return { ...prev, totalPoints: prev.totalPoints + trip.points };
    });
  }, []);

  // 兑换逻辑 — 前端只调 API，积分扣减由"后端"完成
  const handleRedeem = async () => {
    if (!confirmId) return;
    setRedeemMsg('');
    try {
      const res = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId: confirmId }),
      });
      const data = await res.json();
      if (data.code === 0 && data.data?.success) {
        setMsgType('success');
        setRedeemMsg(`✅ 兑换成功：已扣除${data.data.pointsCost}积分，剩余${data.data.remainingPoints}积分`);
        loadData(); // 刷新积分 & 兑换记录
      } else {
        setMsgType('error');
        setRedeemMsg(`❌ ${data.message || '兑换失败'}`);
      }
    } catch {
      setMsgType('error');
      setRedeemMsg('❌ 网络异常，兑换失败');
    }
    setConfirmId(null);
  };

  const typeEmoji: { [key: string]: string } = { bus:'🚌', metro:'🚇', bike:'🚲', walk:'🚶' };

  if (!stats) return <div className={styles.page}><div style={{textAlign:'center',padding:40,color:'var(--text-hint)'}}>加载中...</div></div>;

  const confirmReward = rewards.find(r => r.id === confirmId);

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
            strokeDasharray={`${Math.min(1, stats.totalPoints/2000)*327} 327`} strokeLinecap="round"
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

      {/* 消息提示 */}
      {redeemMsg && (
        <div style={{padding:10,background:msgType==='success'?'#f6ffed':'#fff1f0',color:msgType==='success'?'#52c41a':'#f5222d',borderRadius:8,fontSize:13,textAlign:'center',margin:'8px 0'}}>
          {redeemMsg}
        </div>
      )}

      {/* 确认兑换弹窗 */}
      {confirmReward && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmId(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmTitle}>确认兑换</div>
            <div style={{fontSize:14,textAlign:'center',margin:'12px 0',lineHeight:1.6}}>
              确定使用 <b style={{color:'#f5222d'}}>{confirmReward.cost}</b> 积分 <br/>
              兑换 <b>「{confirmReward.name}」</b> 吗？
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmYes} onClick={handleRedeem}>确定兑换</button>
              <button className={styles.confirmNo} onClick={() => setConfirmId(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Demo */}
      <div className={styles.demoBtn} onClick={simulateGreenTrip}>
        🚶 模拟一次绿色出行（演示积分累积）
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
                <button
                  className={styles.redeemBtn}
                  disabled={stats.totalPoints < rw.cost}
                  onClick={() => {
                    if (stats.totalPoints < rw.cost) {
                      setMsgType('error');
                      setRedeemMsg(`❌ 积分不足，当前积分${stats.totalPoints}，需要${rw.cost}积分`);
                      return;
                    }
                    setRedeemMsg('');
                    setConfirmId(rw.id);
                  }}
                >
                  {stats.totalPoints >= rw.cost ? '兑换' : '积分不足'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 兑换记录 */}
      {redemptions.length > 0 && (
        <div className={styles.rewards} style={{marginTop:16}}>
          <div className={styles.sectionTitle}>📜 我的兑换记录</div>
          <div className={styles.rewardGrid}>
            {redemptions.map(r => (
              <div key={r.id} className={styles.rewardCard} style={{opacity:0.85}}>
                <div className={styles.rewardName}>{r.reward_name}</div>
                <div style={{fontSize:12,color:'var(--text-hint)',margin:'4px 0'}}>
                  消耗 <b>{r.points_cost}</b> 积分 · {r.status === 'unused' ? '📌 未使用' : r.status === 'used' ? '✅ 已使用' : '⏰ 已过期'}
                </div>
                <div style={{fontSize:11,color:'var(--text-hint)'}}>
                  {new Date(r.redeemed_at).toLocaleDateString('zh-CN')} → {new Date(r.expires_at).toLocaleDateString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{height:32}}/>
    </div>
  );
};

export default CarbonPage;
