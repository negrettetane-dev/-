import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiClient';
import { useAuthStore } from '../../stores/authStore';
import styles from './Report.module.css';

interface WorkOrder { id:string; workOrderNo:string; category:string; description:string; status:string; createTime:number; userId?: string|number; }

const CATEGORY_ICONS: Record<string,string> = {
  // 英文 key：表单提交的分类值（ReportFormPage CATEGORIES.value）
  pothole:'🕳️', streetlight:'💡', illegal_park:'🚗', manhole:'⭕',
  signal_fault:'🚦', accident_clue:'🚨', barrier:'🚧', other:'📝',
  // 中文 key：兼容旧数据/后端直接返回中文分类
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
  const { user, isLoggedIn } = useAuthStore();
  const [reports, setReports] = useState<WorkOrder[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    // 未登录不调用个人接口（避免 /events/mine 或旧 /report/list 泄漏记录）
    if (!isLoggedIn) { setReports([]); return; }
    let alive = true;
    apiGet<WorkOrder[] | { list: WorkOrder[] }>('/events/mine')
      .then(data => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : (data?.list ?? []);
        setReports(list);
      })
      .catch(() => { if (alive) setLoadError('上报记录加载失败，请稍后重试'); });
    return () => { alive = false; };
  }, [isLoggedIn]);

  // 来源标签（events/mine 返回的均属当前用户）
  const renderSource = () => (
    <span style={{ fontSize: 11, background: '#e6f4ff', color: '#1677ff', padding: '2px 6px', borderRadius: 4 }}>我的上报</span>
  );

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
      {!isLoggedIn ? (
        <div className={styles.empty}>登录后查看我的上报记录</div>
      ) : loadError ? (
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
                    {renderSource()}
                    <span style={{fontSize:11,background:s.bg,color:s.color,padding:'3px 8px',borderRadius:4}}>{s.label}</span>
                  </span>
                </div>
                <div className={styles.cardDesc}>{r.description}</div>
                <div className={styles.cardMeta}>
                  <span>{r.workOrderNo || r.id}</span>
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
