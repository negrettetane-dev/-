import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Popover, List, Tag, Button, Empty, message } from 'antd';
import { BellOutlined, AlertOutlined, TeamOutlined, ShoppingOutlined } from '@ant-design/icons';
import {
  adminNotificationService,
  type AdminNotification,
  type AdminNotificationType,
} from '../services/adminNotificationService';

const TYPE_META: Record<AdminNotificationType, { label: string; color: string; icon: React.ReactNode }> = {
  event: { label: '新事件', color: 'blue', icon: <AlertOutlined /> },
  user: { label: '新用户', color: 'green', icon: <TeamOutlined /> },
  stock: { label: '库存预警', color: 'orange', icon: <ShoppingOutlined /> },
};

function targetPath(n: AdminNotification): string {
  switch (n.type) {
    case 'event': return n.relatedId ? `/admin/incidents/${n.relatedId}` : '/admin/incidents';
    case 'user': return '/admin/users';
    case 'stock': return '/admin/carbon';
    default: return '/admin';
  }
}

interface Props {
  dark?: boolean;
}

/** 管理端顶部通知中心：新事件、新用户、兑换商品库存<10 预警 */
export default function AdminNotificationBell({ dark = false }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await adminNotificationService.list();
      const list = data.list || [];
      setItems(list);
      setUnread(data.unreadCount ?? list.filter((n) => !n.read).length);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '通知加载失败，请稍后重试');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const openNotification = async (n: AdminNotification) => {
    if (!n.read) {
      try {
        await adminNotificationService.markRead([n.id]);
        setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
        setUnread((value) => Math.max(0, value - 1));
      } catch (error) {
        message.error(error instanceof Error ? error.message : '通知标记已读失败');
      }
    }
    setOpen(false);
    navigate(targetPath(n));
  };

  const markAllRead = async () => {
    try {
      await adminNotificationService.markAllRead();
      setItems((cur) => cur.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '全部标记已读失败');
    }
  };

  const formatTime = (v: number | string) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const panel = (
    <div style={{ width: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 8px', borderBottom: '1px solid #f0f0f0' }}>
        <b>通知中心</b>
        <Button type="link" size="small" disabled={unread === 0} onClick={() => void markAllRead()}>全部已读</Button>
      </div>
      {loadError && <Alert type="error" showIcon message="通知加载失败" description={loadError} action={<Button size="small" onClick={() => void load()}>重试</Button>} style={{ marginTop: 12 }} />}
      {items.length === 0 && !loadError ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" style={{ padding: '24px 0' }} />
      ) : (
        <List
          dataSource={items}
          style={{ maxHeight: 400, overflow: 'auto' }}
          renderItem={(n) => {
            const meta = TYPE_META[n.type] || TYPE_META.event;
            return (
              <List.Item
                style={{ cursor: 'pointer', background: n.read ? 'transparent' : 'rgba(22,119,255,0.05)', padding: '12px 8px' }}
                onClick={() => void openNotification(n)}
              >
                <List.Item.Meta
                  avatar={<span style={{ fontSize: 18 }}>{meta.icon}</span>}
                  title={<span>{!n.read && <Badge status="processing" style={{ marginRight: 6 }} />}{n.title}</span>}
                  description={
                    <div>
                      <div style={{ color: 'rgba(0,0,0,0.65)' }}>{n.content}</div>
                      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>
                        <Tag color={meta.color} style={{ marginRight: 8 }}>{meta.label}</Tag>
                        {formatTime(n.createdAt)}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );

  return (
    <Popover content={panel} trigger="click" open={open} onOpenChange={setOpen} placement="bottomRight" arrow={false}>
      <Badge count={unread} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          aria-label={`通知中心，${unread} 条未读通知`}
          icon={<BellOutlined />}
          style={{ color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)' }}
        />
      </Badge>
    </Popover>
  );
}
