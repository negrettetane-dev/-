import React, { useState } from 'react';
import { Card, Tabs, Table, Tag, Button, Modal, Input, Switch, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getTrafficNews, setTrafficNews, getServices, setServices } from '../../stores/adminPersistence';

const CATEGORIES = ['交通新闻', '道路施工', '交通管制', '公交调整', '地铁通知', '出行提醒'];
const STATUS_LABELS: Record<string, { color: string; label: string }> = { draft: { color: 'default', label: '草稿' }, published: { color: 'green', label: '已发布' }, archived: { color: 'red', label: '已下架' }, pinned: { color: 'blue', label: '置顶' } };

export default function ContentManagementPage() {
  const [news, setNews] = useState(getTrafficNews().length > 0 ? getTrafficNews() : [
    { id: 'n1', title: '长安街东段施工通告', category: '道路施工', summary: '8月10日起西向东方向封闭', content: '', status: 'published', pinned: true, createdAt: Date.now() - 86400000, updatedAt: Date.now() },
    { id: 'n2', title: '1号线延长运营时间', category: '地铁通知', summary: '周五周六延长至23:30', content: '', status: 'published', pinned: false, createdAt: Date.now() - 172800000, updatedAt: Date.now() },
    { id: 'n3', title: '国庆期间交通管制方案', category: '交通管制', summary: '重要路段分时段管控', content: '', status: 'draft', pinned: false, createdAt: Date.now() - 259200000, updatedAt: Date.now() },
  ]);
  const [services, setServicesState] = useState(getServices().length > 0 ? getServices() : [
    { id: 's1', name: '违章查询', icon: '🚗', desc: '机动车违法信息查询', link: '', sort: 1, enabled: true },
    { id: 's2', name: '高速路况', icon: '🛣️', desc: '实时高速路况查询', link: '', sort: 2, enabled: true },
    { id: 's3', name: '车驾管指南', icon: '📋', desc: '驾驶证/机动车业务指南', link: '', sort: 3, enabled: true },
  ]);
  const [newsModal, setNewsModal] = useState(false);
  const [svcModal, setSvcModal] = useState(false);
  const [editNews, setEditNews] = useState<any>(null);
  const [editSvc, setEditSvc] = useState<any>(null);

  const saveNews = () => {
    if (!editNews?.title) { message.warning('请输入标题'); return; }
    setNews(prev => {
      const idx = prev.findIndex(n => n.id === editNews.id);
      const updated = { ...editNews, updatedAt: Date.now(), id: editNews.id || ('n' + Date.now().toString(36)) };
      const list = idx >= 0 ? prev.map((n, i) => i === idx ? updated : n) : [updated, ...prev];
      setTrafficNews(list); return list;
    });
    setNewsModal(false); message.success('已保存');
  };

  const saveSvc = () => {
    if (!editSvc?.name) { message.warning('请输入服务名称'); return; }
    setServicesState(prev => {
      const idx = prev.findIndex(s => s.id === editSvc.id);
      const updated = { ...editSvc, id: editSvc.id || ('s' + Date.now().toString(36)) };
      const list = idx >= 0 ? prev.map((s, i) => i === idx ? updated : s) : [...prev, updated];
      setServices(list); return list;
    });
    setSvcModal(false); message.success('已保存');
  };

  return (
    <div className="content-page">
      <div className="page-header"><h2>📝 内容与便民服务管理</h2><p className="page-desc">交通资讯发布管理、便民服务配置</p></div>

      <Tabs defaultActiveKey="news" items={[
        {
          key: 'news', label: '交通资讯',
          children: (
            <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditNews({ id: '', title: '', category: '', summary: '', content: '', status: 'draft', pinned: false }); setNewsModal(true); }}>新建资讯</Button>}>
              <Table dataSource={news} rowKey="id" size="small" pagination={{ pageSize: 10 }} columns={[
                { title: '标题', dataIndex: 'title', ellipsis: true },
                { title: '分类', dataIndex: 'category', width: 100, render: (v: string) => <Tag>{v}</Tag> },
                { title: '摘要', dataIndex: 'summary', ellipsis: true, width: 200 },
                { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => { const m = STATUS_LABELS[s]; return m ? <Tag color={m.color}>{m.label}</Tag> : s; } },
                { title: '置顶', dataIndex: 'pinned', width: 60, render: (v: boolean) => v ? '⭐' : '' },
                { title: '更新时间', dataIndex: 'updatedAt', width: 150, render: (v: number) => new Date(v).toLocaleString('zh-CN') },
                { title: '操作', width: 120, render: (_, r) => (
                  <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => { setEditNews({ ...r }); setNewsModal(true); }}>编辑</Button>
                    <Popconfirm title="确定删除？" onConfirm={() => { setNews(prev => prev.filter(n => n.id !== r.id)); setTrafficNews(news.filter(n => n.id !== r.id)); }}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                )},
              ]} />
              <Modal title={editNews?.id ? '编辑资讯' : '新建资讯'} open={newsModal} onOk={saveNews} onCancel={() => setNewsModal(false)} width={600}>
                <div style={{ marginBottom: 10 }}><b>标题</b><Input value={editNews?.title} onChange={e => setEditNews({ ...editNews, title: e.target.value })} /></div>
                <div style={{ marginBottom: 10 }}><b>分类</b><Input value={editNews?.category} onChange={e => setEditNews({ ...editNews, category: e.target.value })} placeholder="如: 交通新闻" /></div>
                <div style={{ marginBottom: 10 }}><b>摘要</b><Input.TextArea rows={2} value={editNews?.summary} onChange={e => setEditNews({ ...editNews, summary: e.target.value })} /></div>
                <div style={{ marginBottom: 10 }}><b>状态</b>
                  <span style={{ marginLeft: 10 }}><Switch checked={editNews?.status === 'published'} onChange={v => setEditNews({ ...editNews, status: v ? 'published' : 'draft' })} /> {editNews?.status === 'published' ? '已发布' : '草稿'}</span>
                  <span style={{ marginLeft: 20 }}><Switch checked={editNews?.pinned} onChange={v => setEditNews({ ...editNews, pinned: v })} /> 置顶</span>
                </div>
              </Modal>
            </Card>
          ),
        },
        {
          key: 'services', label: '便民服务',
          children: (
            <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditSvc({ id: '', name: '', icon: '', desc: '', link: '', sort: services.length + 1, enabled: true }); setSvcModal(true); }}>新建服务</Button>}>
              <Table dataSource={services} rowKey="id" size="small" pagination={false} columns={[
                { title: '排序', dataIndex: 'sort', width: 60 },
                { title: '图标', dataIndex: 'icon', width: 60 },
                { title: '名称', dataIndex: 'name' },
                { title: '说明', dataIndex: 'desc', ellipsis: true },
                { title: '启用', dataIndex: 'enabled', width: 60, render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag> },
                { title: '操作', width: 120, render: (_, r) => (
                  <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => { setEditSvc({ ...r }); setSvcModal(true); }}>编辑</Button>
                    <Popconfirm title="确定删除？" onConfirm={() => { setServicesState(prev => prev.filter(s => s.id !== r.id)); setServices(services.filter(s => s.id !== r.id)); }}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                )},
              ]} />
              <Modal title={editSvc?.id ? '编辑服务' : '新建服务'} open={svcModal} onOk={saveSvc} onCancel={() => setSvcModal(false)}>
                <div style={{ marginBottom: 10 }}><b>名称</b><Input value={editSvc?.name} onChange={e => setEditSvc({ ...editSvc, name: e.target.value })} /></div>
                <div style={{ marginBottom: 10 }}><b>图标 emoji</b><Input value={editSvc?.icon} onChange={e => setEditSvc({ ...editSvc, icon: e.target.value })} /></div>
                <div style={{ marginBottom: 10 }}><b>说明</b><Input value={editSvc?.desc} onChange={e => setEditSvc({ ...editSvc, desc: e.target.value })} /></div>
                <div style={{ marginBottom: 10 }}><b>链接</b><Input value={editSvc?.link} onChange={e => setEditSvc({ ...editSvc, link: e.target.value })} /></div>
                <div><b>排序</b><Input type="number" value={editSvc?.sort} onChange={e => setEditSvc({ ...editSvc, sort: parseInt(e.target.value) || 0 })} /></div>
                <div style={{ marginTop: 10 }}><Switch checked={editSvc?.enabled} onChange={v => setEditSvc({ ...editSvc, enabled: v })} /> 启用</div>
              </Modal>
            </Card>
          ),
        },
      ]} />
    </div>
  );
}
