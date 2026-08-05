import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElderly } from '../../App';
import styles from './Profile.module.css';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { elderlyMode, toggleElderlyMode } = useElderly();
  const [settings, setSettings] = useState({
    congestionAlert: true,
    weatherAlert: true,
    controlAlert: false,
    workorderProgress: true,
    systemNotice: true,
  });

  const items = [
    { key:'congestionAlert', label:'拥堵预警推送' },
    { key:'weatherAlert', label:'天气预警提醒' },
    { key:'controlAlert', label:'交通管制通知' },
    { key:'workorderProgress', label:'工单进度通知' },
    { key:'systemNotice', label:'系统消息' },
  ];

  return (
    <div className={styles.settingsPage}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
        <span onClick={()=>navigate(-1)} style={{cursor:'pointer',fontSize:20}}>←</span>
        <span style={{fontSize:18,fontWeight:700}}>设置</span>
      </div>

      <div className={styles.settingsSection}>
        <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>🔔 消息通知</div>
        {items.map(item => (
          <div key={item.key} className={styles.settingsItem}>
            <span className={styles.settingsLabel}>{item.label}</span>
            <div className={`${styles.toggle} ${settings[item.key as keyof typeof settings]?styles.toggleOn:''}`}
              onClick={()=>setSettings(s=>({...s,[item.key]:!s[item.key as keyof typeof s]}))}>
              <div className={styles.toggleBall}/>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.settingsSection}>
        <div className={styles.settingsItem}>
          <span className={styles.settingsLabel}>👴 长辈简易模式</span>
          <div className={`${styles.toggle} ${elderlyMode?styles.toggleOn:''}`} onClick={toggleElderlyMode}>
            <div className={styles.toggleBall}/>
          </div>
        </div>
        <div className={styles.settingsItem}>
          <span className={styles.settingsLabel}>关于智途云枢</span>
          <span style={{color:'var(--text-hint)',fontSize:13}}>v1.0.0 →</span>
        </div>
        <div className={styles.settingsItem}>
          <span className={styles.settingsLabel}>隐私政策</span>
          <span style={{color:'var(--text-hint)',fontSize:13}}>→</span>
        </div>
        <div className={styles.settingsItem}>
          <span className={styles.settingsLabel}>用户协议</span>
          <span style={{color:'var(--text-hint)',fontSize:13}}>→</span>
        </div>
      </div>

      <div style={{textAlign:'center',padding:20,color:'var(--text-hint)',fontSize:13}}>
        <div>智途云枢 · 智慧出行 v1.0.0</div>
        <div style={{marginTop:4}}>基于多源数据融合的智慧交通平台</div>
      </div>

      <div style={{height:24}}/>
    </div>
  );
};

export default SettingsPage;
