import React, { useState } from 'react';
import { Card, Tabs, Table, Tag, Button, Switch, InputNumber, message, Space, Statistic, Row, Col } from 'antd';
import { getPointRules, setPointRules, getPointTransactions, getRedemptionRecords, type PointRule, type PointTransaction } from '../../stores/adminPersistence';

export default function CarbonManagementPage() {
  const [rules, setRules] = useState<PointRule[]>(getPointRules());
  const [txs] = useState<PointTransaction[]>(getPointTransactions());
  const [redemptions] = useState<any[]>(getRedemptionRecords ? getRedemptionRecords() : []);

  const saveRules = () => {
    setPointRules(rules);
    message.success('积分规则已保存');
  };

  const txCols = [
    { title: '用户', dataIndex: 'userId', width: 80 },
    { title: '类型', dataIndex: 'type', width: 70, render: (t: string) => ({ earn: <Tag color="green">获得</Tag>, redeem: <Tag color="blue">兑换</Tag>, adjust: <Tag color="orange">调整</Tag> }[t] || t) },
    { title: '数量', dataIndex: 'amount', width: 70, render: (v: number) => <span style={{ color: v > 0 ? '#52c41a' : '#f5222d', fontWeight: 600 }}>{v > 0 ? '+' : ''}{v}</span> },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
    { title: '操作员', dataIndex: 'operator', width: 80 },
    { title: '时间', dataIndex: 'time', width: 150, render: (v: number) => new Date(v).toLocaleString('zh-CN') },
  ];

  return (
    <div className="content-page">
      <div className="page-header"><h2>🎁 碳积分管理</h2><p className="page-desc">积分规则配置、积分流水查询、兑换记录</p></div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="今日发放" value={txs.filter(t => t.type === 'earn' && t.time > Date.now() - 86400000).reduce((s, t) => s + t.amount, 0)} suffix="积分" valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="今日兑换" value={txs.filter(t => t.type === 'redeem' && t.time > Date.now() - 86400000).reduce((s, t) => s + t.amount, 0)} suffix="积分" valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总流水" value={txs.length} suffix="条" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="兑换订单" value={redemptions.length} suffix="单" /></Card></Col>
      </Row>

      <Tabs defaultActiveKey="rules" items={[
        {
          key: 'rules', label: '积分规则',
          children: (
            <Card extra={<Button type="primary" onClick={saveRules}>保存规则</Button>}>
              <Table dataSource={rules} rowKey="id" size="small" pagination={false} columns={[
                { title: '行为名称', dataIndex: 'name' },
                { title: '动作标识', dataIndex: 'action' },
                { title: '积分值', dataIndex: 'points', render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 600 }}>+{v}</span> },
                { title: '启用', dataIndex: 'enabled', render: (v: boolean, _, idx) => <Switch checked={v} onChange={checked => setRules(prev => prev.map((r, i) => i === idx ? { ...r, enabled: checked } : r))} /> },
              ]} />
            </Card>
          ),
        },
        {
          key: 'transactions', label: '积分流水',
          children: <Table dataSource={txs} rowKey="id" size="small" columns={txCols} pagination={{ pageSize: 15 }} />,
        },
        {
          key: 'redemptions', label: '兑换记录',
          children: <Table dataSource={redemptions} rowKey="id" size="small" pagination={{ pageSize: 15 }} columns={[
            { title: '用户', dataIndex: 'user_id', width: 60 },
            { title: '商品', dataIndex: 'reward_name', ellipsis: true },
            { title: '消耗积分', dataIndex: 'points_cost', width: 80, render: (v: number) => <span style={{ color: '#f5222d' }}>-{v}</span> },
            { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => s === 'unused' ? <Tag>未使用</Tag> : s === 'used' ? <Tag color="green">已使用</Tag> : <Tag color="red">已过期</Tag> },
            { title: '兑换时间', dataIndex: 'redeemed_at', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
            { title: '有效期至', dataIndex: 'expires_at', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
          ]} />,
        },
      ]} />
    </div>
  );
}
