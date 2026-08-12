import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { adminLogin, isAdminLoggedIn } from '../../stores/adminAuth';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: { account: string; password: string }) => {
    setLoading(true);
    const result = await adminLogin(values.account.trim(), values.password);
    setLoading(false);
    if (result.ok) {
      message.success(`欢迎回来，${result.admin?.realName || '管理员'}`);
      navigate('/admin', { replace: true });
    } else {
      message.error(result.error || '登录失败');
    }
  };

  // 已登录直接进入
  if (isAdminLoggedIn()) {
    navigate('/admin', { replace: true });
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a1628 0%, #10243e 60%, #163a5f 100%)',
    }}>
      <Card style={{ width: 400, boxShadow: '0 12px 48px rgba(0,0,0,0.3)', borderRadius: 12 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🚦</div>
          <Typography.Title level={3} style={{ margin: 0 }}>智途云枢 · 管理后台</Typography.Title>
          <Typography.Text type="secondary">城市智慧交通管理平台</Typography.Text>
        </div>

        <Form layout="vertical" onFinish={handleLogin} requiredMark={false}>
          <Form.Item name="account" rules={[{ required: true, message: '请输入账号' }]}>
            <Input size="large" prefix={<UserOutlined />} placeholder="请输入管理员账号" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password size="large" prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" size="large" htmlType="submit" block loading={loading}>
              登 录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
