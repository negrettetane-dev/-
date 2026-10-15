import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiClient';
import styles from './Carbon.module.css';

type SettlementStatus = 'estimated' | 'settled' | 'failed';

type ApiPointRecord = Record<string, unknown>;

interface PointRecord {
  id: string;
  tripId?: string;
  title: string;
  route: string;
  meta: string;
  points: number;
  date: string;
  kind: 'earn' | 'spend';
  settlementStatus: SettlementStatus;
}

const MODE_LABEL: Record<string, string> = {
  drive: '驾车',
  bus: '公交地铁',
  bike: '骑行',
  walk: '步行',
};

const STATUS_LABEL: Record<SettlementStatus, string> = {
  estimated: '预计',
  settled: '已结算',
  failed: '结算失败',
};

function readString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readStatus(value: unknown): SettlementStatus {
  if (value === 'failed') return 'failed';
  if (value === 'estimated' || value === 'calculating' || value === 'pending') return 'estimated';
  return 'settled';
}

function formatRecord(raw: ApiPointRecord): PointRecord {
  const id = readString(raw.id ?? raw.transaction_id ?? raw.tx_id ?? raw.trip_id) || `record_${readString(raw.date ?? raw.created_at)}`;
  const tripId = readString(raw.tripId ?? raw.trip_id ?? raw.sourceId ?? raw.source_id) || id;
  const modeValue = readString(raw.mode ?? raw.type ?? raw.transport_type ?? raw.travel_mode);
  const mode = MODE_LABEL[modeValue] || modeValue || '绿色出行';
  const distanceValue = readNumber(raw.distance ?? raw.distance_meters ?? raw.actual_distance ?? raw.estimated_distance);
  const durationValue = readNumber(raw.duration ?? raw.duration_seconds ?? raw.actual_duration ?? raw.estimated_duration);
  const carbonValue = readNumber(raw.carbonSaved ?? raw.carbon_saved ?? raw.saved_carbon ?? raw.carbon_reduction);
  const pointsValue = readNumber(raw.points ?? raw.earnedPoints ?? raw.earned_points ?? raw.amount);
  const dateValue = raw.date ?? raw.createdAt ?? raw.created_at ?? raw.settledAt ?? raw.settled_at;
  const distance = distanceValue > 0 ? ` · ${(distanceValue / 1000).toFixed(1)}km` : '';
  const carbon = carbonValue > 0 ? ` · 减碳${(carbonValue / 1000).toFixed(2)}kg` : '';
  const duration = durationValue > 0 ? ` · ${Math.max(1, Math.round(durationValue / 60))}分钟` : '';
  const date = new Date(dateValue as string | number | Date);

  return {
    id,
    tripId,
    title: readString(raw.title) || '绿色出行',
    route: readString(raw.route ?? raw.route_name) || '完成绿色出行',
    meta: `${mode}${distance}${duration}${carbon}`,
    points: pointsValue,
    date: Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('zh-CN'),
    kind: pointsValue >= 0 ? 'earn' : 'spend',
    settlementStatus: readStatus(raw.settlementStatus ?? raw.settlement_status ?? raw.status),
  };
}

const CarbonPointsDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<PointRecord[]>([]);
  useEffect(() => {
    apiGet<{ records?: ApiPointRecord[] }>('/carbon/stats')
      .then(data => setRecords((data.records || []).map(formatRecord)))
      .catch(() => undefined);
  }, []);

  return <div className={styles.detailPage}>
    <button className={styles.backButton} onClick={() => navigate('/carbon')}>← 返回我的碳积分</button>
    <div className={styles.detailHeader}><span>📊</span><div><h2>积分详情</h2><p>每一次绿色选择都值得记录</p></div></div>
    <div className={styles.timeline}>{records.length === 0 ? <div className={styles.emptyState}>暂无积分变更记录</div> : records.map(record => <div className={styles.timelineItem} key={record.id}>
      <div className={styles.timelineDot} />
      <div className={styles.timelineBody}>
        <div className={styles.timelineTop}>
          <b>{record.title}</b>
          <strong className={record.kind === 'earn' ? styles.earn : styles.spend}>{record.kind === 'earn' ? '+' : '-'}{Math.abs(record.points)} 分</strong>
        </div>
        <div className={styles.timelineDetail}>{record.route}</div>
        <div className={styles.timelineMeta}>{record.meta}</div>
        <div className={styles.timelineBottom}>
          <time>{record.date}</time>
          <span className={`${styles.settlementBadge} ${styles[`settlement_${record.settlementStatus}`]}`}>{STATUS_LABEL[record.settlementStatus]}</span>
          {record.tripId && <button type="button" onClick={() => navigate(`/profile/trips/${record.tripId}`)}>查看出行</button>}
        </div>
      </div>
    </div>)}</div>
  </div>;
};
export default CarbonPointsDetailPage;
