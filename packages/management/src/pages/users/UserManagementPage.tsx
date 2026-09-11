import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Input, InputNumber, message, Card, Statistic, Row, Col, Descriptions } from 'antd';
import { EyeOutlined, DollarOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  userManagementService,
  type CitizenUser,
  type PointTransaction,
} from '../../services/userManagementService';

export default function UserManagementPage() {
  const [users, setUsers] = useState<CitizenUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<CitizenUser | null>(null);
  const [pointTx, setPointTx] = useState<PointTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const loadUsers = async (nextPage = page, nextPageSize = pageSize, searchValue = activeSearch) => {
    setLoading(true);
    try {
      const result = await userManagementService.list({ page: nextPage, pageSize: nextPageSize, search: searchValue || undefined });
      setUsers(result.list || []);
      setTotal(result.total ?? 0);
      setPage(result.page || nextPage);
      setPageSize(result.pageSize || nextPageSize);
    } catch (error) {
      setUsers([]);
      setTotal(0);
      message.error(error instanceof Error ? error.message : '真实用户数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUsers(1, 15, ''); }, []);

  const openUserDetail = async (user: CitizenUser) => {
    setSelectedUser(user);
    setPointTx([]);
    setTxModalOpen(true);
    setTxLoading(true);
    try {
      const result = await userManagementService.pointTransactions(user.id);
      setPointTx(result.list || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '积分流水加载失败');
    } finally {
      setTxLoading(false);
    }
  };

  const cols: ColumnsType<CitizenUser> = [
    { title: '用户名', dataIndex: 'username', key: 'un', width: 100 },
    { title: '昵称', dataIndex: 'nickname', key: 'nn', width: 100, render: (v: string|undefined) => v || '-' },
    { title: '手机号', dataIndex: 'phone', key: 'ph', width: 130, render: (v: string) => v || '-' },
    { title: '邮箱', dataIndex: 'email', key: 'em', width: 160, ellipsis: true, render: (v: string|undefined) => v || '-' },
    { title: '碳积分', dataIndex: 'carbonCredits', key: 'pts', width: 80, sorter: (a, b) => (a.carbonCredits||0) - (b.carbonCredits||0) },
    { title: '实名状态', dataIndex: 'isVerified', key: 'ver', width: 90, render: (v: boolean) => v ? <Tag color="green">已认证</Tag> : <Tag>未认证</Tag> },
    { title: '注册时间', dataIndex: 'createdAt', key: 'ct', width: 140, render: (v: number | string) => new Date(v).toLocaleDateString('zh-CN') },
    { title: '操作', key: 'act', width: 220, render: (_, r) => (
      <Space>
        <Button size="small" icon={<EyeOutlined />} onClick={() => void openUserDetail(r)}>详情</Button>
        <Button size="small" icon={<DollarOutlined />} onClick={() => { setSelectedUser(r); setAdjustAmount(0); setAdjustReason(''); setAdjustModalOpen(true); }}>调整积分</Button>
      </Space>
    )},
  ];

  const handleAdjustPoints = async () => {
    if (!selectedUser || adjustAmount === 0) { message.warning('请输入调整金额'); return; }
    if (!adjustReason.trim()) { message.warning('请填写调整原因'); return; }
    setAdjusting(true);
    try {
      await userManagementService.adjustPoints(selectedUser.id, adjustAmount, adjustReason.trim());
      message.success(`已调整 ${adjustAmount > 0 ? '+' : ''}${adjustAmount} 积分`);
      setAdjustModalOpen(false);
      await loadUsers(page, pageSize, activeSearch);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '积分调整失败');
    } finally {
      setAdjusting(false);
    }
  };

  const submitSearch = () => {
    const nextSearch = search.trim();
    setActiveSearch(nextSearch);
    void loadUsers(1, pageSize, nextSearch);
  };

  return (
    <div className="content-page">
      <div className="page-header"><h2>👥 用户管理</h2><p className="page-desc">管理市民用户、查看详情、调整碳积分</p></div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总用户数" value={total} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="当前页积分" value={users.reduce((sum, user) => sum + (user.carbonCredits || 0), 0)} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索用户名、昵称、手机号或邮箱" prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} onPressEnter={submitSearch} style={{ width: 320 }} allowClear />
        <Button type="primary" onClick={submitSearch}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => void loadUsers(page, pageSize, activeSearch)}>刷新</Button>
      </Space>
      <Table
        columns={cols}
        dataSource={users}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: value => `共 ${value} 位用户`,
          onChange: (nextPage, nextPageSize) => void loadUsers(nextPage, nextPageSize, activeSearch),
        }}
      />

      {/* 用户详情 + 积分流水弹窗 */}
      <Modal title={`用户详情 - ${selectedUser?.nickname || selectedUser?.username}`} open={txModalOpen} onCancel={() => setTxModalOpen(false)} footer={null} width={640}>
        <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="用户名">{selectedUser?.username}</Descriptions.Item>
          <Descriptions.Item label="昵称">{selectedUser?.nickname || '-'}</Descriptions.Item>
          <Descriptions.Item label="手机号">{selectedUser?.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{selectedUser?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="碳积分"><b style={{ color: '#52c41a' }}>{selectedUser?.carbonCredits || 0}</b></Descriptions.Item>
          <Descriptions.Item label="实名">{selectedUser?.isVerified ? '✅ 已认证' : '未认证'}</Descriptions.Item>
        </Descriptions>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>📋 积分流水</div>
        <Table dataSource={pointTx} rowKey="id" size="small" loading={txLoading} pagination={false} columns={[
          { title: '类型', dataIndex: 'type', width: 70, render: (t: string) => ({ earn: <Tag color="green">获得</Tag>, redeem: <Tag color="blue">兑换</Tag>, adjust: <Tag color="orange">调整</Tag> }[t] || t) },
          { title: '数量', dataIndex: 'amount', width: 70, render: (v: number) => <span style={{ color: v > 0 ? '#52c41a' : '#f5222d', fontWeight: 600 }}>{v > 0 ? '+' : ''}{v}</span> },
          { title: '原因', dataIndex: 'reason', ellipsis: true },
          { title: '操作员', dataIndex: 'operator', width: 80 },
          { title: '时间', dataIndex: 'time', width: 150, render: (v: number | string) => new Date(v).toLocaleString('zh-CN') },
        ]} />
      </Modal>

      {/* 积分调整弹窗 */}
      <Modal title={`积分调整 - ${selectedUser?.nickname || selectedUser?.username}`} open={adjustModalOpen} confirmLoading={adjusting} onOk={() => void handleAdjustPoints()} onCancel={() => setAdjustModalOpen(false)}>
        <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 600, marginBottom: 4 }}>当前积分</div><b style={{ color: '#52c41a', fontSize: 24 }}>{selectedUser?.carbonCredits || 0}</b></div>
        <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 600, marginBottom: 4 }}>调整数量（正值增加，负值减少）</div><InputNumber style={{ width: '100%' }} value={adjustAmount} onChange={v => setAdjustAmount(v || 0)} /></div>
        <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 600, marginBottom: 4 }}>调整原因 <span style={{ color: '#f5222d' }}>*</span></div><Input placeholder="必填：说明积分调整的原因" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} /></div>
      </Modal>
    </div>
  );
}
