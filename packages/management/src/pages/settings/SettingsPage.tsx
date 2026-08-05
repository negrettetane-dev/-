import React, { useState } from 'react';
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
} from 'antd';
import {
  SettingOutlined,
  UserOutlined,
  FileTextOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { MOCK_USERS, MockUser, generateSystemLogs, MockSystemLog } from '../../mocks/mockData';

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
            <Form.Item label="自动派发工单">
              <Switch defaultChecked /> <Text type="secondary">市民上报工单自动派发至对应部门</Text>
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

function UserManagement() {
  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => <Text code>{v}</Text>,
    },
    { title: '姓名', dataIndex: 'realName', key: 'realName' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag color="blue">{role}</Tag>,
    },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '手机', dataIndex: 'phone', key: 'phone' },
    { title: '邮箱', dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'success' : 'error'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (time: number) => new Date(time).toLocaleString('zh-CN'),
    },
  ];

  return (
    <Card title="用户管理" extra={<Button type="link">+ 添加用户</Button>}>
      <Table
        columns={columns}
        dataSource={MOCK_USERS}
        rowKey="id"
        pagination={false}
        size="small"
      />
    </Card>
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
