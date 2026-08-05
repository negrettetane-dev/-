import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Badge, Space, Select, DatePicker, Input, Button } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useIncidentStore } from '../../stores/incidentStore';
import type { MockIncident } from '../../mocks/mockData';

const { RangePicker } = DatePicker;

const SEVERITY_MAP: Record<string, { color: string; label: string }> = {
  normal: { color: 'blue', label: '一般' },
  serious: { color: 'orange', label: '严重' },
  critical: { color: 'red', label: '紧急' },
};

const STATUS_MAP: Record<string, { status: 'success' | 'processing' | 'warning' | 'error' | 'default'; label: string }> = {
  new: { status: 'error', label: '待处理' },
  dispatched: { status: 'processing', label: '已派发' },
  processing: { status: 'processing', label: '处置中' },
  resolved: { status: 'success', label: '已解决' },
  archived: { status: 'default', label: '已归档' },
};

const SOURCE_MAP: Record<string, { color: string; label: string }> = {
  ai_detection: { color: 'purple', label: 'AI检测' },
  citizen_report: { color: 'green', label: '市民上报' },
  patrol: { color: 'blue', label: '巡检' },
  sensor: { color: 'cyan', label: '传感器' },
};

export default function IncidentListPage() {
  const navigate = useNavigate();
  const { incidents, loading, total, page, pageSize, filters, fetchList, setFilters, setPage } =
    useIncidentStore();

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const columns: ColumnsType<MockIncident> = [
    {
      title: '事件编号',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{id}</span>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source: string) => {
        const s = SOURCE_MAP[source] || { color: 'default', label: source };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '事件类型',
      dataIndex: 'type',
      key: 'type',
      width: 110,
    },
    {
      title: '位置',
      dataIndex: 'roadName',
      key: 'roadName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => {
        const s = SEVERITY_MAP[severity] || { color: 'default', label: severity };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const s = STATUS_MAP[status] || { status: 'default' as const, label: status };
        return <Badge status={s.status} text={s.label} />;
      },
    },
    {
      title: '发生时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 170,
      sorter: (a, b) => a.createTime - b.createTime,
      render: (time: number) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/incidents/${record.id}`);
          }}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div className="content-page">
      <div className="page-header">
        <h2>🚨 事件管理</h2>
        <p className="page-desc">管理城市交通事件，包括AI检测、市民上报、巡检和传感器发现的各类交通事件</p>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <Select
          placeholder="事件状态"
          allowClear
          style={{ width: 130 }}
          value={filters.status}
          onChange={(val) => setFilters({ status: val })}
          options={[
            { value: 'new', label: '待处理' },
            { value: 'dispatched', label: '已派发' },
            { value: 'processing', label: '处置中' },
            { value: 'resolved', label: '已解决' },
            { value: 'archived', label: '已归档' },
          ]}
        />
        <Select
          placeholder="严重程度"
          allowClear
          style={{ width: 130 }}
          value={filters.severity}
          onChange={(val) => setFilters({ severity: val })}
          options={[
            { value: 'normal', label: '一般' },
            { value: 'serious', label: '严重' },
            { value: 'critical', label: '紧急' },
          ]}
        />
        <RangePicker placeholder={['开始日期', '结束日期']} />
        <Input
          placeholder="搜索事件编号/位置"
          prefix={<SearchOutlined />}
          style={{ width: 220 }}
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={fetchList}>
          刷新
        </Button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={incidents}
        rowKey="id"
        loading={loading}
        onRow={(record) => ({
          onClick: () => navigate(`/admin/incidents/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条事件`,
          onChange: (p, ps) => {
            setPage(p);
          },
        }}
        scroll={{ x: 1000 }}
        style={{ background: '#fff', borderRadius: 8 }}
      />
    </div>
  );
}
