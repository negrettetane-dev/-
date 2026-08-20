import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RedemptionRecord } from '../../stores/persistence';
import { apiGet, apiPost } from '../../services/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { resolveRedemptionStatus, REDEMPTION_STATUS_META, formatDateSafe, formatExpiryDate, normalizeCarbonType, carbonTypeMeta } from '@zhitu/shared';
import styles from './Carbon.module.css';

interface CarbonRecord { id:string; type:string; date:string; distance:number; duration:number; carbonSaved:number; points:number; route?:string }
interface Stats { totalPoints:number; totalCarbonSaved:number; treeEquivalent:number; carDistanceSaved:number; rankPercent:number; records:CarbonRecord[] }
interface Reward { id:string; name:string; description:string; cost:number; type:string; stock:number }

const CarbonPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [redeemMsg, setRedeemMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  const loadData = useCallback(() => {
    // 未登录：只加载公共商品列表，不调用个人接口（/points /carbon/stats /redemptions）
    if (!isLoggedIn) {
      setStats(null);
      setRedemptions([]);
      apiGet<Reward[]>('/rewards').then(setRewards).catch(() => setRewards([]));
      return;
    }
    Promise.all([
      apiGet<{ points: number }>('/points'),
      apiGet<Partial<Stats>>('/carbon/stats'),
      apiGet<Reward[]>('/rewards'),
      apiGet<RedemptionRecord[]>('/redemptions'),
    ]).then(([points, base, rewardList, redemptionList]) => {
        setStats({
          totalPoints: points.points,
          totalCarbonSaved: base.totalCarbonSaved ?? 0,
          treeEquivalent: base.treeEquivalent ?? 0,
          carDistanceSaved: base.carDistanceSaved ?? 0,
          rankPercent: base.rankPercent ?? 15,
          records: base.records ?? [],
        });
        setRewards(rewardList);
        setRedemptions(redemptionList);
      })
      .catch(() => setStats(prev => prev || { totalPoints: 0, totalCarbonSaved: 0, treeEquivalent: 0, carDistanceSaved: 0, rankPercent: 0, records: [] }));
  }, [isLoggedIn]);

  useEffect(() => { loadData(); }, [loadData]);

  // 兑换逻辑 — 前端只调 API，积分扣减由"后端"完成
  const handleRedeem = async () => {
    if (!confirmId) return;
    setRedeemMsg('');
    const reward = rewards.find(r => r.id === confirmId);
    try {
      const data = await apiPost<Record<string, unknown>>('/rewards/redeem', { rewardId: confirmId });
      // 兼容后端不同返回字段：pointsCost/cost/商品价格
      const cost = Number(data.pointsCost ?? data.cost ?? reward?.cost ?? 0);
      const remaining = data.remainingPoints ?? data.remaining_points ?? data.points;
      setMsgType('success');
      setRedeemMsg(`✅ 兑换成功：已扣除${cost}积分${remaining !== undefined ? `，剩余${Number(remaining)}积分` : ''}`);
      loadData(); // 刷新积分 & 兑换记录
    } catch (error) {
      setMsgType('error');
      const raw = error instanceof Error ? error.message : '';
      // 后端英文错误码 → 中文提示
      const map: Record<string, string> = {
        'insufficient points': '积分不足，无法兑换',
        'reward not found': '商品不存在',
        'out of stock': '商品库存不足',
        'already redeemed': '该商品已兑换过',
      };
      const zh = map[raw.trim().toLowerCase()] || raw || '网络异常，兑换失败';
      setRedeemMsg(`❌ ${zh}`);
    }
    setConfirmId(null);
  };

  // 未登录：不展示个人积分，引导登录
  if (!isLoggedIn) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <span className={styles.title}>🌳 碳积分</span>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-hint)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
          <div style={{ fontSize: 15, marginBottom: 16 }}>登录后查看积分余额、绿色出行记录与兑换</div>
          <button onClick={() => navigate('/login')} style={{ padding: '10px 32px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}>
            立即登录
          </button>
        </div>
      </div>
    );
  }

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

      {/* 碳积分计算规则 */}
      <div style={{ background: '#f0f5ff', borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1677ff', marginBottom: 6 }}>📐 碳积分计算规则</div>
        <div>完成导航后按出行方式与距离结算：</div>
        <div>• 🚶 步行 / 🚲 骑行：减碳较多，积分系数最高</div>
        <div>• 🚌 公交地铁：减碳中等，积分系数较低</div>
        <div>• 🚗 驾车：不获得绿色积分</div>
        <div style={{ marginTop: 4, color: 'var(--text-hint)' }}>积分由后端按真实出行记录结算，前端仅展示，不可修改余额。</div>
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
        {stats.records.map(r=>{
          const type = normalizeCarbonType(r.type);
          const meta = carbonTypeMeta(type);
          return (
            <div key={r.id} className={styles.record}>
              <span className={styles.recordIcon}>{meta.icon}</span>
              <div className={styles.recordBody}>
                <div className={styles.recordType}>{meta.label}</div>
                <div className={styles.recordDetail}>
                  {r.route} · {(r.distance/1000).toFixed(1)}km · {Math.floor(r.duration/60)}min
                </div>
              </div>
              <div className={styles.recordPoints}>+{r.points}</div>
            </div>
          );
        })}
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
            {redemptions.map(r => {
              const status = resolveRedemptionStatus(r.status, r.expires_at);
              const statusMeta = REDEMPTION_STATUS_META[status];
              const redeemedDate = formatDateSafe(r.redeemed_at, '兑换时间未知');
              const expiryDate = formatExpiryDate(r.expires_at);
              return (
                <div key={r.id} className={styles.rewardCard} style={{opacity:0.85}}>
                  <div className={styles.rewardName}>{r.reward_name}</div>
                  <div style={{fontSize:12,color:'var(--text-hint)',margin:'4px 0'}}>
                    消耗 <b>{r.points_cost}</b> 积分 · {statusMeta.label}
                  </div>
                  <div style={{fontSize:11,color:'var(--text-hint)'}}>
                    {redeemedDate} → {expiryDate}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{height:32}}/>
    </div>
  );
};

export default CarbonPage;
