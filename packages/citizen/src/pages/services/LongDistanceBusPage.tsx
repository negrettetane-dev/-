import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentLocation } from '../../services/locationService';
import {
  querySchedules,
  recommendSchedules,
  getPurchaseUrl,
  createPurchase,
  COMMON_CITIES,
  type QueryResult,
  type Recommendation,
  type DataSource,
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
  const [dataSource, setDataSource] = useState<DataSource>('demo');
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [userLng, setUserLng] = useState<number | undefined>();
  const [userLat, setUserLat] = useState<number | undefined>();
  const [querySeq, setQuerySeq] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // 购票跳转确认
  const [purchaseTarget, setPurchaseTarget] = useState<QueryResult | null>(null);
  const [purchaseLink, setPurchaseLink] = useState<{ url: string; source: DataSource } | null>(null);
  // 是否已确认「购票信息已同步」（确认后不再直接打开外部深链，避免 404）
  const [purchaseSynced, setPurchaseSynced] = useState(false);
  const [purchaseNo, setPurchaseNo] = useState('');
  const mountedRef = useRef(true);

  // 进入页面尝试定位（用于距离推荐；失败降级，不影响查询）
  useEffect(() => {
    mountedRef.current = true;
    getCurrentLocation()
      .then(pos => {
        if (!mountedRef.current) return;
        setUserLng(pos.lng); setUserLat(pos.lat);
      })
      .catch(() => { /* 定位失败：智能推荐退化为按时间/余票排序 */ });
    return () => { mountedRef.current = false; };
  }, []);

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const doSearch = async () => {
    if (!origin.trim() || !destination.trim()) {
      setError('请填写出发地和目的地');
      return;
    }
    setError('');
    setSearching(true);
    setQuerySeq(seq => seq + 1);
    const seq = querySeq + 1;
    try {
      const { results: found, source } = await querySchedules(origin, destination, date, seq, userLng, userLat);
      if (!mountedRef.current) return;
      setResults(found);
      setRecommendation(recommendSchedules(found, userLng, userLat));
      setDataSource(source);
      setSearched(true);
    } finally {
      if (mountedRef.current) setSearching(false);
    }
  };

  const refreshPrices = async () => {
    if (results.length === 0) return;
    setRefreshing(true);
    setQuerySeq(seq => seq + 1);
    const seq = querySeq + 1;
    try {
      const { results: found, source } = await querySchedules(origin, destination, date, seq, userLng, userLat);
      if (!mountedRef.current) return;
      setResults(found);
      setRecommendation(recommendSchedules(found, userLng, userLat));
      setDataSource(source);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  };

  const openPurchase = async (item: QueryResult) => {
    if (item.inventory.saleStatus === 'sold_out') return;
    setPurchaseTarget(item);
    setPurchaseLink(null);
    setPurchaseSynced(false);
    const { link, source } = await getPurchaseUrl(item.schedule, date, 1);
    if (!mountedRef.current) return;
    setPurchaseLink({ url: link.purchaseUrl, source });
  };

  // 点击「确认购票信息」：创建购票记录（后端存储），再进入已同步态
  const confirmPurchase = async () => {
    if (!purchaseTarget) return;
    const { purchase, source } = await createPurchase(
      purchaseTarget.schedule,
      date,
      1,
      purchaseTarget.inventory.price,
    );
    if (!mountedRef.current) return;
    // 保存本次购票号，用于已同步态展示
    setPurchaseSynced(true);
    setPurchaseLink(prev => ({ ...(prev || { url: '', source }), url: prev?.url || '' }));
    setPurchaseNo(purchase.purchaseNo);
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
          <input className={styles.fieldInput} placeholder="请输入出发城市/车站" value={origin} onChange={e => setOrigin(e.target.value)} />
        </div>
        <div className={styles.swapRow}>
          <button type="button" className={styles.swapBtn} onClick={swap} title="交换出发地/目的地" aria-label="交换出发地和目的地">⇄</button>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>📍 到达地</span>
          <input className={styles.fieldInput} placeholder="请输入目的城市/车站" value={destination} onChange={e => setDestination(e.target.value)} />
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>📅 出发日期</span>
          <input type="date" className={styles.fieldInput} value={date} min={todayStr()} onChange={e => e.target.value && setDate(e.target.value)} />
        </div>

        <div className={styles.cityRow}>
          {COMMON_CITIES.map(c => (
            <button key={c} type="button" className={styles.cityChip}
              onClick={() => { if (!origin) setOrigin(c); else if (!destination) setDestination(c); }}>
              {c}
            </button>
          ))}
        </div>

        <button type="button" className={styles.searchBtn} onClick={() => void doSearch()} disabled={searching}>
          {searching ? '查询中...' : '🔍 查询班次'}
        </button>
        {error && <div className={styles.errorText}>⚠️ {error}</div>}
        <div className={styles.demoTag}>班次与库存以合作平台实时数据为准；后端未接入时显示演示数据</div>
      </div>

      {/* 智能推荐 */}
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
              {dataSource === 'demo' && <span className={styles.sourceTag}>演示数据</span>}
            </span>
            {results.length > 0 && (
              <button type="button" className={styles.refreshBtn} onClick={() => void refreshPrices()} disabled={refreshing}>
                {refreshing ? '刷新中...' : '🔄 刷新余票/价格'}
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className={styles.emptyCard}>
              <div className={styles.emptyTitle}>今日暂无合适班次</div>
              <div className={styles.emptyHint}>
                可尝试：<br />
                • 查看附近汽车站<br />
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
                    <button type="button" className={styles.buyBtn} disabled={soldOut} onClick={() => void openPurchase(item)}>
                      {soldOut ? '已售罄' : '立即购买'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 购票流程：确认购票信息 → 购票信息已同步（不直接打开外部深链，避免 404） */}
      {purchaseTarget && (
        <div className={styles.overlay} onClick={() => { setPurchaseTarget(null); setPurchaseLink(null); setPurchaseSynced(false); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>{purchaseSynced ? '✅ 购票信息已同步' : '确认购票信息'}</div>
            <div className={styles.modalInfo}>
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

            {purchaseSynced ? (
              <>
                <div className={styles.syncNote}>✅ 购票信息已同步至合作平台，可前往官网完成出票。</div>
                {purchaseNo && <div className={styles.purchaseNo}>购票记录号：{purchaseNo}</div>}
                <div className={styles.demoHint}>
                  当前演示环境未接入真实购票平台，以下为合作平台官网入口，具体班次购票请以官网为准。
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.modalCancel} onClick={() => navigate('/profile/reservations')}>查看我的预约/购票</button>
                  <button type="button" className={styles.modalConfirm}
                    onClick={() => {
                      window.open('https://www.e2go.com.cn/', '_blank', 'noopener');
                      setPurchaseTarget(null);
                      setPurchaseLink(null);
                      setPurchaseSynced(false);
                      setPurchaseNo('');
                    }}>
                    前往 e2Go 官网 →
                  </button>
                </div>
              </>
            ) : (
              <>
                {purchaseLink?.source === 'demo' && (
                  <div className={styles.demoHint}>当前为演示购票链接，接入合作平台后由后端即时生成。</div>
                )}
                <div className={styles.modalActions}>
                  <button type="button" className={styles.modalCancel} onClick={() => { setPurchaseTarget(null); setPurchaseLink(null); setPurchaseSynced(false); }}>取消</button>
                  <button type="button" className={styles.modalConfirm}
                    disabled={!purchaseLink}
                    onClick={() => void confirmPurchase()}>
                    {purchaseLink ? '确认购票信息 →' : '正在生成购票链接...'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
};

export default LongDistanceBusPage;
