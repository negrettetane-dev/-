import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElderly } from '../../App';
import { useTravelLocationStore, type UnifiedLocation } from '../../stores/travelLocationStore';
import { useTravelPlanStore } from '../../stores/travelPlanStore';
import { useNavigationStore, type ElderlyDisplayMode, type ElderlyRouteMode } from '../../stores/navigationStore';
import { searchLocationCandidates, reverseGeocodeDetail } from '../../services/locationService';
import { planAmapRoute } from '../../services/routePlanningService';
import { isTransitSupported } from '../../services/transitEligibility';
import LocationPickerModal from '../movecar/LocationPickerModal';
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
  const { disableElderlyMode } = useElderly();
  const origin = useTravelLocationStore(s => s.origin);
  const [dest, setDest] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [busResult, setBusResult] = useState<{name:string;arrival:number;crowding:string}[]>([]);
  const [sosOpen, setSosOpen] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);

  // 起点选择：更换弹窗 / 手动输入 / 地图选点
  const [originPickerOpen, setOriginPickerOpen] = useState(false);
  const [manualOriginMode, setManualOriginMode] = useState(false);
  const [manualOriginText, setManualOriginText] = useState('');
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [originLocating, setOriginLocating] = useState(false);

  // 导航状态机 + 候选
  const [displayMode, setDisplayMode] = useState<ElderlyDisplayMode>(readMode);
  const [status, setStatus] = useState<PlanStatus>('idle');
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [candidates, setCandidates] = useState<UnifiedLocation[]>([]);
  const [pendingDest, setPendingDest] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isBusy = status === 'locating' || status === 'resolving' || status === 'planning';
  const originValid = origin.lng != null && origin.lat != null;

  // 挂载时：无有效起点则尝试真实定位（不使用固定北京坐标兜底）
  useEffect(() => {
    const o = useTravelLocationStore.getState().origin;
    if (!o.lng || !o.lat) {
      setOriginLocating(true);
      void useTravelLocationStore.getState().locate()
        .catch(() => undefined)
        .finally(() => setOriginLocating(false));
    }
  }, []);

  const startLocate = () => {
    setOriginLocating(true);
    void useTravelLocationStore.getState().locate()
      .catch(() => undefined)
      .finally(() => setOriginLocating(false));
  };

  // 手动输入起点：真实候选搜索，选第一个，写入完整对象（含 city/adcode）
  const confirmManualOrigin = async () => {
    const text = manualOriginText.trim();
    if (!text) return;
    setOriginLocating(true);
    let list: UnifiedLocation[] = [];
    try { list = await searchLocationCandidates(text); } catch { list = []; }
    setOriginLocating(false);
    if (list.length === 0) {
      setStatus('error');
      setErrorText(`没有找到起点「${text}」，请换个名字试试`);
      return;
    }
    useTravelLocationStore.getState().setOrigin(list[0]);
    setManualOriginMode(false);
    setManualOriginText('');
    setErrorText('');
  };

  // 地图选点：坐标 + 逆地理补 city/adcode → 写入完整对象
  const applyPickedOrigin = async (lng: number, lat: number, address: string) => {
    const loc: UnifiedLocation = { name: '地图选点', address, lng, lat, source: 'map-select' };
    try {
      const detail = await reverseGeocodeDetail(lng, lat);
      loc.address = detail.address || address;
      loc.city = detail.city;
      loc.adcode = detail.adcode;
    } catch { /* 保留地址 */ }
    useTravelLocationStore.getState().setOrigin(loc);
    setErrorText('');
  };

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
    // 起点由「从哪里出发」卡片管理；无效则提示先选起点
    const o = useTravelLocationStore.getState().origin;
    if (!o.lng || !o.lat) {
      setStatus('error');
      setErrorText('请先选择起点');
      setOriginPickerOpen(true);
      return;
    }

    // 搜索目的地候选（真实高德 POI，不用固定坐标表）
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
    await startNavigation(o, list[0]);
  };

  // 规划路线 → 写入 store → 进入长辈导航页
  const startNavigation = async (originLoc: UnifiedLocation, destLoc: UnifiedLocation) => {
    setCandidates([]);
    setPendingDest('');
    // 起终点坐标必须完整：缺坐标不规划、不进入导航页
    if (originLoc.lng == null || originLoc.lat == null || destLoc.lng == null || destLoc.lat == null) {
      setStatus('error');
      setErrorText('起点或终点缺少位置信息，请重新选择');
      setSubmitting(false);
      return;
    }
    // 公交：调用前先判断同城（city/adcode 可用时提前拦截）
    const option = MODE_OPTIONS.find(m => m.key === displayMode) || MODE_OPTIONS[0];
    if (option.route === 'bus') {
      const transitCheck = isTransitSupported(originLoc, destLoc);
      if (!transitCheck.supported) {
        setStatus('error');
        setErrorText(transitCheck.message || '当前起终点不在同一城市，暂不支持跨城市公交/地铁规划。');
        setSubmitting(false);
        return;
      }
    }
    setStatus('planning');
    setStatusText('正在规划路线…');
    try {
      const route = await planAmapRoute(option.route, [originLoc.lng, originLoc.lat], [destLoc.lng, destLoc.lat]);
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (option.route === 'bus' && msg.includes('CROSS_CITY_TRANSIT_UNSUPPORTED')) {
        setStatus('error');
        setErrorText('当前起终点不在同一城市，暂不支持跨城市公交/地铁规划。');
      } else {
        setStatus('error');
        setErrorText('路线规划失败，请稍后重试');
      }
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Top bar：返回首页 ≠ 退出长辈模式 */}
      <div className={styles.topBar}>
        <button className={styles.exitBtn} onClick={() => navigate('/')} style={{ marginRight: 'auto' }}>🏠 返回首页</button>
        <span className={styles.logo}>智途云枢 · 长辈模式</span>
        <button className={styles.exitBtn} onClick={() => setExitConfirm(true)} style={{ marginLeft: 'auto' }}>退出长辈模式</button>
      </div>

      {/* 退出长辈模式确认弹窗 */}
      {exitConfirm && (
        <div className={styles.sosOverlay} onClick={() => setExitConfirm(false)}>
          <div className={styles.sosDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.sosTitle}>确定退出长辈模式吗？</div>
            <div className={styles.sosDesc}>退出后将恢复普通模式显示。</div>
            <div className={styles.sosActions} style={{ display: 'flex', gap: 10 }}>
              <button className={styles.sosClose} onClick={() => setExitConfirm(false)} style={{ flex: 1 }}>继续使用</button>
              <button className={styles.btn} onClick={() => { disableElderlyMode(); setExitConfirm(false); navigate('/'); }} style={{ flex: 1 }}>退出</button>
            </div>
          </div>
        </div>
      )}

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
        {/* 1. 想去哪儿 — 长辈导航入口 */}
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

          {/* 📍 从哪里出发：真实起点选择（默认定位，支持更换/手动/地图选点） */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>📍 从哪里出发</div>
            {originValid ? (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>📍 {origin.name || '我的位置'}</div>
                  <div style={{ fontSize: 15, color:'var(--text-secondary)' }}>{origin.address || ''}</div>
                </div>
                <button type="button" className={styles.btn} style={{ width:'auto', padding:'10px 18px' }} onClick={() => setOriginPickerOpen(true)}>更换</button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 16, color:'var(--text-secondary)' }}>{originLocating ? '正在获取您的位置…' : '没有获取到您的位置'}</div>
                <div style={{ display:'flex', gap:10, marginTop:10 }}>
                  <button type="button" className={styles.btn} style={{ width:'auto', padding:'10px 18px' }} onClick={startLocate}>重新定位</button>
                  <button type="button" className={styles.btn} style={{ width:'auto', padding:'10px 18px' }} onClick={() => setOriginPickerOpen(true)}>选择起点</button>
                </div>
              </div>
            )}
          </div>

          {/* 手动输入起点（更换弹窗选择「输入其他位置」后显示大字号输入框） */}
          {manualOriginMode && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 16, marginBottom: 8 }}>输入起点位置：</div>
              <input className={styles.input} placeholder="如：北京市西单" value={manualOriginText} onChange={e=>setManualOriginText(e.target.value)} />
              <button type="button" className={styles.btn} style={{ marginTop: 8 }} disabled={originLocating} onClick={() => void confirmManualOrigin()}>
                {originLocating ? '正在查找…' : '确定起点'}
              </button>
            </div>
          )}

          {/* 更换起点弹窗（长辈友好大按钮） */}
          {originPickerOpen && (
            <div className={styles.sosOverlay} onClick={() => setOriginPickerOpen(false)}>
              <div className={styles.sosDialog} onClick={e => e.stopPropagation()}>
                <div className={styles.sosTitle}>从哪里出发？</div>
                <div className={styles.sosActions} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <button type="button" className={styles.btn} onClick={() => { setOriginPickerOpen(false); startLocate(); }}>📍 使用我的当前位置</button>
                  <button type="button" className={styles.btn} onClick={() => { setOriginPickerOpen(false); setManualOriginMode(true); }}>⌨️ 输入其他位置</button>
                  <button type="button" className={styles.btn} onClick={() => { setOriginPickerOpen(false); setMapPickerOpen(true); }}>🗺️ 地图选择位置</button>
                  <button type="button" className={styles.sosClose} onClick={() => setOriginPickerOpen(false)}>取消</button>
                </div>
              </div>
            </div>
          )}

          {/* 地图选点弹窗（复用 MoveCarPage 组件） */}
          {mapPickerOpen && (
            <LocationPickerModal
              initial={originValid ? { lng: origin.lng!, lat: origin.lat!, address: origin.address, source: 'map' } : null}
              onConfirm={(loc) => { setMapPickerOpen(false); void applyPickedOrigin(loc.lng, loc.lat, loc.address); }}
              onCancel={() => setMapPickerOpen(false)}
            />
          )}

          {/* 语音输入目的地 */}
          <div className={styles.voiceInput} onClick={handleVoiceInput}>
            <span style={{fontSize:32}}>🎤</span>
            <span>{voiceActive ? '正在聆听...' : '点击语音输入目的地'}</span>
          </div>
          <div style={{fontSize:13,color:'#ad6800',marginTop:6}}>语音识别为演示功能，点击后示例填入目的地</div>
          <input className={styles.input} placeholder="输入目的地，如：天安门" value={dest} onChange={e=>setDest(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') void handleElderlyNavigation(); }}/>
          {dest && <button className={styles.btn} disabled={isBusy} onClick={()=>void handleElderlyNavigation()}>
            {status === 'resolving' ? '正在查找目的地…' : status === 'planning' ? '正在规划路线…' : '🚀 开始导航'}
          </button>}

          {/* 状态提示 */}
          {status === 'error' && (
            <div style={{ marginTop:10, padding:10, background:'#fff1f0', color:'#f5222d', borderRadius:8, fontSize:15 }}>
              ⚠️ {errorText}
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
                    const o = useTravelLocationStore.getState().origin;
                    void startNavigation(o, c);
                  }}>
                  {c.name}{c.address ? ` · ${c.address}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. 公交车到哪了 */}
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

        {/* 3. 上报问题 */}
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
