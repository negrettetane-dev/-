import React from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveRedemptionStatus, formatDateSafe, formatExpiryDate } from '@zhitu/shared';
import type { RedemptionRecord } from '../../stores/persistence';
import { apiGet, apiPost } from '../../services/apiClient';
import styles from './Carbon.module.css';

const sortPendingFirst = (records: RedemptionRecord[]) => [
  ...records.filter(record => resolveRedemptionStatus(record.status, record.expires_at) === 'unused'),
  ...records.filter(record => resolveRedemptionStatus(record.status, record.expires_at) !== 'unused'),
];

const RedemptionRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = React.useState<RedemptionRecord[]>([]);
  const load = () => apiGet<RedemptionRecord[]>('/redemptions').then(items => setRecords(sortPendingFirst(items))).catch(() => undefined);
  React.useEffect(() => { void load(); }, []);

  const onUse = (record: RedemptionRecord) => {
    setRecords(items => sortPendingFirst(items.map(item => item.id === record.id ? { ...item, status: 'used' } : item)));
    apiPost(`/redemptions/${encodeURIComponent(record.id)}/use`, {}).catch(() => undefined);
  };
  const pending = records.filter(record => resolveRedemptionStatus(record.status, record.expires_at) === 'unused');
  const section = (title: string, items: RedemptionRecord[]) => <section className={styles.recordSection}><h3>{title}<span>{items.length}</span></h3>{items.length ? items.map(record => <article className={styles.redemptionItem} key={record.id}><div><b>{record.reward_name}</b><p>消耗 {record.points_cost} 积分 · {formatDateSafe(record.redeemed_at, '兑换时间未知')} · {formatExpiryDate(record.expires_at)}</p></div>{resolveRedemptionStatus(record.status, record.expires_at) === 'unused' ? <button className={styles.useButton} onClick={() => onUse(record)}>去使用</button> : <span className={styles.usedButton}>已使用</span>}</article>) : <div className={styles.emptyState}>暂无记录</div>}</section>;

  return <div className={styles.detailPage}><button className={styles.backButton} onClick={() => navigate('/carbon')}>← 返回我的碳积分</button><div className={styles.detailHeader}><span>📜</span><div><h2>我的兑换记录</h2><p>管理你的兑换权益</p></div></div>{section('待使用', pending)}{section('已使用', records.filter(record => !pending.includes(record)))}</div>;
};

export default RedemptionRecordsPage;
