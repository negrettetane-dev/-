import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Button, Input, Space, Tabs } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useDeviceStore } from '../../stores/deviceStore';
import type { MockDevice } from '../../mocks/mockData';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  online: { color: 'success', label: '在线' },
  offline: { color: 'error', label: '离线' },
  fault: { color: 'warning', label: '故障' },
  maintenance: { color: 'processing', label: '维护中' },
};

const TYPE_MAP: Record<string, { label: string; icon: string }> = {
  camera: { label: '摄像头', icon: '📷' },
  radar: { label: '毫米波雷达', icon: '📡' },
  geomagnetic: { label: '地磁传感器', icon: '🔄' },
  rsu: { label: 'RSU路侧单元', icon: '🛰️' },
  signal_controller: { label: '信号机', icon: '🚦' },
};

const TAB_ITEMS = [
  { key: '', label: '全部' },
  { key: 'online', label: '在线' },
  { key: 'offline', label: '离线' },
  { key: 'fault', label: '故障' },
  { key: 'maintenance', label: '维护中' },
];

export default function DeviceListPage() {
  const navigate = useNavigate();
  const { devices, loading, total, filters, fetchList, setFilters } = useDeviceStore();

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const columns: ColumnsType<MockDevice> = [
    {
      title: '设备ID',
      dataIndex: 'id',
      key: 'id',
      width: 110,
      render: (id: string) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{id}</span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const t = TYPE_MAP[type] || { label: type, icon: '' };
        return <span>{t.icon} {t.label}</span>;
      },
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '位置 (路段)',
      dataIndex: 'roadName',
      key: 'roadName',
      width: 160,
      ellipsis: true,
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      width: 180,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const s = STATUS_MAP[status] || { color: 'default', label: status };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '最后心跳',
      dataIndex: 'lastHeartbeat',
      key: 'lastHeartbeat',
      width: 170,
      sorter: (a, b) => a.lastHeartbeat - b.lastHeartbeat,
      render: (time: number) => {
        const diff = Date.now() - time;
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return `${seconds}秒前`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
        return new Date(time).toLocaleString('zh-CN');
      },
    },
    {
      title: '在线率',
      dataIndex: 'uptime',
      key: 'uptime',
      width: 100,
      sorter: (a, b) => a.uptime - b.uptime,
      render: (uptime: number) => (
        <span style={{ color: uptime >= 95 ? '#52c41a' : uptime >= 80 ? '#faad14' : '#f5222d' }}>
          {uptime.toFixed(1)}%
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/devices/${record.id}`);
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
        <h2>
          <ApiOutlined style={{ marginRight: 8 }} />
          设备管理
        </h2>
        <p className="page-desc">管理城市交通监控设备，包括摄像头、毫米波雷达、地磁传感器、RSU路侧单元和信号控制机</p>
      </div>

      <div className="filter-bar">
        <Tabs
          activeKey={filters.status || ''}
          onChange={(key) => setFilters({ status: key || null })}
          items={TAB_ITEMS.map((t) => ({
            key: t.key,
            label: t.label,
          }))}
          style={{ marginBottom: 0 }}
        />
        <Input
          placeholder="搜索设备名称/ID/位置"
          prefix={<SearchOutlined />}
          style={{ width: 240, marginLeft: 'auto' }}
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={fetchList}>
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={devices}
        rowKey="id"
        loading={loading}
        onRow={(record) => ({
          onClick: () => navigate(`/admin/devices/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          pageSize: 20,
          total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 台设备`,
        }}
        scroll={{ x: 1200 }}
        style={{ background: '#fff', borderRadius: 8 }}
      />
    </div>
  );
}
