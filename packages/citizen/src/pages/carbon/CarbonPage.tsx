import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCarbonConfig, getPointRules, type RedemptionRecord, type CitizenCarbonConfig, type CitizenPointRule } from '../../stores/persistence';
import { apiGet, apiPost } from '../../services/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { resolveRedemptionStatus, formatDateSafe, formatExpiryDate } from '@zhitu/shared';
import styles from './Carbon.module.css';

interface CarbonRecord { id:string; type:string; date:string; distance:number; duration:number; carbonSaved:number; points:number; route?:string }
interface Stats { totalPoints:number; totalCarbonSaved:number; treeEquivalent:number; carDistanceSaved:number; rankPercent:number; records:CarbonRecord[] }
interface Reward { id:string; name:string; description:string; cost:number; type:string; stock:number }

function normalizeCarbonType(raw: unknown): 'bus' | 'metro' | 'bike' | 'walk' {
  const value = String(raw || '').toLowerCase();
  if (value.includes('metro') || value.includes('subway') || value.includes('地铁')) return 'metro';
  if (value.includes('bus') || value.includes('公交')) return 'bus';
  if (value.includes('bike') || value.includes('骑')) return 'bike';
  return 'walk';
}

function carbonTypeMeta(type: ReturnType<typeof normalizeCarbonType>): { label: string; icon: string } {
  return ({ bus: { label: '公交', icon: '🚌' }, metro: { label: '地铁', icon: '🚇' }, bike: { label: '骑行', icon: '🚲' }, walk: { label: '步行', icon: '🚶' } })[type];
}

const CarbonPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [redeemMsg, setRedeemMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [carbonConfig, setCarbonConfig] = useState<CitizenCarbonConfig>(getCarbonConfig());
  const [pointRules, setPointRules] = useState<CitizenPointRule[]>(getPointRules());
  const markUsed = async (record: RedemptionRecord) => { setRedemptions(items => { const updated = items.map(item => item.id === record.id ? { ...item, status: 'used' } : item); return [...updated.filter(item => resolveRedemptionStatus(item.status, item.expires_at) === 'unused'), ...updated.filter(item => resolveRedemptionStatus(item.status, item.expires_at) !== 'unused')]; }); try { await apiPost(`/redemptions/${encodeURIComponent(record.id)}/use`, {}); } catch { setRedeemMsg('核销状态已更新，网络同步稍后重试'); } };

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
  useEffect(() => {
    const refreshConfig = () => { setCarbonConfig(getCarbonConfig()); setPointRules(getPointRules()); };
    window.addEventListener('storage', refreshConfig);
    return () => window.removeEventListener('storage', refreshConfig);
  }, []);

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
        <div className={styles.headerActions}><span className={styles.rank}>🏅 排名前 {stats.rankPercent}%</span><button className={styles.rank} onClick={() => navigate('/carbon/points-detail')}>路口 · 积分详情 →</button></div>
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

      <div style={{ background: '#f0f5ff', borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1677ff', marginBottom: 6 }}>📐 碳积分计算规则</div>
        <div style={{ fontWeight: 600, color: '#101828' }}>实际轨迹距离（km）× 减碳系数 × 固定积分 = 碳积分</div>
        <div>仅完成步行、骑行、公交、地铁或新能源汽车出行后计分；路线预览、未完成或异常行程不计分。</div>
        <div>当前系数：步行 {carbonConfig.carbonFactors.walk ?? 1} · 骑行 {carbonConfig.carbonFactors.bike ?? 0.8} · 地铁 {carbonConfig.carbonFactors.metro ?? 0.6} · 公交 {carbonConfig.carbonFactors.bus ?? 0.5} · 新能源汽车 {carbonConfig.carbonFactors.new_energy_vehicle ?? 0.2}</div>
        <div>固定积分：公交 {pointRules.find(r => r.action === 'bus_ride')?.points ?? 5} · 地铁 {pointRules.find(r => r.action === 'metro_ride')?.points ?? 5} · 骑行 {pointRules.find(r => r.action === 'bike_ride')?.points ?? 10} · 步行 {pointRules.find(r => r.action === 'walk')?.points ?? 10} · 新能源汽车 {pointRules.find(r => r.action === 'new_energy_vehicle_ride')?.points ?? 1}。</div>
        <div>单次最多计入 {carbonConfig.maxTripDistanceKm} km；积分由后端最终结算，管理端调整后本页会同步更新。</div>
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
        {stats.records.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-hint)', fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🌱</div>
            暂无绿色出行记录
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 4 }}>
              完成一次公交/骑行/步行导航后，将自动生成积分记录
            </div>
          </div>
        ) : (
          stats.records.map(r=>{
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
          })
        )}
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
          <div className={styles.sectionTitle}>📜 我的兑换记录 <button className={styles.sectionArrow} onClick={() => navigate('/carbon/redemptions')}>→</button></div>
          <div className={styles.rewardGrid}>
            {redemptions.slice(0, 2).map(r => {
              const status = resolveRedemptionStatus(r.status, r.expires_at);
              const redeemedDate = formatDateSafe(r.redeemed_at, '兑换时间未知');
              const expiryDate = formatExpiryDate(r.expires_at);
              return (
                <div key={r.id} className={styles.rewardCard} style={{opacity:0.85}}>
                  <div className={styles.rewardName}>{r.reward_name}</div>
                  <div style={{fontSize:12,color:'var(--text-hint)',margin:'4px 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>消耗 <b>{r.points_cost}</b> 积分</span>{status === 'unused' ? <button className={styles.useButton} onClick={() => markUsed(r)}>去使用</button> : <span className={styles.usedButton}>已使用</span>}
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
