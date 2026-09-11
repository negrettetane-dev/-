import React, { useMemo, useState } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Table,
  Tag,
  Tabs,
  message,
  Row,
  Col,
  Switch,
  Slider,
  Typography,
  Modal,
  Select,
  Space,
} from 'antd';
import {
  SettingOutlined,
  UserOutlined,
  FileTextOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { generateSystemLogs } from '../../mocks/mockData';import { addOperationLog, getAdminUsers, setAdminUsers, type AdminUser } from '../../stores/adminPersistence';

const { Text } = Typography;

function BasicSettings() {
  return (
    <Card title="基本配置" style={{ marginBottom: 16 }}>
      <Form layout="vertical">
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item label="平台名称">
              <Input defaultValue="智途云枢 · 城市交通智慧管理平台" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="数据刷新间隔 (秒)">
              <InputNumber defaultValue={10} min={5} max={60} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item label="拥堵预警阈值">
              <Slider defaultValue={6.0} min={1} max={10} step={0.1} marks={{ 1: '1', 5: '5', 10: '10' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="事件告警置信度阈值">
              <Slider defaultValue={0.75} min={0.5} max={0.95} step={0.05}
                marks={{ 0.5: '50%', 0.75: '75%', 0.95: '95%' }}
                tooltip={{ formatter: (v?: number) => `${((v ?? 0) * 100).toFixed(0)}%` }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item label="AI检测灵敏度">
              <Switch defaultChecked /> <Text type="secondary">开启后AI将自动检测交通异常事件</Text>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="自动派发事件">
              <Switch defaultChecked /> <Text type="secondary">市民上报事件自动派发至对应部门</Text>
            </Form.Item>
          </Col>
        </Row>
        <Button type="primary" icon={<SaveOutlined />}>
          保存配置
        </Button>
      </Form>
    </Card>
  );
}

const ROLE_META: Record<AdminUser['role'], { label: string; color: string }> = {
  super_admin: { label: '超级管理员', color: 'red' },
  event_handler: { label: '事件处置员', color: 'blue' },
  content_admin: { label: '内容管理员', color: 'purple' },
  ops_admin: { label: '运营管理员', color: 'green' },
};

function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>(() => getAdminUsers());
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<AdminUser>();

  const openCreate = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ role: 'event_handler', status: 'active' });
    setModalOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setModalOpen(true);
  };

  const saveUser = async () => {
    const values = await form.validateFields();
    const nextUsers: AdminUser[] = editingUser
      ? users.map(user => user.id === editingUser.id ? { ...user, ...values } : user)
      : [...users, { ...values, id: `a_${Date.now().toString(36)}`, lastLogin: 0 }];
    setAdminUsers(nextUsers);
    setUsers(nextUsers);
    addOperationLog({
      id: `log_${Date.now().toString(36)}`,
      operator: 'admin',
      module: '系统管理',
      action: editingUser ? '编辑管理员' : '新增管理员',
      target: values.username,
      detail: `${editingUser ? '更新' : '创建'}角色：${ROLE_META[values.role].label}`,
      ip: '127.0.0.1',
      time: Date.now(),
    });
    setModalOpen(false);
    message.success(editingUser ? '管理员信息已更新' : '管理员已创建');
  };

  const toggleStatus = (user: AdminUser) => {
    const status: AdminUser['status'] = user.status === 'active' ? 'disabled' : 'active';
    const nextUsers = users.map(item => item.id === user.id ? { ...item, status } : item);
    setAdminUsers(nextUsers);
    setUsers(nextUsers);
    addOperationLog({ id: `log_${Date.now().toString(36)}`, operator: 'admin', module: '系统管理', action: status === 'active' ? '启用管理员' : '禁用管理员', target: user.username, detail: `账号状态：${status === 'active' ? '启用' : '禁用'}`, ip: '127.0.0.1', time: Date.now() });
    message.success(status === 'active' ? '账号已启用' : '账号已禁用');
  };

  const columns = useMemo(() => [
    { title: '用户名', dataIndex: 'username', key: 'username', render: (v: string) => <Text code>{v}</Text> },
    { title: '姓名', dataIndex: 'realName', key: 'realName' },
    { title: '角色', dataIndex: 'role', key: 'role', render: (role: AdminUser['role']) => <Tag color={ROLE_META[role].color}>{ROLE_META[role].label}</Tag> },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '手机', dataIndex: 'phone', key: 'phone' },
    { title: '邮箱', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status: AdminUser['status']) => <Tag color={status === 'active' ? 'success' : 'error'}>{status === 'active' ? '启用' : '禁用'}</Tag> },
    { title: '操作', key: 'actions', render: (_: unknown, user: AdminUser) => <Space><Button type="link" onClick={() => openEdit(user)}>编辑/分配角色</Button><Button type="link" danger={user.status === 'active'} onClick={() => toggleStatus(user)}>{user.status === 'active' ? '禁用' : '启用'}</Button></Space> },
  ], [users]);

  return (
    <>
      <Card title="管理员账号与角色" extra={<Button type="primary" onClick={openCreate}>+ 添加管理员</Button>}>
        <Table columns={columns} dataSource={users} rowKey="id" pagination={false} size="small" scroll={{ x: 1000 }} />
      </Card>
      <Modal title={editingUser ? '编辑管理员与角色' : '新增管理员'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => void saveUser()} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}><Input disabled={Boolean(editingUser)} /></Form.Item>
          <Form.Item name="realName" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input /></Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}><Select options={Object.entries(ROLE_META).map(([value, meta]) => ({ value, label: meta.label }))} /></Form.Item>
          <Form.Item name="department" label="部门" rules={[{ required: true, message: '请输入部门' }]}><Input /></Form.Item>
          <Form.Item name="phone" label="手机"><Input /></Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '邮箱格式不正确' }]}><Input /></Form.Item>
          <Form.Item name="status" label="账号状态"><Select options={[{ value: 'active', label: '启用' }, { value: 'disabled', label: '禁用' }]} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function SystemLogs() {
  const logs = generateSystemLogs();

  const columns = [
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 170,
      render: (time: number) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 100,
      render: (u: string) => <Text code>{u}</Text>,
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 100,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (ip: string) => <Text code style={{ fontSize: 11 }}>{ip}</Text>,
    },
  ];

  return (
    <Card title="系统操作日志">
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条记录` }}
        size="small"
        scroll={{ y: 400 }}
      />
    </Card>
  );
}

export default function SettingsPage() {
  const tabItems = [
    {
      key: 'basic',
      label: <span><SettingOutlined /> 基本设置</span>,
      children: <BasicSettings />,
    },
    {
      key: 'users',
      label: <span><UserOutlined /> 用户管理</span>,
      children: <UserManagement />,
    },
    {
      key: 'logs',
      label: <span><FileTextOutlined /> 系统日志</span>,
      children: <SystemLogs />,
    },
  ];

  return (
    <div className="content-page">
      <div className="page-header">
        <h2>
          <SettingOutlined style={{ marginRight: 8 }} />
          系统设置
        </h2>
        <p className="page-desc">管理系统配置、用户账号和查看操作日志</p>
      </div>

      <Tabs defaultActiveKey="basic" items={tabItems} />
    </div>
  );
}
