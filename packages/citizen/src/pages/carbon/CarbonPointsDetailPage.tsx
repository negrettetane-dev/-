import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiClient';
import styles from './Carbon.module.css';

const CarbonPointsDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<Array<{ id: string; title: string; detail: string; points: number; date: string; kind: 'earn' | 'spend' }>>([]);
  useEffect(() => { apiGet<{ records?: Array<{ id: string; points: number; date: string; route?: string; type?: string }> }>('/carbon/stats').then(data => setRecords((data.records || []).map(r => ({ id: r.id, title: '绿色出行', detail: `${r.route || '完成绿色出行'} · ${r.type || ''}`, points: r.points, date: new Date(r.date).toLocaleString('zh-CN'), kind: 'earn' })))).catch(() => undefined); }, []);
  return <div className={styles.detailPage}>
    <button className={styles.backButton} onClick={() => navigate('/carbon')}>← 返回我的碳积分</button>
    <div className={styles.detailHeader}><span>📊</span><div><h2>积分详情</h2><p>每一次绿色选择都值得记录</p></div></div>
    <div className={styles.timeline}>{records.length === 0 ? <div className={styles.emptyState}>暂无积分变更记录</div> : records.map(record => <div className={styles.timelineItem} key={record.id}>
      <div className={styles.timelineDot} />
      <div className={styles.timelineBody}><div className={styles.timelineTop}><b>{record.title}</b><strong className={record.kind === 'earn' ? styles.earn : styles.spend}>{record.kind === 'earn' ? '+' : '-'}{Math.abs(record.points)} 分</strong></div><div className={styles.timelineDetail}>{record.detail}</div><time>{record.date}</time></div>
    </div>)}</div>
  </div>;
};
export default CarbonPointsDetailPage;
