import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentLocation } from '../../services/locationService';
import {
  querySchedules,
  recommendSchedules,
  COMMON_CITIES,
  type QueryResult,
  type Recommendation,
} from '../../services/longDistanceBusService';
import styles from './LongDistanceBus.module.css';

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtDuration(from: string, to: string): string {
  const [h1, m1] = from.split(':').map(Number);
  const [h2, m2] = to.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins <= 0) return '次日到达';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}小时${m ? `${m}分钟` : ''}`;
}

const LongDistanceBusPage: React.FC = () => {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(todayStr());
  const [results, setResults] = useState<QueryResult[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [userLng, setUserLng] = useState<number | undefined>();
  const [userLat, setUserLat] = useState<number | undefined>();
  const [querySeq, setQuerySeq] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // 购票跳转确认（不直接打开第三方）
  const [purchaseTarget, setPurchaseTarget] = useState<QueryResult | null>(null);

  // 进入页面尝试定位（用于距离推荐；失败降级，不影响查询）
  useMemo(() => {
    getCurrentLocation()
      .then(pos => { setUserLng(pos.lng); setUserLat(pos.lat); })
      .catch(() => { /* 定位失败：智能推荐退化为按时间/余票排序 */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const doSearch = () => {
    if (!origin.trim() || !destination.trim()) {
      setError('请填写出发地和目的地');
      return;
    }
    setError('');
    setSearching(true);
    setQuerySeq(seq => seq + 1);
    // 模拟网络延迟，让「库存刷新」可见
    setTimeout(() => {
      const seq = querySeq + 1;
      const found = querySchedules(origin, destination, date, seq, userLng, userLat);
      setResults(found);
      setRecommendation(recommendSchedules(found, userLng, userLat));
      setSearched(true);
      setSearching(false);
      if (found.length === 0) {
        // 无直达班次：给出替代方案提示
      }
    }, 500);
  };

  const refreshPrices = () => {
    setRefreshing(true);
    setQuerySeq(seq => seq + 1);
    setTimeout(() => {
      const seq = querySeq + 1;
      const found = querySchedules(origin, destination, date, seq, userLng, userLat);
      setResults(found);
      setRecommendation(recommendSchedules(found, userLng, userLat));
      setRefreshing(false);
    }, 400);
  };

  const openPurchase = (item: QueryResult) => {
    if (item.inventory.saleStatus === 'sold_out') return;
    setPurchaseTarget(item);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>← 返回</button>
        <span className={styles.title}>🚌 长途客运</span>
      </div>

      {/* 查询表单 */}
      <div className={styles.formCard}>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>🚩 出发地</span>
          <input
            className={styles.fieldInput}
            placeholder="请输入出发城市/车站"
            value={origin}
            onChange={e => setOrigin(e.target.value)}
          />
        </div>
        <div className={styles.swapRow}>
          <button type="button" className={styles.swapBtn} onClick={swap} title="交换出发地/目的地" aria-label="交换出发地和目的地">⇄</button>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>📍 到达地</span>
          <input
            className={styles.fieldInput}
            placeholder="请输入目的城市/车站"
            value={destination}
            onChange={e => setDestination(e.target.value)}
          />
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>📅 出发日期</span>
          <input
            type="date"
            className={styles.fieldInput}
            value={date}
            min={todayStr()}
            onChange={e => e.target.value && setDate(e.target.value)}
          />
        </div>

        {/* 常用城市快捷 */}
        <div className={styles.cityRow}>
          {COMMON_CITIES.map(c => (
            <button key={c} type="button" className={styles.cityChip}
              onClick={() => { if (!origin) setOrigin(c); else if (!destination) setDestination(c); }}>
              {c}
            </button>
          ))}
        </div>

        <button type="button" className={styles.searchBtn} onClick={doSearch} disabled={searching}>
          {searching ? '查询中...' : '🔍 查询班次'}
        </button>
        {error && <div className={styles.errorText}>⚠️ {error}</div>}
        <div className={styles.demoTag}>演示数据 · 班次与库存为模拟，仅供功能展示</div>
      </div>

      {/* 智能推荐（可解释、可降级） */}
      {searched && recommendation.length > 0 && (
        <div className={styles.recoSection}>
          <div className={styles.sectionTitle}>🧠 智能推荐</div>
          {recommendation.map((rec, i) => (
            <div key={rec.schedule.id} className={styles.recoCard}>
              <div className={styles.recoHead}>
                <span className={styles.recoBadge}>{i === 0 ? '推荐' : i === 1 ? '备选' : '其他'}</span>
                <span className={styles.recoRoute}>{rec.schedule.originStation} → {rec.schedule.destinationStation}</span>
              </div>
              <div className={styles.recoTime}>🕒 {rec.schedule.departureTime} 发车 · {fmtDuration(rec.schedule.departureTime, rec.schedule.arrivalTime)}</div>
              <div className={styles.recoReasons}>
                {rec.reasons.map((r, j) => <span key={j} className={styles.recoReason}>{r}</span>)}
              </div>
              <div className={styles.recoPrice}>¥{rec.inventory.price} · 余 {rec.inventory.remainingTickets} 张</div>
            </div>
          ))}
          <div className={styles.recoHint}>💡 推荐基于距离、发车时间与余票；缺实时路况/天气时按此排序，不伪装为实时事实。</div>
        </div>
      )}

      {/* 查询结果 */}
      {searched && !searching && (
        <div className={styles.resultSection}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>
              {results.length > 0
                ? `${origin.trim()} → ${destination.trim()} · ${date}`
                : `「${origin.trim()} → ${destination.trim()}」`}
            </span>
            {results.length > 0 && (
              <button type="button" className={styles.refreshBtn} onClick={refreshPrices} disabled={refreshing}>
                {refreshing ? '刷新中...' : '🔄 刷新余票/价格'}
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className={styles.emptyCard}>
              <div className={styles.emptyTitle}>今日暂无合适班次</div>
              <div className={styles.emptyHint}>
                可尝试：<br />
                • 查看附近汽车站（如长沙汽车南站）<br />
                • 选择换乘方案（先到临近城市再中转）<br />
                • 改期到明天
              </div>
            </div>
          ) : (
            <div className={styles.list}>
              {results.map(item => {
                const soldOut = item.inventory.saleStatus === 'sold_out';
                const almost = item.inventory.saleStatus === 'almost_sold';
                return (
                  <div key={item.schedule.id} className={styles.scheduleCard}>
                    <div className={styles.scheduleHead}>
                      <span className={styles.providerTag}>{item.schedule.providerName}</span>
                      <span className={soldOut ? styles.stockSold : almost ? styles.stockLow : styles.stockOk}>
                        {soldOut ? '已售罄' : almost ? `仅剩 ${item.inventory.remainingTickets} 张` : `余 ${item.inventory.remainingTickets} 张`}
                      </span>
                    </div>
                    <div className={styles.scheduleRoute}>
                      <div className={styles.scheduleStation}>
                        <div className={styles.scheduleTime}>{item.schedule.departureTime}</div>
                        <div className={styles.schedulePlace}>{item.schedule.originStation}</div>
                      </div>
                      <div className={styles.scheduleArrow}>↓</div>
                      <div className={styles.scheduleStation}>
                        <div className={styles.scheduleTime}>{item.schedule.arrivalTime}</div>
                        <div className={styles.schedulePlace}>{item.schedule.destinationStation}</div>
                      </div>
                    </div>
                    <div className={styles.scheduleMeta}>
                      <span>耗时 {fmtDuration(item.schedule.departureTime, item.schedule.arrivalTime)}</span>
                      <span className={styles.schedulePrice}>¥{item.inventory.price}</span>
                    </div>
                    {item.distanceKm != null && (
                      <div className={styles.scheduleDist}>距出发站 {item.distanceKm.toFixed(1)}km</div>
                    )}
                    <button
                      type="button"
                      className={styles.buyBtn}
                      disabled={soldOut}
                      onClick={() => openPurchase(item)}
                    >
                      {soldOut ? '已售罄' : '立即购买'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 购票跳转确认（不直接打开第三方） */}
      {purchaseTarget && (
        <div className={styles.overlay} onClick={() => setPurchaseTarget(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>正在跳转合作购票平台</div>
            <div className={styles.modalInfo}>
              <div>查询信息已同步</div>
              <div className={styles.modalRoute}>{purchaseTarget.schedule.originStation} → {purchaseTarget.schedule.destinationStation}</div>
              <div className={styles.modalMeta}>
                <span>日期 {date}</span>
                <span>发车 {purchaseTarget.schedule.departureTime}</span>
              </div>
              <div className={styles.modalMeta}>
                <span>票价 ¥{purchaseTarget.inventory.price}</span>
                <span>平台 {purchaseTarget.schedule.providerName}</span>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancel} onClick={() => setPurchaseTarget(null)}>取消</button>
              <button type="button" className={styles.modalConfirm}
                onClick={() => {
                  // 演示：跳转合作平台（真实环境由后端即时生成购票深链）
                  window.open('https://www.e2go.com.cn', '_blank', 'noopener');
                  setPurchaseTarget(null);
                }}>
                前往购票 →
              </button>
            </div>
            <div className={styles.modalHint}>演示环境仅展示跳转示意，真实购票由合作平台完成。</div>
          </div>
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
};

export default LongDistanceBusPage;
