import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Input, Row, Select, Statistic, Table, Tag } from 'antd';
import { EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiGet } from '../../services/apiClient';
import {
  ALL_INCIDENT_STATUS_OPTIONS,
  INCIDENT_SEVERITY_OPTIONS,
  incidentStatusLabel,
  incidentStatusColor,
  normalizeIncidentStatus,
  incidentSeverityLabel,
  incidentSeverityColor,
} from '../../constants/incidentStatus';

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
interface IncidentStats { pending: number; processing: number; resolved: number; total: number }

function normalizeIncident(incident: Incident): Incident {
  return { ...incident, status: normalizeIncidentStatus(incident.status) };
}

export default function IncidentListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<IncidentPage>({ list: [], total: 0, page: 1, pageSize: 10 });
  const [stats, setStats] = useState<IncidentStats>({ pending: 0, processing: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>();
  const [severity, setSeverity] = useState<string>();
  const [search, setSearch] = useState('');

  const load = useCallback(async (page = data.page) => {
    setLoading(true);
    try {
      const result = await apiGet<IncidentPage>('/incidents', { page, pageSize: data.pageSize, status: status || '', severity: severity || '' });
      const normalizedList = (result.list || []).map(normalizeIncident);
      const list = search.trim()
        ? normalizedList.filter(item => `${item.id}${item.title}${item.description}${item.roadName}`.toLowerCase().includes(search.trim().toLowerCase()))
        : normalizedList;
      setData({ ...result, list });
    } finally {
      setLoading(false);
    }
  }, [data.page, data.pageSize, search, severity, status]);

  // 分页拉全：后端对单次 pageSize 有限制，必须循环拉完所有页才能算全量分布
  const loadStats = useCallback(async () => {
    try {
      const allList: Incident[] = [];
      let page = 1;
      const pageSize = 50;
      let total = 0;
      while (page <= 20) { // 安全上限：最多拉 20 页（1000 条），够用了
        const result = await apiGet<IncidentPage>('/incidents', { page, pageSize, status: '', severity: '' });
        const list = result.list || [];
        allList.push(...list.map(normalizeIncident));
        total = result.total || 0;
        if (allList.length >= total || list.length === 0) break;
        page += 1;
      }
      setStats({
        pending: allList.filter(item => item.status === 'pending').length,
        processing: allList.filter(item => item.status === 'processing' || item.status === 'received').length,
        resolved: allList.filter(item => item.status === 'resolved').length,
        total: total || allList.length,
      });
    } catch { /* 后端暂不可用时保持 0 */ }
  }, []);

  useEffect(() => { void load(1); }, [status, severity]);
  useEffect(() => { void loadStats(); }, [loadStats]);

  const columns: ColumnsType<Incident> = [
    { title: '编号', dataIndex: 'id', width: 120 },
    { title: '类型', dataIndex: 'title', width: 120 },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '位置', dataIndex: 'roadName', width: 160, ellipsis: true },
    { title: '严重程度', dataIndex: 'severity', width: 100, render: value => <Tag color={incidentSeverityColor(value)}>{incidentSeverityLabel(value)}</Tag> },
    { title: '状态', dataIndex: 'status', width: 100, render: value => <Tag color={incidentStatusColor(value)}>{incidentStatusLabel(value)}</Tag> },
    { title: '上报人', dataIndex: 'reportedBy', width: 100 },
    { title: '上报时间', dataIndex: 'reportedAt', width: 170, render: value => new Date(value).toLocaleString('zh-CN') },
    { title: '操作', width: 90, render: (_, item) => <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/admin/incidents/${item.id}`)}>详情</Button> },
  ];

  return <div className="content-page">
    <div className="page-header"><h2>事件上报管理</h2><p className="page-desc">数据来自后端事件管理接口</p></div>
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col span={6}><Card size="small"><Statistic title="事件总数" value={stats.total} /></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="待审核" value={stats.pending} valueStyle={{ color: '#faad14' }} /></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="处理中" value={stats.processing} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="已完成" value={stats.resolved} valueStyle={{ color: '#52c41a' }} /></Card></Col>
    </Row>
    <div className="filter-bar">
      <Select placeholder="状态" allowClear style={{ width: 130 }} value={status} onChange={setStatus} options={ALL_INCIDENT_STATUS_OPTIONS.map(item => ({ value: item.value, label: item.label }))} />
      <Select placeholder="严重程度" allowClear style={{ width: 130 }} value={severity} onChange={setSeverity} options={INCIDENT_SEVERITY_OPTIONS.map(item => ({ value: item.value, label: item.label }))} />
      <Input placeholder="搜索编号/类型/位置" prefix={<SearchOutlined />} style={{ width: 260 }} value={search} onChange={event => setSearch(event.target.value)} onPressEnter={() => void load(1)} />
      <Button icon={<ReloadOutlined />} onClick={() => { void load(1); void loadStats(); }}>查询</Button>
    </div>
    <Table columns={columns} dataSource={data.list} rowKey="id" loading={loading} size="small" pagination={{ current: data.page, pageSize: data.pageSize, total: data.total, onChange: page => void load(page) }} />
  </div>;
}
