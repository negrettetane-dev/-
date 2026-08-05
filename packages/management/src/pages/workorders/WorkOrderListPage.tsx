import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Button, Space, Select, Input } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useWorkOrderStore } from '../../stores/workOrderStore';
import type { MockWorkOrder } from '../../mocks/mockData';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待受理' },
  received: { color: 'processing', label: '已受理' },
  processing: { color: 'orange', label: '处置中' },
  completed: { color: 'success', label: '已办结' },
  rejected: { color: 'error', label: '已驳回' },
};

const CATEGORY_MAP: Record<string, string> = {
  pothole: '路面坑洼',
  streetlight: '路灯损坏',
  illegal_park: '违停占道',
  manhole: '井盖破损',
  signal_fault: '信号灯故障',
  accident_clue: '交通事故线索',
  barrier: '道路障碍',
  other: '其他问题',
};

export default function WorkOrderListPage() {
  const navigate = useNavigate();
  const { workOrders, loading, total, page, pageSize, filters, fetchList, setFilters, setPage } =
    useWorkOrderStore();

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const columns: ColumnsType<MockWorkOrder> = [
    {
      title: '工单编号',
      dataIndex: 'workOrderNo',
      key: 'workOrderNo',
      width: 130,
      render: (no: string) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{no}</span>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 110,
      render: (cat: string) => (
        <Tag>{CATEGORY_MAP[cat] || cat}</Tag>
      ),
    },
    {
      title: '问题描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => (
        <span title={desc}>{desc.length > 40 ? desc.slice(0, 40) + '...' : desc}</span>
      ),
    },
    {
      title: '上报人',
      dataIndex: 'reporterName',
      key: 'reporterName',
      width: 90,
    },
    {
      title: '位置',
      dataIndex: 'address',
      key: 'address',
      width: 200,
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
      title: '上报时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 170,
      sorter: (a, b) => a.createTime - b.createTime,
      render: (time: number) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '满意度',
      dataIndex: 'rating',
      key: 'rating',
      width: 90,
      render: (rating?: number) =>
        rating ? (
          <span>
            {'⭐'.repeat(rating)}
          </span>
        ) : (
          <span style={{ color: 'rgba(0,0,0,0.3)' }}>--</span>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right' as const,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/workorders/${record.id}`);
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
          <FileTextOutlined style={{ marginRight: 8 }} />
          工单处置
        </h2>
        <p className="page-desc">处理市民通过"随手拍"上报的交通问题工单</p>
      </div>

      <div className="filter-bar">
        <Select
          placeholder="工单状态"
          allowClear
          style={{ width: 130 }}
          value={filters.status}
          onChange={(val) => setFilters({ status: val })}
          options={[
            { value: 'pending', label: '待受理' },
            { value: 'received', label: '已受理' },
            { value: 'processing', label: '处置中' },
            { value: 'completed', label: '已办结' },
            { value: 'rejected', label: '已驳回' },
          ]}
        />
        <Input
          placeholder="搜索工单编号/描述"
          prefix={<SearchOutlined />}
          style={{ width: 240 }}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={fetchList}>
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={workOrders}
        rowKey="id"
        loading={loading}
        onRow={(record) => ({
          onClick: () => navigate(`/admin/workorders/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个工单`,
          onChange: (p) => setPage(p),
        }}
        scroll={{ x: 1300 }}
        style={{ background: '#fff', borderRadius: 8 }}
      />
    </div>
  );
}
