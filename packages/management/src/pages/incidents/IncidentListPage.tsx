import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Input, Row, Select, Statistic, Table, Tag } from 'antd';
import { EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiGet } from '../../services/apiClient';

interface Incident {
  id: string;
  title: string;
  description: string;
  roadName: string;
  severity: string;
  status: string;
  reportedAt: string;
  reportedBy: string;
}

interface IncidentPage { list: Incident[]; total: number; page: number; pageSize: number }

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: '待审核' },
  processing: { color: 'processing', label: '处理中' },
  resolved: { color: 'green', label: '已完成' },
  closed: { color: 'default', label: '已关闭' },
};

export default function IncidentListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<IncidentPage>({ list: [], total: 0, page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>();
  const [severity, setSeverity] = useState<string>();
  const [search, setSearch] = useState('');

  const load = useCallback(async (page = data.page) => {
    setLoading(true);
    try {
      const result = await apiGet<IncidentPage>('/incidents', { page, pageSize: data.pageSize, status: status || '', severity: severity || '' });
      const list = search.trim()
        ? result.list.filter(item => `${item.id}${item.title}${item.description}${item.roadName}`.toLowerCase().includes(search.trim().toLowerCase()))
        : result.list;
      setData({ ...result, list });
    } finally {
      setLoading(false);
    }
  }, [data.page, data.pageSize, search, severity, status]);

  useEffect(() => { void load(1); }, [status, severity]);

  const columns: ColumnsType<Incident> = [
    { title: '编号', dataIndex: 'id', width: 120 },
    { title: '类型', dataIndex: 'title', width: 120 },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '位置', dataIndex: 'roadName', width: 160, ellipsis: true },
    { title: '严重程度', dataIndex: 'severity', width: 100, render: value => <Tag>{value}</Tag> },
    { title: '状态', dataIndex: 'status', width: 100, render: value => { const meta = STATUS_MAP[value] || { color: 'default', label: value }; return <Tag color={meta.color}>{meta.label}</Tag>; } },
    { title: '上报人', dataIndex: 'reportedBy', width: 100 },
    { title: '上报时间', dataIndex: 'reportedAt', width: 170, render: value => new Date(value).toLocaleString('zh-CN') },
    { title: '操作', width: 90, render: (_, item) => <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/admin/incidents/${item.id}`)}>详情</Button> },
  ];

  const pending = data.list.filter(item => item.status === 'pending').length;
  const processing = data.list.filter(item => item.status === 'processing').length;
  const resolved = data.list.filter(item => item.status === 'resolved').length;

  return <div className="content-page">
    <div className="page-header"><h2>事件上报管理</h2><p className="page-desc">数据来自后端事件管理接口</p></div>
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col span={8}><Card size="small"><Statistic title="当前页待审核" value={pending} /></Card></Col>
      <Col span={8}><Card size="small"><Statistic title="当前页处理中" value={processing} /></Card></Col>
      <Col span={8}><Card size="small"><Statistic title="当前页已完成" value={resolved} /></Card></Col>
    </Row>
    <div className="filter-bar">
      <Select placeholder="状态" allowClear style={{ width: 130 }} value={status} onChange={setStatus} options={Object.entries(STATUS_MAP).map(([value, meta]) => ({ value, label: meta.label }))} />
      <Select placeholder="严重程度" allowClear style={{ width: 130 }} value={severity} onChange={setSeverity} options={['high','medium','low'].map(value => ({ value, label: value }))} />
      <Input placeholder="搜索编号/类型/位置" prefix={<SearchOutlined />} style={{ width: 260 }} value={search} onChange={event => setSearch(event.target.value)} onPressEnter={() => void load(1)} />
      <Button icon={<ReloadOutlined />} onClick={() => void load(1)}>查询</Button>
    </div>
    <Table columns={columns} dataSource={data.list} rowKey="id" loading={loading} size="small" pagination={{ current: data.page, pageSize: data.pageSize, total: data.total, onChange: page => void load(page) }} />
  </div>;
}
