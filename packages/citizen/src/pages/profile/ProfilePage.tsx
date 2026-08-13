import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useElderly } from '../../App';
import { maskPhone } from '@zhitu/shared';
import styles from './Profile.module.css';
import { apiGet } from '../../services/apiClient';
import { AvatarIcon, AvatarPicker, DEFAULT_AVATAR } from '../../components/ui/avatar-picker';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user, logout, refreshProfile, updateUser } = useAuthStore();
  const { elderlyMode, toggleElderlyMode } = useElderly();
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    refreshProfile().catch(() => undefined);
    apiGet<{ points: number }>('/points')
      .then(data => updateUser({ carbonCredits: data.points }))
      .catch(() => undefined);
  }, [isLoggedIn, refreshProfile, updateUser]);

  const menus = [
    { icon:'🚗', label:'我的出行', desc:'历史路线、乘车记录', path:'/profile' },
    { icon:'📋', label:'我的上报', desc:'全部工单记录', path:'/profile/reports' },
    { icon:'🌳', label:'碳积分', desc:'绿色出行积分与兑换', path:'/carbon' },
    { icon:'⚙️', label:'消息设置', desc:'预警、工单、管制提醒', path:'/profile/settings' },
  ];

  return (
    <div className={styles.page}>
      {/* 用户卡片 */}
      <div className={styles.userCard}>
        <button
          type="button"
          className={styles.avatar}
          onClick={() => setIsAvatarPickerOpen(open => !open)}
          aria-expanded={isAvatarPickerOpen}
          aria-controls="avatar-picker-panel"
          aria-label={isAvatarPickerOpen ? '收起头像选择' : '更换头像'}
        >
          <AvatarIcon avatar={user?.avatar} size={58} />
        </button>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{user?.nickname || user?.username || '智途云枢用户'}</div>
          <div className={styles.userPhone}>
            {user?.phone ? maskPhone(user.phone) : (user?.email ? `📧 ${user.email}` : '未绑定手机号')}
          </div>
          <div className={styles.verified}>{user?.isVerified ? '✅ 已实名认证' : '🕐 未实名认证'}</div>
        </div>
        <button className={styles.logoutBtn} style={{ boxShadow: 'none', marginTop: 0, padding: '8px 16px', fontSize: 13 }}
          onClick={() => { if (confirm('确定退出登录吗？')) logout(); }}>
          退出登录
        </button>
      </div>

      <div className={`${styles.avatarPanel} ${isAvatarPickerOpen ? styles.avatarPanelOpen : ''}`}>
        <section id="avatar-picker-panel" className={styles.avatarSection} aria-labelledby="avatar-title">
          <div>
            <div id="avatar-title" className={styles.avatarTitle}>选择你的性格头像</div>
            <div className={styles.avatarHint}>选择后自动保存并收起</div>
          </div>
          <AvatarPicker
            value={user?.avatar || DEFAULT_AVATAR}
            onChange={avatar => {
              updateUser({ avatar });
              setIsAvatarPickerOpen(false);
            }}
          />
        </section>
      </div>

      {/* 碳积分 */}
      <div className={styles.carbonMini} onClick={()=>navigate('/carbon')}>
        <div className={styles.carbonIcon}>🌳</div>
        <div className={styles.carbonBody}>
          <div className={styles.carbonTitle}>我的碳积分</div>
          <div className={styles.carbonVal}>{user?.carbonCredits ?? 0} 积分 · 绿色出行兑换权益</div>
        </div>
        <span style={{color:'var(--text-hint)'}}>→</span>
      </div>

      {/* 菜单列表 */}
      <div className={styles.menuList}>
        {menus.map(m => (
          <div key={m.label} className={styles.menuItem} onClick={()=> navigate(m.path)}>
            <span className={styles.menuIcon}>{m.icon}</span>
            <div className={styles.menuBody}>
              <div className={styles.menuLabel}>{m.label}</div>
              <div className={styles.menuDesc}>{m.desc}</div>
            </div>
            <span style={{color:'var(--text-hint)'}}>→</span>
          </div>
        ))}
        <div className={styles.menuItem} onClick={toggleElderlyMode}>
          <span className={styles.menuIcon}>👴</span>
          <div className={styles.menuBody}>
            <div className={styles.menuLabel}>长辈简易模式</div>
            <div className={styles.menuDesc}>{elderlyMode ? '已开启：大字体、简化功能' : '大字体、语音交互、极简操作'}</div>
          </div>
          <div className={`${styles.toggle} ${elderlyMode?styles.toggleOn:''}`}>
            <div className={styles.toggleBall}/>
          </div>
        </div>
      </div>

      <div style={{height:24}}/>
    </div>
  );
};

export default ProfilePage;
