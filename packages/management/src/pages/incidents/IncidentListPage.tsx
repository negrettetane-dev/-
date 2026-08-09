import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Space, Select, Input, Button, Card, Statistic, Row, Col } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getReports, getDashboardStats } from '../../stores/adminPersistence';
import type { Report } from '../../stores/adminPersistence';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: '待审核' },
  received: { color: 'blue', label: '已受理' },
  processing: { color: 'processing', label: '处理中' },
  completed: { color: 'green', label: '已完成' },
  rejected: { color: 'red', label: '已驳回' },
};

const formatTime = (ts: number) => new Date(ts).toLocaleString('zh-CN');

export default function IncidentListPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    let list = getReports();
    if (statusFilter) list = list.filter(r => r.status === statusFilter);
    if (searchText) {
      const s = searchText.toLowerCase();
      list = list.filter(r => r.workOrderNo.toLowerCase().includes(s) || r.category.includes(s) || r.description.includes(s));
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    setReports(list);
    setLoading(false);
  }, [statusFilter, searchText]);

  useEffect(() => { load(); }, [load]);
  const stats = getDashboardStats();

  const columns: ColumnsType<Report> = [
    { title: '工单编号', dataIndex: 'workOrderNo', key: 'wno', width: 140, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: '类型', dataIndex: 'category', key: 'cat', width: 100, render: (v: string) => {
      const icons: Record<string,string> = {'路面坑洼':'🕳️','路灯损坏':'💡','违停占道':'🚗','井盖破损':'⭕','信号灯故障':'🚦','事故线索':'🚨','道路障碍':'🚧','其他问题':'📝'};
      return <span>{icons[v]||'📝'} {v}</span>;
    }},
    { title: '描述', dataIndex: 'description', key: 'desc', ellipsis: true, width: 250 },
    { title: '位置', dataIndex: 'location', key: 'loc', width: 160, ellipsis: true, render: (v: string) => v?.slice(0, 20) },
    { title: '状态', dataIndex: 'status', key: 'st', width: 90, render: (s: string) => {
      const m = STATUS_MAP[s] || { color: 'default', label: s };
      return <Tag color={m.color}>{m.label}</Tag>;
    }},
    { title: '上报时间', dataIndex: 'createdAt', key: 'time', width: 150, render: (v: number) => formatTime(v) },
    { title: '操作', key: 'act', width: 80, fixed: 'right', render: (_, r) => (
      <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/admin/incidents/${r.id}`)}>详情</Button>
    )},
  ];

  return (
    <div className="content-page">
      <div className="page-header"><h2>📋 事件上报管理</h2><p className="page-desc">市民上报事件审核、分派、处理与反馈</p></div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="待审核" value={stats.pendingReports} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="处理中" value={stats.processingReports} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已完成" value={stats.completedReports} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="今日新增" value={stats.todayReports} valueStyle={{ color: '#f5222d' }} /></Card></Col>
      </Row>

      <div className="filter-bar">
        <Select placeholder="筛选状态" allowClear style={{ width: 120 }} value={statusFilter} onChange={setStatusFilter}
          options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))} />
        <Input placeholder="搜索工单编号/类型/描述" prefix={<SearchOutlined />} style={{ width: 260 }} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
        <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
      </div>

      <Table columns={columns} dataSource={reports} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 15, showTotal: t => `共 ${t} 条` }}
        locale={{ emptyText: '暂无上报事件（市民端提交后自动出现）' }} />
    </div>
  );
}
