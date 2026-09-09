import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, Circle } from 'lucide-react';
import { apiGet } from '../../services/apiClient';
import { useAuthStore } from '../../stores/authStore';
import styles from './NotificationBell.module.css';

export interface UserNotification {
  id: string;
  title: string;
  content: string;
  type: 'workorder' | 'points' | 'system';
  createdAt: number | string;
  read?: boolean;
}

const NotificationBell: React.FC = () => {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [open, setOpen] = useState(false);
  const user = useAuthStore(state => state.user);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<UserNotification[]>('/notifications')
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => {
        try {
          const raw = localStorage.getItem('zhitu_notifications');
          const localItems = raw ? JSON.parse(raw) as UserNotification[] : [];
          setItems(localItems.filter(item => !user?.id || (item as UserNotification & { userId?: string }).userId === user.id));
        } catch { setItems([]); }
      });
  }, [user?.id]);

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
          {items.length === 0 ? <div className={styles.empty}><Check size={22} /><span>暂无新通知</span><small>事件处理和积分发放会在这里提醒你</small></div> : (
            <div className={styles.list}>{items.map(item => <div className={`${styles.item} ${item.read ? styles.read : ''}`} key={item.id}><Circle size={8} fill={item.read ? 'transparent' : 'currentColor'} /><div><strong>{item.title}</strong><p>{item.content}</p><time>{formatTime(item.createdAt)}</time></div></div>)}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
