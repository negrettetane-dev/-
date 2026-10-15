import { useState, useEffect, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Breadcrumb, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { isAdminLoggedIn, getAdminInfo, adminLogout } from '../stores/adminAuth';
import {
  DashboardOutlined,
  AlertOutlined,
  SettingOutlined,
  UserOutlined,
  TeamOutlined,
  GiftOutlined,
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CarOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { useUIStore } from '../stores/uiStore';
import AdminNotificationBell from '../components/AdminNotificationBell';

const { Header, Sider, Content } = Layout;

const menuItems: MenuProps['items'] = [
  { key: '/admin', icon: <DashboardOutlined />, label: '数据驾驶舱' },
  { key: '/admin/incidents', icon: <AlertOutlined />, label: '事件管理' },
  { key: '/admin/users', icon: <TeamOutlined />, label: '用户管理' },
  { key: '/admin/carbon', icon: <GiftOutlined />, label: '碳积分管理' },
  { key: '/admin/content', icon: <EditOutlined />, label: '内容管理' },
  { key: '/admin/accessibility', icon: <DeploymentUnitOutlined />, label: '无障碍设施管理' },
  { key: '/admin/settings', icon: <SettingOutlined />, label: '系统设置' },
];

const breadcrumbNameMap: Record<string, string> = {
  '/admin': '数据驾驶舱',
  '/admin/incidents': '事件管理',
  '/admin/users': '用户管理',
  '/admin/carbon': '碳积分管理',
  '/admin/content': '内容管理',
  '/admin/accessibility': '无障碍设施管理',
  '/admin/settings': '系统设置',
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const motion = new Map<HTMLElement, { scale: number; velocity: number }>();
    let pointerY = Number.POSITIVE_INFINITY;
    let frame = 0;

    const animate = () => {
      let moving = false;
      menu.querySelectorAll<HTMLElement>('.ant-menu-item').forEach(item => {
        const state = motion.get(item) || { scale: 1, velocity: 0 };
        const bounds = item.getBoundingClientRect();
        const distance = Math.abs(pointerY - bounds.top - bounds.height / 2);
        const target = (item.classList.contains('ant-menu-item-selected') ? 1.08 : 1) + 0.17 * Math.max(0, 1 - distance / 110);
        state.velocity = (state.velocity + (target - state.scale) * 0.18) * 0.72;
        state.scale += state.velocity;
        item.style.setProperty('--dock-scale', state.scale.toFixed(4));
        motion.set(item, state);
        if (Math.abs(target - state.scale) > 0.001 || Math.abs(state.velocity) > 0.001) moving = true;
      });
      frame = moving ? requestAnimationFrame(animate) : 0;
    };

    const start = () => { if (!frame) frame = requestAnimationFrame(animate); };
    const onMove = (event: PointerEvent) => { pointerY = event.clientY; start(); };
    const onLeave = () => { pointerY = Number.POSITIVE_INFINITY; start(); };
    menu.addEventListener('pointermove', onMove);
    menu.addEventListener('pointerleave', onLeave);
    return () => {
      menu.removeEventListener('pointermove', onMove);
      menu.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
      motion.forEach((_, item) => item.style.removeProperty('--dock-scale'));
    };
  }, []);

  // ===== 登录守卫：无管理员 token 跳转登录页 =====
  useEffect(() => {
    if (!isAdminLoggedIn()) {
      navigate('/admin/login', { replace: true });
    }
  }, [location.pathname]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedKeys = useMemo(() => {
    // Match the most specific path
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/') return ['/admin'];
    // Try exact match first
    if ((menuItems as any[]).some((item) => item?.key === path)) return [path];
    // Fall back to parent
    const parent = path.split('/').slice(0, 3).join('/');
    return [parent];
  }, [location.pathname]);

  // Build breadcrumbs
  const breadcrumbItems = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const items = [{ title: '首页', path: '/admin' }];

    if (pathParts.length >= 2) {
      const sectionKey = `/${pathParts[0]}/${pathParts[1]}`;
      const sectionName = breadcrumbNameMap[sectionKey];
      if (sectionName) {
        items.push({ title: sectionName, path: sectionKey });
      }
    }
    if (pathParts.length >= 3) {
      items.push({ title: '详情', path: location.pathname });
    }
    return items;
  }, [location.pathname]);

  const formatDate = (date: Date) => {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${days[date.getDay()]}`;
  };

  const isDashboard = location.pathname === '/admin' || location.pathname === '/admin/';

  return (
    <Layout className="admin-shell" style={{ height: '100vh' }}>
      <Sider
        className="admin-sidebar"
        width={240}
        collapsible
        collapsed={sidebarCollapsed}
        trigger={null}
        theme="dark"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        {/* Logo area */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            paddingLeft: sidebarCollapsed ? 0 : 52,
          }}
        >
          <Typography.Title
            level={4}
            style={{
              color: '#00e5ef',
              margin: 0,
              fontSize: sidebarCollapsed ? 14 : 18,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            {sidebarCollapsed ? '智途' : '智途云枢'}
          </Typography.Title>
        </div>

        {/* Sidebar menu */}
        <div ref={menuRef} className="admin-sidebar-menu-container slide-in-left">
          <Menu
            className="admin-sidebar-menu"
            theme="dark"
            mode="inline"
            selectedKeys={selectedKeys}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0 }}
          />
        </div>
      </Sider>

      {/* Main layout */}
      <Layout style={{ marginLeft: sidebarCollapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        {/* Header bar */}
        <Header
          style={{
            background: '#0d111b',
            padding: '0 24px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(0,229,239,0.3)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          {/* Left: collapse toggle + breadcrumbs */}
          <Space align="center" size={16}>
            <span
              onClick={toggleSidebar}
              style={{
                fontSize: 18,
                cursor: 'pointer',
                color: '#a9dce8',
                transition: 'color 0.3s',
              }}
            >
              {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
            {!isDashboard && (
              <Breadcrumb
                items={breadcrumbItems.map((item, idx) => ({
                  title: idx < breadcrumbItems.length - 1 ? (
                    <a onClick={() => navigate(item.path)}>{item.title}</a>
                  ) : (
                    item.title
                  ),
                }))}
              />
            )}
          </Space>

          {/* Right: time, notifications, user */}
          <Space size={24} align="center">
            <span style={{ color: '#a9dce8', fontSize: 13 }}>
              {formatDate(currentTime)} {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
            </span>
            <AdminNotificationBell dark />
            <Dropdown menu={{
              items: [
                { key: 'name', label: getAdminInfo()?.realName || '管理员', disabled: true },
                { type: 'divider' },
                { key: 'logout', label: '退出登录', onClick: () => { adminLogout(); navigate('/admin/login', { replace: true }); } },
              ],
            }} trigger={['click']}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size={32} icon={<UserOutlined />} style={{ background: '#112d39', color: '#00e5ef', border: '1px solid #00e5ef' }} />
                <span style={{ color: '#e7faff', fontSize: 14 }}>
                  {getAdminInfo()?.realName || '管理员'}
                </span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Content area */}
        <Content
          style={{
            background: '#0a0a0f',
            minHeight: 'calc(100vh - 56px)',
            overflow: isDashboard ? 'hidden' : 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
