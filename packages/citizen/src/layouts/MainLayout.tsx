import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useElderly } from '../App';
import { maskPhone } from '@zhitu/shared';
import styles from './MainLayout.module.css';
import ClickSpark from '../components/ClickSpark/ClickSpark';
import { AvatarIcon } from '../components/ui/avatar-picker';

const ABOUT_CONTENT: Record<string, string> = {
  '平台介绍': '智途云枢是面向城市交通治理的智慧出行平台，融合多源交通数据与智能决策能力，为市民提供实时路况、出行规划、公交地铁、停车充电、事件上报、碳积分等一站式出行服务。',
  '隐私政策': '我们重视您的隐私保护。您的账号信息、位置数据仅用于提供出行服务，不会向无关第三方披露。详细隐私政策请以官网公示版本为准。',
  '用户协议': '使用智途云枢即表示您同意遵守平台服务条款。请勿利用平台进行违法违规活动，事件上报请确保信息真实准确，恶意上报需承担相应责任。',
};

const NAV_ITEMS = [
  { key: '/', label: '首页', icon: '🏠' },
  { key: '/travel', label: '出行规划', icon: '🧭' },
  { key: '/parking', label: '停车充电', icon: '🅿️' },
  { key: '/report', label: '事件上报', icon: '📷' },
  { key: '/news', label: '交通资讯', icon: '📰' },
  { key: '/services', label: '便民服务', icon: '🧰' },
  { key: '/carbon', label: '碳积分', icon: '🌳' },
];

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, logout } = useAuthStore();
  const { elderlyMode } = useElderly();
  const currentPath = location.pathname;
  const [aboutModal, setAboutModal] = useState('');

  // 长辈模式或详情页时不显示标准导航
  const isFullScreen = currentPath.startsWith('/elderly');

  // 判断当前激活菜单
  const activeKey = NAV_ITEMS.find(item => {
    if (item.key === '/') return currentPath === '/';
    return currentPath.startsWith(item.key);
  })?.key || '';

  if (isFullScreen) {
    return <>{children}</>;
  }

  return (
    <ClickSpark
      sparkColors={['#ff9fb3', '#ffe29a', '#9de5c3', '#a8d8ff', '#d9b8ff']}
      sparkSize={10}
      sparkRadius={24}
      sparkCount={10}
      duration={500}
      extraScale={1.1}
    >
    <div className={styles.site}>
      {/* ===== 顶部导航栏 ===== */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo} onClick={() => navigate('/')}>
            <span className={styles.logoIcon}>🚦</span>
            <span className={styles.logoText}>智途云枢</span>
            <span className={styles.logoSub}>城市智慧交通</span>
          </div>

          <nav className={styles.nav}>
            {NAV_ITEMS.map(item => (
              <div
                key={item.key}
                className={`${styles.navItem} ${activeKey === item.key ? styles.navActive : ''}`}
                onClick={() => navigate(item.key)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </nav>

          <div className={styles.headerRight}>
            {elderlyMode && (
              <button className={styles.elderlyBadge} onClick={() => navigate('/elderly')}>👴 长辈模式</button>
            )}
            {isLoggedIn ? (
              <div className={styles.userArea}>
                <div className={styles.avatar} onClick={() => navigate('/profile')}><AvatarIcon avatar={user?.avatar} size={32} /></div>
                <div className={styles.userInfo} onClick={() => navigate('/profile')}>
                  <div className={styles.userName}>{user?.nickname || user?.username || '市民用户'}</div>
                  <div className={styles.userPhone}>{user?.phone ? maskPhone(user.phone) : (user?.email || '')}</div>
                </div>
                <button className={styles.logoutBtn} onClick={logout}>退出</button>
              </div>
            ) : (
              <div className={styles.loginArea}>
                <button className={styles.loginBtn} onClick={() => navigate('/login')}>登录</button>
                <button className={styles.registerBtn} onClick={() => navigate('/register')}>注册</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ===== 主体内容区 ===== */}
      <main className={styles.main}>
        <div className={styles.container}>{children}</div>
      </main>

      {/* ===== 页脚 ===== */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerCol}>
            <div className={styles.footerLogo}>🚦 智途云枢</div>
            <div className={styles.footerDesc}>基于多源数据融合与智能决策的城市智慧交通平台</div>
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerTitle}>出行服务</div>
            <div className={styles.footerLink} onClick={() => navigate('/travel')}>出行规划</div>
            <div className={styles.footerLink} onClick={() => navigate('/parking')}>停车充电</div>
            <div className={styles.footerLink} onClick={() => navigate('/carbon')}>碳积分</div>
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerTitle}>互动参与</div>
            <div className={styles.footerLink} onClick={() => navigate('/report')}>事件上报</div>
            <div className={styles.footerLink} onClick={() => navigate('/news')}>交通资讯</div>
            <div className={styles.footerLink} onClick={() => navigate('/services')}>便民服务</div>
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerTitle}>关于我们</div>
            <div className={styles.footerLink} onClick={() => setAboutModal('平台介绍')}>平台介绍</div>
            <div className={styles.footerLink} onClick={() => setAboutModal('隐私政策')}>隐私政策</div>
            <div className={styles.footerLink} onClick={() => setAboutModal('用户协议')}>用户协议</div>
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerTitle}>联系我们</div>
            <div className={styles.footerLink}>📞 服务热线: 400-000-0000</div>
            <div className={styles.footerLink}>✉️ 邮箱: support@zhitu.cn</div>
            <div className={styles.footerLink}>📍 北京市朝阳区智慧交通中心</div>
          </div>
        </div>
        <div className={styles.copyright}>
          © 2026 智途云枢 · 城市智慧交通平台 · 计算机设计大赛参赛作品
        </div>
      </footer>

      {/* 关于我们说明弹窗 */}
      {aboutModal && (
        <div className={styles.aboutOverlay} onClick={() => setAboutModal('')}>
          <div className={styles.aboutModal} onClick={e => e.stopPropagation()}>
            <div className={styles.aboutHeader}>
              <span className={styles.aboutTitle}>{aboutModal}</span>
              <span className={styles.aboutClose} onClick={() => setAboutModal('')}>✕</span>
            </div>
            <div className={styles.aboutBody}>{ABOUT_CONTENT[aboutModal] || ''}</div>
            <button className={styles.aboutBtn} onClick={() => setAboutModal('')}>知道了</button>
          </div>
        </div>
      )}
    </div>
    </ClickSpark>
  );
};

export default MainLayout;
