import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiClient';
import { useAuthStore } from '../../stores/authStore';
import styles from './Report.module.css';

interface WorkOrder { id:string; workOrderNo:string; category:string; description:string; status:string; createTime:number; userId?: string|number; }

const CATEGORY_ICONS: Record<string,string> = {
  '路面坑洼':'🕳️','路灯损坏':'💡','违停占道':'🚗','井盖破损':'⭕',
  '信号灯故障':'🚦','事故线索':'🚨','道路障碍':'🚧','其他问题':'📝',
};
const STATUS_MAP: Record<string,{label:string;color:string;bg:string}> = {
  pending:{label:'待受理',color:'#faad14',bg:'#fff7e6'},
  received:{label:'已受理',color:'#1677ff',bg:'#e6f4ff'},
  processing:{label:'处置中',color:'#ff7a00',bg:'#fff1f0'},
  completed:{label:'已办结',color:'#52c41a',bg:'#e6ffe6'},
  resolved:{label:'已办结',color:'#52c41a',bg:'#e6ffe6'},
  closed:{label:'已关闭',color:'#999',bg:'#f5f5f5'},
  rejected:{label:'已驳回',color:'#f5222d',bg:'#fff1f0'},
};
const formatTime = (ts:number) => new Date(ts).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});

const ReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [reports, setReports] = useState<WorkOrder[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    apiGet<WorkOrder[]>('/report/list')
      .then(setReports)
      .catch(() => setLoadError('上报记录加载失败，请稍后重试'));
  }, []);

  // 区分来源：有归属字段且匹配当前用户 → 我的上报；演示/联调记录 → 演示数据
  const renderSource = (r: WorkOrder) => {
    const mine = r.userId !== undefined && user && String(r.userId) === String(user.id);
    if (mine) {
      return <span style={{ fontSize: 11, background: '#e6f4ff', color: '#1677ff', padding: '2px 6px', borderRadius: 4 }}>我的上报</span>;
    }
    const isDemo = /联调|测试|演示/.test(r.description || '');
    return isDemo
      ? <span style={{ fontSize: 11, background: '#fff7e6', color: '#ad6800', padding: '2px 6px', borderRadius: 4 }}>演示数据</span>
      : <span style={{ fontSize: 11, background: '#f0f0f0', color: '#666', padding: '2px 6px', borderRadius: 4 }}>市民上报</span>;
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.title}>📷 事件上报</span>
        <button className={styles.newBtn} onClick={()=>navigate('/report/new')}>+ 新建上报</button>
      </div>

      <div className={styles.queryLink} onClick={()=>navigate('/report/query')}>
        🔍 免登录查询工单进度 →
      </div>

      <div className={styles.sectionTitle}>我的上报记录</div>
      {loadError ? (
        <div className={styles.empty}>{loadError}</div>
      ) : reports.length === 0 ? (
        <div className={styles.empty}>还没有上报记录，点击"新建上报"反馈交通问题</div>
      ) : (
        <div className={styles.list}>
          {reports.map(r => {
            const s = STATUS_MAP[r.status]||STATUS_MAP.pending;
            return (
              <div key={r.id} className={styles.card} onClick={()=>navigate(`/report/detail/${r.id}`)}>
                <div className={styles.cardHeader}>
                  <span>{(CATEGORY_ICONS[r.category]||'📝')} {r.category}</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {renderSource(r)}
                    <span style={{fontSize:11,background:s.bg,color:s.color,padding:'3px 8px',borderRadius:4}}>{s.label}</span>
                  </span>
                </div>
                <div className={styles.cardDesc}>{r.description}</div>
                <div className={styles.cardMeta}>
                  <span>{r.workOrderNo}</span>
                  <span>{formatTime(r.createTime)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{height:24}}/>
    </div>
  );
};

export default ReportPage;
