import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Input, message, Modal, Popconfirm, Select, Space, Spin, Table, Tabs, Tag } from 'antd';
import type { TableProps } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { contentService, type ContentNews, type ContentNewsInput, type ContentStatus } from '../../services/contentService';

const CATEGORIES = ['系统公告', '出行提醒', '服务通知', '活动通知'];
const STATUS_LABELS: Record<ContentStatus, { color: string; label: string }> = { draft: { color: 'default', label: '草稿' }, scheduled: { color: 'orange', label: '定时发布' }, published: { color: 'green', label: '已发布' } };
const emptyDraft: ContentNewsInput = { title: '', category: '系统公告', summary: '', content: '', status: 'draft', scheduledAt: null };
const toInput = (item: ContentNews): ContentNewsInput => ({ title: item.title, category: item.category, summary: item.summary, content: item.content, status: item.status, scheduledAt: item.scheduledAt || null });
const formatLocalDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function ContentManagementPage() {
  const [news, setNews] = useState<ContentNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | undefined>();
  const [newsModal, setNewsModal] = useState(false);
  const [editNews, setEditNews] = useState<{ id?: string; data: ContentNewsInput } | null>(null);
  const loadNews = useCallback(async () => { setLoading(true); setError(''); try { const result = await contentService.list(statusFilter ? { status: statusFilter } : undefined); setNews(result.list || []); } catch (err) { setError(err instanceof Error ? err.message : '资讯加载失败'); setNews([]); } finally { setLoading(false); } }, [statusFilter]);
  useEffect(() => { void loadNews(); }, [loadNews]);
  const saveNews = async () => { const current = editNews; if (!current?.data.title.trim() || !current.data.content.trim()) { message.warning('请输入标题和正文'); return; } if (current.data.status === 'scheduled' && !current.data.scheduledAt) { message.warning('定时发布需要设置发送时间'); return; } try { if (current.id) await contentService.update(current.id, current.data); else await contentService.create(current.data); setNewsModal(false); setEditNews(null); message.success('资讯已保存'); await loadNews(); } catch (err) { message.error(err instanceof Error ? err.message : '保存失败'); } };
  const deleteDraft = async (item: ContentNews) => { try { await contentService.removeDraft(item.id); message.success('草稿已删除'); await loadNews(); } catch (err) { message.error(err instanceof Error ? err.message : '删除失败'); } };
  const columns: TableProps<ContentNews>['columns'] = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '类型', dataIndex: 'category', width: 110, render: value => <Tag>{value}</Tag> },
    { title: '状态', dataIndex: 'status', width: 100, render: value => { const status = STATUS_LABELS[value as ContentStatus]; return status ? <Tag color={status.color}>{status.label}</Tag> : value; } },
    { title: '发送时间', dataIndex: 'scheduledAt', width: 170, render: value => value ? new Date(value).toLocaleString('zh-CN') : '—' },
    { title: '更新时间', dataIndex: 'updatedAt', width: 170, render: value => value ? new Date(value).toLocaleString('zh-CN') : '—' },
    { title: '操作', width: 150, render: (_, record) => <Space><Button size="small" icon={<EditOutlined />} onClick={() => { setEditNews({ id: record.id, data: toInput(record) }); setNewsModal(true); }}>编辑</Button>{record.status === 'draft' && <Popconfirm title="确定删除这个草稿？" onConfirm={() => void deleteDraft(record)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}</Space> },
  ];
  const updateField = (field: keyof ContentNewsInput, value: string | null) => setEditNews(current => current && { ...current, data: { ...current.data, [field]: value } });
  return <div className="content-page">
    <div className="page-header"><h2>🔔 系统消息管理</h2><p className="page-desc">发布后通过用户端通知按钮向客户展示，不是交通资讯。</p></div>
    {error && <Alert type="error" showIcon message="资讯接口加载失败" description={error} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => void loadNews()}>重试</Button>} style={{ marginBottom: 16 }} />}
    <Tabs activeKey={statusFilter || 'all'} onChange={key => setStatusFilter(key === 'all' ? undefined : key as ContentStatus)} items={[{ key: 'all', label: '全部' }, { key: 'draft', label: '草稿' }, { key: 'scheduled', label: '定时发布' }, { key: 'published', label: '已发布' }]} />
    <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditNews({ data: { ...emptyDraft } }); setNewsModal(true); }}>新建系统消息</Button>}>{loading ? <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div> : <Table rowKey="id" dataSource={news} columns={columns} pagination={{ pageSize: 10 }} locale={{ emptyText: '暂无真实后端数据' }} />}</Card>
    <Modal title={editNews?.id ? '编辑系统消息' : '新建系统消息'} open={newsModal} onOk={() => void saveNews()} onCancel={() => { setNewsModal(false); setEditNews(null); }} width={680} destroyOnClose>
      <div style={{ marginBottom: 12 }}><b>标题</b><Input value={editNews?.data.title} onChange={e => updateField('title', e.target.value)} /></div>
      <div style={{ marginBottom: 12 }}><b>类型</b><Select style={{ width: '100%', marginTop: 4 }} value={editNews?.data.category} options={CATEGORIES.map(value => ({ value, label: value }))} onChange={value => updateField('category', value)} /></div>
      <div style={{ marginBottom: 12 }}><b>摘要</b><Input.TextArea rows={2} value={editNews?.data.summary} onChange={e => updateField('summary', e.target.value)} /></div>
      <div style={{ marginBottom: 12 }}><b>正文</b><Input.TextArea rows={8} value={editNews?.data.content} onChange={e => updateField('content', e.target.value)} /></div>
      <Space align="center"><b>发布方式</b><Select value={editNews?.data.status} options={[{ value: 'draft', label: '保存为草稿' }, { value: 'published', label: '立即发布' }, { value: 'scheduled', label: '定时发送' }]} onChange={(status: ContentStatus) => setEditNews(current => current && { ...current, data: { ...current.data, status, scheduledAt: status === 'scheduled' ? current.data.scheduledAt : null } })} /><Input type="datetime-local" value={formatLocalDateTime(editNews?.data.scheduledAt)} disabled={editNews?.data.status !== 'scheduled'} onChange={event => updateField('scheduledAt', event.target.value ? new Date(event.target.value).toISOString() : null)} /></Space>
    </Modal>
  </div>;
}
