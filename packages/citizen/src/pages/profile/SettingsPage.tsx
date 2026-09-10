import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElderly } from '../../App';
import { useAuthStore } from '../../stores/authStore';
import {
  getNotificationSettings,
  setNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '../../stores/persistence';
import { apiGet, apiPut } from '../../services/apiClient';
import styles from './Profile.module.css';

const NOTIFICATION_ITEMS: { key: keyof NotificationSettings; label: string; desc: string }[] = [
  { key: 'congestion', label: '拥堵预警推送', desc: '常走路线出现拥堵时提醒' },
  { key: 'weather', label: '天气预警提醒', desc: '暴雨、大风等恶劣天气提醒' },
  { key: 'control', label: '交通管制通知', desc: '道路管制、施工封路信息' },
  { key: 'workorder', label: '工单进度通知', desc: '上报事件的受理与办结通知' },
  { key: 'system', label: '系统消息', desc: '版本更新、账号安全等公告' },
];

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { elderlyMode, toggleElderlyMode } = useElderly();
  const { isLoggedIn, user } = useAuthStore();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [synced, setSynced] = useState<'idle' | 'syncing' | 'ok' | 'local'>('idle');

  const userId = user?.id || 'legacy';

  useEffect(() => {
    // 1) 先用本地持久化数据立即渲染（刷新不丢）
    setSettings(getNotificationSettings(userId));
    // 2) 已登录则尝试从后端拉取最新设置（跨设备同步）
    if (!isLoggedIn) return;
    let alive = true;
    apiGet<Partial<NotificationSettings>>('/users/me/notification-settings')
      .then(remote => {
        if (!alive || !remote) return;
        const merged = { ...DEFAULT_NOTIFICATION_SETTINGS, ...remote };
        setSettings(merged);
        setNotificationSettings(merged, userId);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [isLoggedIn, userId]);

  // 切换开关：立即写入本地持久化，并尽力同步到后端
  const toggle = (key: keyof NotificationSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setNotificationSettings(next, userId);
    if (!isLoggedIn) return; // 未登录：仅本地持久化
    setSynced('syncing');
    apiPut('/users/me/notification-settings', next)
      .then(() => setSynced('ok'))
      .catch(() => setSynced('local')); // 后端暂未提供接口时静默降级为仅本地保存
  };

  const syncText = {
    idle: '',
    syncing: '正在同步到云端...',
    ok: '已同步到云端，多设备生效',
    local: '暂存本机（云端同步暂不可用）',
  }[synced];

  return (
    <div className={styles.settingsPage}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
        <span onClick={()=>navigate(-1)} style={{cursor:'pointer',fontSize:20}}>←</span>
        <span style={{fontSize:18,fontWeight:700}}>设置</span>
      </div>

      <div className={styles.settingsSection}>
        <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>🔔 消息通知</div>
        {NOTIFICATION_ITEMS.map(item => (
          <div key={item.key} className={styles.settingsItem}>
            <span className={styles.settingsLabel}>
              {item.label}
              <span style={{display:'block',fontSize:11,color:'var(--text-hint)',fontWeight:400,marginTop:2}}>{item.desc}</span>
            </span>
            <div
              className={`${styles.toggle} ${settings[item.key]?styles.toggleOn:''}`}
              onClick={()=>toggle(item.key)}
              role="switch"
              aria-checked={settings[item.key]}
              aria-label={item.label}
            >
              <div className={styles.toggleBall}/>
            </div>
          </div>
        ))}
        <div style={{fontSize:11,color:'var(--text-hint)',marginTop:6,minHeight:14}}>
          {syncText}
        </div>
      </div>

      <div className={styles.settingsSection}>
        <div className={styles.settingsItem}>
          <span className={styles.settingsLabel}>👴 关怀模式</span>
          <div className={`${styles.toggle} ${elderlyMode?styles.toggleOn:''}`} onClick={toggleElderlyMode}>
            <div className={styles.toggleBall}/>
          </div>
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
