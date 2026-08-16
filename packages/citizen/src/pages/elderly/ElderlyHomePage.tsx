import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElderly } from '../../App';
import { useTravelLocationStore, type UnifiedLocation } from '../../stores/travelLocationStore';
import { useTravelPlanStore } from '../../stores/travelPlanStore';
import { useNavigationStore, type ElderlyDisplayMode, type ElderlyRouteMode } from '../../stores/navigationStore';
import { searchLocationCandidates } from '../../services/locationService';
import { planAmapRoute } from '../../services/routePlanningService';
import styles from './Elderly.module.css';

const DEFAULT_ELDERLY_MODE: ElderlyDisplayMode = 'transit';
const MODE_OPTIONS: { key: ElderlyDisplayMode; label: string; icon: string; route: ElderlyRouteMode }[] = [
  { key: 'transit', label: '公交', icon: '🚌', route: 'bus' },
  { key: 'driving', label: '驾车', icon: '🚗', route: 'drive' },
  { key: 'walking', label: '步行', icon: '🚶', route: 'walk' },
];

type PlanStatus = 'idle' | 'locating' | 'resolving' | 'planning' | 'error';

function readMode(): ElderlyDisplayMode {
  try {
    const raw = localStorage.getItem('zhitu_elderly_nav_mode');
    if (raw === 'driving' || raw === 'walking' || raw === 'transit') return raw;
  } catch { /* ignore */ }
  return DEFAULT_ELDERLY_MODE;
}

const ElderlyHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { toggleElderlyMode } = useElderly();
  const [dest, setDest] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [busResult, setBusResult] = useState<{name:string;arrival:number;crowding:string}[]>([]);
  const [sosOpen, setSosOpen] = useState(false);

  // 长辈导航：模式 + 状态机 + 候选
  const [displayMode, setDisplayMode] = useState<ElderlyDisplayMode>(readMode);
  const [status, setStatus] = useState<PlanStatus>('idle');
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [candidates, setCandidates] = useState<UnifiedLocation[]>([]);
  const [pendingDest, setPendingDest] = useState('');
  const [manualOriginOpen, setManualOriginOpen] = useState(false);
  const [manualOrigin, setManualOrigin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isBusy = status === 'locating' || status === 'resolving' || status === 'planning';

  // 语音输入：演示功能（明确标注），识别后仅填入目的地，不自动导航
  const handleVoiceInput = () => {
    setVoiceActive(true);
    setTimeout(() => {
      setVoiceActive(false);
      setDest('北京市第一人民医院');
    }, 2000);
  };

  const handleBusQuery = () => {
    setBusResult([
      { name:'8路', arrival:180, crowding:'normal' },
      { name:'56路', arrival:420, crowding:'crowded' },
    ]);
  };

  const selectMode = (mode: ElderlyDisplayMode) => {
    setDisplayMode(mode);
    try { localStorage.setItem('zhitu_elderly_nav_mode', mode); } catch { /* ignore */ }
  };

  // ===== 唯一导航入口：键盘输入与语音识别都必须走这里 =====
  const handleElderlyNavigation = async (destText?: string) => {
    const target = (destText ?? dest).trim();
    if (!target || isBusy) return;
    setErrorText('');
    setStatus('locating');
    setStatusText('正在获取您的位置…');
    setSubmitting(true);

    // 1. 定位：优先已有 origin，否则 locate()
    let origin = useTravelLocationStore.getState().origin;
    if (!origin.lng || !origin.lat) {
      await useTravelLocationStore.getState().locate().catch(() => undefined);
      origin = useTravelLocationStore.getState().origin; // 重新读，避免闭包旧状态
    }
    if (!origin.lng || !origin.lat) {
      setStatus('error');
      setErrorText('无法获取您的位置，请允许定位权限后重试');
      setManualOriginOpen(true);
      setSubmitting(false);
      return;
    }

    // 2. 搜索目的地候选（真实高德 POI，不用固定坐标表）
    setStatus('resolving');
    setStatusText('正在查找目的地…');
    let list: UnifiedLocation[] = [];
    try { list = await searchLocationCandidates(target); } catch { list = []; }
    if (list.length === 0) {
      setStatus('error');
      setErrorText(`没有找到「${target}」，请换个名字试试`);
      setSubmitting(false);
      return;
    }
    if (list.length > 1) {
      setCandidates(list.slice(0, 3));
      setPendingDest(target);
      setStatus('idle');
      setSubmitting(false);
      return;
    }
    await startNavigation(origin, list[0]);
  };

  // 用户手动输入起点（定位失败时）：也走真实候选搜索
  const handleManualOriginConfirm = async () => {
    const text = manualOrigin.trim();
    if (!text) return;
    setStatus('locating');
    setStatusText('正在确认起点…');
    let list: UnifiedLocation[] = [];
    try { list = await searchLocationCandidates(text); } catch { list = []; }
    if (list.length === 0) {
      setStatus('error');
      setErrorText(`没有找到起点「${text}」`);
      setSubmitting(false);
      return;
    }
    const origin = list[0];
    useTravelLocationStore.getState().setOrigin(origin);
    setManualOriginOpen(false);
    setManualOrigin('');
    if (candidates.length > 0) {
      await startNavigation(origin, candidates[0]);
      setCandidates([]);
    } else if (pendingDest) {
      await handleElderlyNavigation(pendingDest);
    }
  };

  // 3+4. 规划路线 → 写入 store → 进入长辈导航页
  const startNavigation = async (originLoc: UnifiedLocation, destLoc: UnifiedLocation) => {
    setCandidates([]);
    setPendingDest('');
    // 坐标必须完整：缺坐标不规划，不伪造
    if (originLoc.lng == null || originLoc.lat == null || destLoc.lng == null || destLoc.lat == null) {
      setStatus('error');
      setErrorText('起点或终点缺少位置信息，请重新选择');
      setSubmitting(false);
      return;
    }
    setStatus('planning');
    setStatusText('正在规划路线…');
    try {
      const option = MODE_OPTIONS.find(m => m.key === displayMode) || MODE_OPTIONS[0];
      const route = await planAmapRoute(option.route, [originLoc.lng, originLoc.lat], [destLoc.lng, destLoc.lat]);
      // 路线必须真实有效：无 path 视为失败，不创建模拟路线
      if (!route || !Array.isArray(route.path) || route.path.length < 2) {
        throw new Error('route-empty');
      }
      useTravelLocationStore.getState().setOrigin(originLoc);
      useTravelPlanStore.getState().setDestination(destLoc);
      useNavigationStore.getState().setContext({
        origin: originLoc,
        destination: destLoc,
        displayMode,
        routeMode: option.route,
        route,
        source: 'elderly',
        returnPath: '/elderly',
        createdAt: Date.now(),
      });
      navigate('/elderly/navigation');
    } catch {
      setStatus('error');
      setErrorText('路线规划失败，请稍后重试');
      setSubmitting(false);
    }
  };

  const retryLocate = () => {
    setManualOriginOpen(false);
    setSubmitting(false);
    void handleElderlyNavigation(dest);
  };

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <span className={styles.logo}>智途云枢</span>
        <button className={styles.exitBtn} onClick={()=>{toggleElderlyMode();navigate('/');}}>退出长辈模式</button>
      </div>

      {/* Emergency button */}
      <div className={styles.emergency}>
        <button className={styles.emergencyBtn} onClick={() => setSosOpen(true)}>🆘 SOS 紧急求助</button>
      </div>

      {/* SOS 紧急求助弹窗 */}
      {sosOpen && (
        <div className={styles.sosOverlay} onClick={() => setSosOpen(false)}>
          <div className={styles.sosDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.sosTitle}>🆘 紧急求助</div>
            <div className={styles.sosDesc}>请选择求助方式，系统将自动发送您的位置</div>
            <div className={styles.sosActions}>
              <a href="tel:110" className={styles.sosCall} style={{background:'#1677ff'}}>📞 报警 110</a>
              <a href="tel:120" className={styles.sosCall} style={{background:'#f5222d'}}>🚑 急救 120</a>
              <a href="tel:122" className={styles.sosCall} style={{background:'#faad14'}}>🚓 交通事故 122</a>
            </div>
            <button className={styles.sosClose} onClick={() => setSosOpen(false)}>关闭</button>
          </div>
        </div>
      )}

      {/* 3 Big Buttons */}
      <div className={styles.mainButtons}>
        {/* 1. Where to go — 长辈导航入口 */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>1️⃣ 想去哪儿</div>

          {/* 出行方式：三个大按钮，默认公交 */}
          <div style={{ display:'flex', gap:10, marginBottom:12 }}>
            {MODE_OPTIONS.map(m => (
              <button key={m.key} type="button"
                className={styles.btn}
                onClick={() => selectMode(m.key)}
                style={{ background: displayMode === m.key ? 'var(--primary)' : '#eee', color: displayMode === m.key ? '#fff' : '#333', padding:'14px 0', fontSize:20 }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          <div className={styles.voiceInput} onClick={handleVoiceInput}>
            <span style={{fontSize:32}}>🎤</span>
            <span>{voiceActive ? '正在聆听...' : '点击语音输入目的地'}</span>
          </div>
          <div style={{fontSize:13,color:'#ad6800',marginTop:6}}>语音识别为演示功能，点击后示例填入目的地</div>
          <input className={styles.input} placeholder="输入目的地，如：天安门" value={dest} onChange={e=>setDest(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') void handleElderlyNavigation(); }}/>
          {dest && <button className={styles.btn} disabled={isBusy} onClick={()=>void handleElderlyNavigation()}>
            {status === 'locating' ? '正在获取您的位置…' : status === 'resolving' ? '正在查找目的地…' : status === 'planning' ? '正在规划路线…' : '🚀 开始导航'}
          </button>}

          {/* 状态提示 */}
          {status === 'error' && (
            <div style={{ marginTop:10, padding:10, background:'#fff1f0', color:'#f5222d', borderRadius:8, fontSize:15 }}>
              ⚠️ {errorText}
              {manualOriginOpen && (
                <div style={{ marginTop:8, display:'flex', gap:8 }}>
                  <input className={styles.input} placeholder="手动输入起点" value={manualOrigin} onChange={e=>setManualOrigin(e.target.value)}/>
                  <button className={styles.btn} style={{ width:'auto', padding:'0 16px' }} onClick={()=>void handleManualOriginConfirm()}>确定</button>
                </div>
              )}
              {!manualOriginOpen && (
                <button className={styles.btn} style={{ marginTop:8 }} onClick={retryLocate}>重新定位</button>
              )}
            </div>
          )}

          {/* 目的地候选：多个同名地点让长辈选择 */}
          {candidates.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:16, color:'var(--text-secondary)', marginBottom:8 }}>找到多个「{pendingDest}」，请选择：</div>
              {candidates.map((c, i) => (
                <button key={i} type="button" className={styles.btn}
                  style={{ marginBottom:8, textAlign:'left', fontSize:18 }}
                  onClick={() => {
                    const origin = useTravelLocationStore.getState().origin;
                    void startNavigation(origin, c);
                  }}>
                  {c.name}{c.address ? ` · ${c.address}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. Bus arrival */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>2️⃣ 公交车到哪了</div>
          <button className={styles.btn} onClick={handleBusQuery}>🚌 查询常用线路</button>
          {busResult.length > 0 && <div style={{fontSize:13,color:'#ad6800',marginTop:6}}>演示数据，非实时到站</div>}
          {busResult.map((b,i)=>(
            <div key={i} className={styles.busRow}>
              <span className={styles.busName}>{b.name}</span>
              <span className={styles.busArrival}>{Math.floor(b.arrival/60)}分钟后到站</span>
              <span>{b.crowding==='normal'?'🟡适中':'🟠拥挤'}</span>
            </div>
          ))}
        </div>

        {/* 3. Report issue */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>3️⃣ 上报问题</div>
          <div style={{fontSize:28,textAlign:'center'}}>📷</div>
          <div style={{fontSize:20,textAlign:'center',color:'var(--text-secondary)'}}>拍照自动识别 · 语音描述</div>
          <button className={styles.btn} onClick={()=>navigate('/report/new')}>📸 拍照上报</button>
        </div>
      </div>

      <div style={{height:32}}/>
    </div>
  );
};

export default ElderlyHomePage;
