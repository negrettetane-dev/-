import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../services/apiClient';
import styles from './Report.module.css';

interface ProcessLog { time:number; action:string; operator:string; detail:string }
interface ReportLocation { address:string; longitude:number; latitude:number; locationType?:string; locationStatus?:string; accuracy?:number; poiName?:string; city?:string; locatedAt?:string }
interface WorkOrder {
  id:string;
  workOrderNo:string;
  category:string;
  description:string;
  images?:string[];
  beforeImages?:string[];
  position?:[number,number];
  eventLocation?:ReportLocation | null;
  address?:string;
  location?:string;
  status:string;
  createTime:number;
  updateTime?:number;
  processLogs?:ProcessLog[];
  rating?:number;
  afterImage?:string;
  afterImages?:string[];
  platformFeedback?: string;
  feedback?: string;
  department?: string;
  assignee?: string;
  estimatedProcessTime?: string;
}

const STATUS_LABELS: Record<string,string> = { pending:'待受理', received:'已受理', processing:'处置中', completed:'已办结', resolved:'已办结', closed:'已关闭', rejected:'已驳回' };
const STATUS_COLORS: Record<string,string> = { pending:'#faad14', received:'#1677ff', processing:'#ff7a00', completed:'#52c41a', resolved:'#52c41a', closed:'#8c8c8c', rejected:'#f5222d' };
const CAT_MAP: Record<string,string> = {
  pothole:'🕳️ 路面坑洼', streetlight:'💡 路灯损坏', illegal_park:'🚗 违停占道', manhole:'⭕ 井盖破损', signal_fault:'🚦 信号灯故障', accident_clue:'🚨 事故线索', barrier:'🚧 道路障碍',
  accessibility_elevator:'🛗 无障碍电梯故障', accessibility_ramp:'♿ 坡道/入口异常', accessibility_path:'🦯 盲道/通道障碍', accessibility_station:'🚉 站点设施异常', other:'📝 其他问题',
};
const LOCATION_TYPE_LABELS: Record<string,string> = { auto: '自动定位', manual: '手动选点', search: '搜索选点' };

const formatDateTime = (time?: number | string) => time ? new Date(time).toLocaleString('zh-CN') : '-';
const isCompleted = (status: string) => status === 'completed' || status === 'resolved' || status === 'closed';

const ReportDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<WorkOrder | null>(null);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);
  const [ratingMessage, setRatingMessage] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // 走统一 apiClient（自动携带 Bearer Token），避免裸 fetch 无鉴权导致 401
  useEffect(() => {
    let alive = true;
    if (!id) return;
    const load = () => apiGet<WorkOrder>(`/report/detail/${id}`).then(data => {
      if (!alive) return;
      setReport(data);
      setRating(data.rating || 0);
    });
    load()
      .catch(() => { if (alive) setError('工单不存在或您无权查看'); });
    const timer = window.setInterval(load, 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [id]);

  const locationInfo = useMemo(() => {
    if (!report) return null;
    const lng = report.eventLocation?.longitude ?? report.position?.[0];
    const lat = report.eventLocation?.latitude ?? report.position?.[1];
    return {
      address: report.eventLocation?.address || report.address || report.location || '位置待确认',
      lng,
      lat,
      type: report.eventLocation?.locationType,
      status: report.eventLocation?.locationStatus,
      accuracy: report.eventLocation?.accuracy,
    };
  }, [report]);

  const beforeImages = useMemo(() => [...(report?.beforeImages || []), ...(report?.images || [])].filter(Boolean), [report]);
  const afterImages = useMemo(() => [...(report?.afterImages || []), ...(report?.afterImage ? [report.afterImage] : [])].filter(Boolean), [report]);
  const feedback = report?.platformFeedback || report?.feedback || '';
  const accessibilityIncident = Boolean(report?.category?.startsWith('accessibility'));

  const submitRating = async () => {
    if (!report || !rating) { setRatingMessage('请先选择满意度评分'); return; }
    setSubmittingRating(true);
    setRatingMessage('');
    try {
      const updated = await apiPost<WorkOrder>(`/report/detail/${report.id}/rating`, { rating });
      setReport(updated);
      setRating(updated.rating || rating);
      setRatingMessage('评价已提交，感谢反馈');
    } catch (error) {
      setRatingMessage(error instanceof Error ? error.message : '评价提交失败，请稍后重试');
    } finally {
      setSubmittingRating(false);
    }
  };

  const replanAccessibleRoute = () => {
    if (!report) return;
    const destination = locationInfo?.address || '障碍事件位置';
    navigate('/travel/result', {
      state: {
        origin: '我的位置',
        destination,
        destinationCoords: locationInfo?.lng && locationInfo?.lat ? { lng: locationInfo.lng, lat: locationInfo.lat } : null,
        mode: 'accessible',
        departureMode: 'now',
        departureAt: new Date().toISOString(),
        departureTimeLabel: '现在出发',
      },
    });
  };

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
        <div style={{fontSize:28,fontWeight:700,color:STATUS_COLORS[report.status] || '#1677ff',margin:'8px 0'}}>{STATUS_LABELS[report.status] || report.status}</div>
        <div style={{fontSize:13,color:'var(--text-secondary)'}}>{CAT_MAP[report.category] || report.category}</div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formTitle}>🧾 基础信息</div>
        <div className={styles.detailGrid}>
          <div><span>上报时间</span><b>{formatDateTime(report.createTime)}</b></div>
          <div><span>更新时间</span><b>{formatDateTime(report.updateTime || report.createTime)}</b></div>
          <div><span>受理部门</span><b>{report.department || '待平台分派'}</b></div>
          <div><span>预计处理时间</span><b>{report.estimatedProcessTime || '待评估'}</b></div>
          {report.assignee && <div><span>处理队伍</span><b>{report.assignee}</b></div>}
        </div>
        <div className={styles.detailDescription}>{report.description}</div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formTitle}>📍 事件位置</div>
        <div className={styles.locationPreview}>
          <div className={styles.mapCard}>
            <div className={styles.mapPin}>📍</div>
            <div className={styles.mapGrid}/>
          </div>
          <div className={styles.locationMeta}>
            <b>{locationInfo?.address || '位置待确认'}</b>
            <span>{locationInfo?.type ? LOCATION_TYPE_LABELS[locationInfo.type] || locationInfo.type : '位置来源待确认'}{locationInfo?.accuracy != null ? ` · 精度约${Math.round(locationInfo.accuracy)}m` : ''}</span>
            {locationInfo?.lng && locationInfo?.lat && <span>坐标 {locationInfo.lng.toFixed(5)}, {locationInfo.lat.toFixed(5)}</span>}
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formTitle}>📝 上报文字和图片</div>
        <div className={styles.detailDescription}>{report.description}</div>
        {beforeImages.length > 0 ? (
          <div className={styles.detailImageGrid}>{beforeImages.map((src, index) => <img key={`${src}-${index}`} src={src} alt={`上报图片 ${index + 1}`} />)}</div>
        ) : (
          <div className={styles.emptyHint}>暂无上报图片；当前演示环境尚未接入真实图片上传接口。</div>
        )}
      </div>

      <div className={styles.formSection}>
        <div className={styles.formTitle}>🖼️ 处理前后图片</div>
        <div className={styles.beforeAfterGrid}>
          <div>
            <span>处理前</span>
            {beforeImages[0] ? <img src={beforeImages[0]} alt="处理前" /> : <div className={styles.imagePlaceholder}>暂无处理前图片</div>}
          </div>
          <div>
            <span>处理后</span>
            {afterImages[0] ? <img src={afterImages[0]} alt="处理后" /> : <div className={styles.imagePlaceholder}>待上传处理后照片</div>}
          </div>
        </div>
      </div>

      {accessibilityIncident && (
        <div className={styles.accessibilityNotice}>
          <div><b>♿ 无障碍设施故障</b><span>该事件可能影响轮椅、视障、老年人等群体出行。</span></div>
          <button type="button" onClick={replanAccessibleRoute}>重新规划无障碍路线</button>
        </div>
      )}

      {/* Process Timeline */}
      <div className={styles.formSection}>
        <div className={styles.formTitle}>📋 完整状态时间线</div>
        {(report.processLogs || []).length > 0 ? (
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
                  <div className={styles.timelineTime}>{formatDateTime(log.time)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className={styles.emptyHint}>暂无处理记录</div>}
      </div>

      {feedback && <div className={styles.formSection}><div className={styles.formTitle}>📣 平台反馈</div><div style={{ lineHeight: 1.7 }}>{feedback}</div></div>}

      {/* Rating (if completed) */}
      {isCompleted(report.status) && (
        <div className={styles.formSection}>
          <div className={styles.formTitle}>⭐ 服务评价</div>
          <div className={styles.rating}>
            {[1,2,3,4,5].map(i=>(
              <span key={i} className={styles.star} onClick={()=>!report.rating && setRating(i)} style={{color:i<=rating?'#faad14':'#ddd', cursor: report.rating ? 'default' : 'pointer'}}>
                ★
              </span>
            ))}
          </div>
          {report.rating ? <div className={styles.emptyHint}>已评价 {report.rating} 星，感谢反馈。</div> : <button type="button" className={styles.ratingSubmit} onClick={submitRating} disabled={submittingRating}>{submittingRating ? '提交中…' : '提交评价'}</button>}
          {ratingMessage && <div className={styles.ratingMessage}>{ratingMessage}</div>}
        </div>
      )}

      <div style={{height:32}}/>
    </div>
  );
};

export default ReportDetailPage;
