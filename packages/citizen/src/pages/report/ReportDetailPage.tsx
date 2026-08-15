import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiClient';
import styles from './Report.module.css';

interface WorkOrder { id:string; workOrderNo:string; category:string; description:string; images:string[]; position:[number,number]; address:string; status:string; createTime:number; updateTime:number; processLogs:{time:number;action:string;operator:string;detail:string}[]; rating?:number; afterImage?:string }

const STATUS_LABELS: Record<string,string> = { pending:'待受理', received:'已受理', processing:'处置中', completed:'已办结', rejected:'已驳回' };
const STATUS_COLORS: Record<string,string> = { pending:'#faad14', received:'#1677ff', processing:'#ff7a00', completed:'#52c41a', rejected:'#f5222d' };
const CAT_MAP: Record<string,string> = { pothole:'🕳️ 路面坑洼', streetlight:'💡 路灯损坏', illegal_park:'🚗 违停占道', manhole:'⭕ 井盖破损', signal_fault:'🚦 信号灯故障', accident_clue:'🚨 事故线索', barrier:'🚧 道路障碍', other:'📝 其他' };

const ReportDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<WorkOrder | null>(null);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);

  // 走统一 apiClient（自动携带 Bearer Token），避免裸 fetch 无鉴权导致 401
  useEffect(() => {
    let alive = true;
    if (!id) return;
    apiGet<WorkOrder>(`/report/detail/${id}`)
      .then(data => { if (alive) setReport(data); })
      .catch(() => { if (alive) setError('工单不存在或您无权查看'); });
    return () => { alive = false; };
  }, [id]);

  if (error) return <div className={styles.page}><div style={{textAlign:'center',padding:40}}>{error}</div></div>;
  if (!report) return <div className={styles.page}><div style={{textAlign:'center',padding:40}}>加载中...</div></div>;

  return (
    <div className={styles.formPage}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
        <span onClick={()=>navigate(-1)} style={{cursor:'pointer',fontSize:20}}>←</span>
        <span style={{fontSize:18,fontWeight:700}}>工单详情</span>
      </div>

      {/* Status Banner */}
      <div style={{background:'#fff',borderRadius:14,padding:16,textAlign:'center',marginBottom:12}}>
        <div style={{fontSize:40,marginBottom:8}}>📋</div>
        <div style={{fontSize:13,color:'var(--text-hint)'}}>{report.workOrderNo}</div>
        <div style={{fontSize:28,fontWeight:700,color:STATUS_COLORS[report.status],margin:'8px 0'}}>{STATUS_LABELS[report.status]}</div>
        <div style={{fontSize:13,color:'var(--text-secondary)'}}>{CAT_MAP[report.category]}</div>
      </div>

      {/* Description */}
      <div className={styles.formSection}>
        <div style={{fontSize:14,lineHeight:1.6}}>{report.description}</div>
        <div style={{fontSize:12,color:'var(--text-hint)',marginTop:8}}>📍 {report.address}</div>
      </div>

      {/* Process Timeline */}
      <div className={styles.formSection}>
        <div className={styles.formTitle}>📋 处理进度</div>
        <div className={styles.timeline}>
          {(report.processLogs || []).map((log,i)=>(
            <div key={i} className={styles.timelineItem}>
              <div>
                <div className={styles.timelineDot}/>
                {i<(report.processLogs?.length || 0)-1 && <div className={styles.timelineLine}/>}
              </div>
              <div className={styles.timelineContent}>
                <div className={styles.timelineAction}>{log.action}</div>
                <div className={styles.timelineDetail}>{log.detail} · {log.operator}</div>
                <div className={styles.timelineTime}>{new Date(log.time).toLocaleString('zh-CN')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rating (if completed) */}
      {report.status === 'completed' && (
        <div className={styles.formSection}>
          <div className={styles.formTitle}>⭐ 服务评价</div>
          <div className={styles.rating}>
            {[1,2,3,4,5].map(i=>(
              <span key={i} className={styles.star} onClick={()=>setRating(i)} style={{color:i<=rating?'#faad14':'#ddd'}}>
                ★
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{height:32}}/>
    </div>
  );
};

export default ReportDetailPage;
