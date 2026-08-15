import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElderly } from '../../App';
import styles from './Elderly.module.css';

const ElderlyHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { toggleElderlyMode } = useElderly();
  const [dest, setDest] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [busResult, setBusResult] = useState<{name:string;arrival:number;crowding:string}[]>([]);
  const [sosOpen, setSosOpen] = useState(false);

  const handleVoiceInput = () => {
    setVoiceActive(true);
    setTimeout(()=>{ setVoiceActive(false); setDest('北京市第一人民医院'); }, 2000);
  };

  const handleBusQuery = () => {
    setBusResult([
      { name:'8路', arrival:180, crowding:'normal' },
      { name:'56路', arrival:420, crowding:'crowded' },
    ]);
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
        {/* 1. Where to go */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>1️⃣ 想去哪儿</div>
          <div className={styles.voiceInput} onClick={handleVoiceInput}>
            <span style={{fontSize:32}}>🎤</span>
            <span>{voiceActive ? '正在聆听...' : '点击语音输入目的地'}</span>
          </div>
          <div style={{fontSize:13,color:'#ad6800',marginTop:6}}>语音识别为演示功能，点击后示例填入目的地</div>
          <input className={styles.input} placeholder="或手写输入目的地" value={dest} onChange={e=>setDest(e.target.value)}/>
          {dest && <button className={styles.btn} onClick={()=>navigate('/travel')}>🔍 查询路线</button>}
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
