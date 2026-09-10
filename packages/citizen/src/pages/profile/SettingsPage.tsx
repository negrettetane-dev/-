import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElderly } from '../../App';
import { useAuthStore } from '../../stores/authStore';
import { getNotificationSettings, setNotificationSettings, type NotificationSettings } from '../../stores/persistence';
import { apiGet, apiPut } from '../../services/apiClient';
import styles from './Profile.module.css';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { elderlyMode, toggleElderlyMode } = useElderly();
  const userId = useAuthStore(state => state.user?.id || 'legacy');
  const [settings, setSettings] = useState<NotificationSettings>(() => getNotificationSettings(userId));
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    apiGet<NotificationSettings>('/notification-settings')
      .then(data => { setSettings(data); setNotificationSettings(data, userId); })
      .catch(() => setSettings(getNotificationSettings(userId)));
  }, [userId]);

  const items: Array<{ key: keyof NotificationSettings; label: string; description: string }> = [
    { key:'carbon', label:'碳积分推送', description:'积分获取、扣减、兑换及奖励到账提醒' },
    { key:'weather', label:'天气预警提醒', description:'影响出行的恶劣天气和气象预警' },
    { key:'event', label:'事件进度通知', description:'你提交的事件状态变化和处理结果' },
    { key:'system', label:'系统消息', description:'密码修改、邮箱绑定或修改等账号安全通知' },
  ];

  const toggleSetting = (key: keyof NotificationSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setNotificationSettings(next, userId);
    setSaveMessage('已保存');
    apiPut<NotificationSettings>('/notification-settings', next)
      .then(data => { setSettings(data); setNotificationSettings(data, userId); })
      .catch(() => setSaveMessage('已保存到当前设备，联网后将同步'));
  };

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
            <span><span className={styles.settingsLabel}>{item.label}</span><small className={styles.settingsDescription}>{item.description}</small></span>
            <button type="button" role="switch" aria-checked={settings[item.key]} aria-label={item.label} className={`${styles.toggle} ${settings[item.key]?styles.toggleOn:''}`} onClick={() => toggleSetting(item.key)}>
              <span className={styles.toggleBall}/>
            </button>
          </div>
        ))}
        {saveMessage && <div className={styles.settingsSaved}>{saveMessage}</div>}
      </div>

      <div className={styles.settingsSection}>
        <div className={styles.settingsItem}>
          <span className={styles.settingsLabel}>👴 关怀模式</span>
          <button type="button" role="switch" aria-checked={elderlyMode} aria-label="关怀模式" className={`${styles.toggle} ${elderlyMode?styles.toggleOn:''}`} onClick={toggleElderlyMode}>
            <span className={styles.toggleBall}/>
          </button>
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
