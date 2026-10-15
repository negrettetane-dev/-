import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../services/apiClient';
import { useAuthStore } from '../../stores/authStore';
import {
  getNotificationSettings,
  getNotifications,
  markNotificationsRead,
  type NotificationSettings,
  type NotificationType,
  type UserNotification,
} from '../../stores/persistence';
import styles from './NotificationBell.module.css';

type NotificationResponse = UserNotification[] | { list: UserNotification[] };

const normalizeType = (type: string): NotificationType => {
  if (type === 'points') return 'carbon';
  if (type === 'workorder') return 'event';
  if (type === 'weather' || type === 'event' || type === 'system') return type;
  return 'system';
};

const typeMeta: Record<NotificationType, { label: string; icon: string; path?: string }> = {
  carbon: { label: '碳积分', icon: '🌳', path: '/carbon/points-detail' },
  weather: { label: '天气预警', icon: '🌦️' },
  event: { label: '事件进度', icon: '📋', path: '/profile/reports' },
  system: { label: '系统消息', icon: '🔐', path: '/profile/account' },
};

const NotificationBell: React.FC = () => {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [open, setOpen] = useState(false);
  const user = useAuthStore(state => state.user);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    if (!user?.id) return;
    const applySettings = (notifications: UserNotification[], settings: NotificationSettings) => {
      setItems(notifications
        .map(item => ({ ...item, type: normalizeType(String(item.type)), read: Boolean(item.read) }))
        .filter(item => settings[item.type]));
    };
    Promise.all([
      apiGet<NotificationResponse>('/notifications'),
      apiGet<NotificationSettings>('/notification-settings').catch(() => getNotificationSettings(user.id)),
    ])
      .then(([data, settings]) => applySettings(Array.isArray(data) ? data : data.list || [], settings))
      .catch(() => {
        applySettings(getNotifications(user.id), getNotificationSettings(user.id));
      });
  }, [user?.id]);

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener('focus', refresh);
    window.addEventListener('zhitu:notifications-changed', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('zhitu:notifications-changed', refresh);
    };
  }, [load]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const openNotification = (item: UserNotification) => {
    if (!item.read && user?.id) {
      setItems(current => current.map(notification => notification.id === item.id ? { ...notification, read: true } : notification));
      markNotificationsRead([item.id], user.id);
      apiPost('/notifications/read', { ids: [item.id] }).catch(() => undefined);
    }
    setOpen(false);
    const target = item.actionPath || (item.type === 'event' && item.relatedId ? `/report/detail/${encodeURIComponent(item.relatedId)}` : typeMeta[item.type].path);
    if (target) navigate(target);
  };

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const unread = items.filter(item => !item.read).length;
  const formatTime = (value: number | string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button type="button" className={styles.trigger} aria-label={`通知${unread ? `，${unread}条未读` : ''}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <Bell size={20} strokeWidth={2} aria-hidden="true" />
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="通知中心">
          <div className={styles.panelHeader}><strong>通知中心</strong><span>{unread ? `${unread} 条未读` : '全部已读'}</span></div>
          {items.length === 0 ? <div className={styles.empty}><Check size={22} /><span>暂无通知</span><small>已开启的碳积分、天气、事件进度和系统消息会显示在这里</small></div> : (
            <div className={styles.list}>{items.map(item => <button type="button" className={`${styles.item} ${item.read ? styles.read : ''}`} key={item.id} onClick={() => openNotification(item)}><Circle size={8} fill={item.read ? 'transparent' : 'currentColor'} /><div><span className={styles.type}>{typeMeta[item.type].icon} {typeMeta[item.type].label}</span><strong>{item.title}</strong><p>{item.content}</p><time>{formatTime(item.createdAt)}</time></div></button>)}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
