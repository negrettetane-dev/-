import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Slider,
  InputNumber,
  Spin,
  message,
  Row,
  Col,
  Space,
  Table,
  Typography,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useSignalStore } from '../../stores/signalStore';
import type { SignalPhase } from '../../services/signalService';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  manual: { color: 'blue', label: '手动控制' },
  auto: { color: 'green', label: '自适应' },
  optimizing: { color: 'orange', label: '优化中' },
};

export default function IntersectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedIntersection, loading, fetchById, updatePhases } = useSignalStore();
  const [editingPhases, setEditingPhases] = useState<SignalPhase[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (id) fetchById(id);
  }, [id, fetchById]);

  useEffect(() => {
    if (selectedIntersection?.phases) {
      setEditingPhases([...selectedIntersection.phases.map((p) => ({ ...p }))]);
    }
  }, [selectedIntersection]);

  const handlePhaseChange = (phaseNo: number, field: 'greenTime' | 'yellowTime' | 'redTime', value: number | null) => {
    if (value === null) return;
    setEditingPhases((prev) =>
      prev.map((p) => (p.phaseNo === phaseNo ? { ...p, [field]: value } : p)),
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updatePhases(editingPhases);
    message.success('信号配时已保存');
    setHasChanges(false);
    if (id) fetchById(id);
  };

  const handleOptimizationRecommend = () => {
    message.info('AI正在生成优化建议...');
    // Simulate optimization
    setTimeout(() => {
      setEditingPhases((prev) =>
        prev.map((p) => ({
          ...p,
          greenTime: Math.round(p.greenTime * (0.9 + Math.random() * 0.3)),
          redTime: Math.round(p.redTime * (0.85 + Math.random() * 0.3)),
        })),
      );
      setHasChanges(true);
      message.success('已生成优化建议，请审核后保存');
    }, 1000);
  };

  if (loading || !selectedIntersection) {
    return (
      <div className="content-page flex-center">
        <Spin size="large" />
      </div>
    );
  }

  const inter = selectedIntersection;
  const statusInfo = STATUS_MAP[inter.optimizationStatus];

  const phaseColumns = [
    {
      title: '相位',
      dataIndex: 'phaseNo',
      key: 'phaseNo',
      width: 60,
      render: (v: number) => <b>P{v}</b>,
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 120,
    },
    {
      title: '绿灯时长 (秒)',
      dataIndex: 'greenTime',
      key: 'greenTime',
      width: 280,
      render: (_: number, record: SignalPhase) => (
        <Space>
          <Slider
            style={{ width: 130, margin: 0 }}
            min={record.minGreen}
            max={record.maxGreen}
            value={editingPhases.find((p) => p.phaseNo === record.phaseNo)?.greenTime ?? record.greenTime}
            onChange={(v) => handlePhaseChange(record.phaseNo, 'greenTime', v)}
          />
          <InputNumber
            size="small"
            min={record.minGreen}
            max={record.maxGreen}
            style={{ width: 70 }}
            value={editingPhases.find((p) => p.phaseNo === record.phaseNo)?.greenTime ?? record.greenTime}
            onChange={(v) => handlePhaseChange(record.phaseNo, 'greenTime', v)}
          />
        </Space>
      ),
    },
    {
      title: '黄灯 (秒)',
      dataIndex: 'yellowTime',
      key: 'yellowTime',
      width: 100,
      render: (_: number, record: SignalPhase) => (
        <InputNumber
          size="small"
          min={2}
          max={5}
          style={{ width: 60 }}
          value={editingPhases.find((p) => p.phaseNo === record.phaseNo)?.yellowTime ?? record.yellowTime}
          onChange={(v) => handlePhaseChange(record.phaseNo, 'yellowTime', v)}
        />
      ),
    },
    {
      title: '红灯时长 (秒)',
      dataIndex: 'redTime',
      key: 'redTime',
      width: 120,
      render: (_: number, record: SignalPhase) => (
        <InputNumber
          size="small"
          min={30}
          max={180}
          style={{ width: 80 }}
          value={editingPhases.find((p) => p.phaseNo === record.phaseNo)?.redTime ?? record.redTime}
          onChange={(v) => handlePhaseChange(record.phaseNo, 'redTime', v)}
        />
      ),
    },
  ];

  return (
    <div className="content-page">
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/signals')}>
          返回列表
        </Button>
      </div>

      <div className="page-header">
        <h2>{inter.name}</h2>
        <Space>
          <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
          {inter.greenWaveGroup && <Tag color="cyan">🌊 {inter.greenWaveGroup}</Tag>}
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card title="路口信息" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="路口编号">{inter.id}</Descriptions.Item>
              <Descriptions.Item label="相位数量">{inter.phaseCount}</Descriptions.Item>
              <Descriptions.Item label="当前相位">{inter.currentPhase}</Descriptions.Item>
              <Descriptions.Item label="信号周期">{inter.cycleTime} 秒</Descriptions.Item>
              <Descriptions.Item label="位置">
                [{inter.position[0].toFixed(4)}, {inter.position[1].toFixed(4)}]
              </Descriptions.Item>
              <Descriptions.Item label="优化模式">
                <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="操作面板" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                block
                onClick={handleSave}
                disabled={!hasChanges}
              >
                保存配时方案
              </Button>
              <Button
                icon={<BulbOutlined />}
                block
                onClick={handleOptimizationRecommend}
              >
                AI生成优化建议
              </Button>
              <Button
                icon={<ThunderboltOutlined />}
                block
                danger
                onClick={() => {
                  message.info('已切换为自适应模式（演示）');
                }}
              >
                切换自适应模式
              </Button>
            </Space>
          </Card>
        </Col>

        <Col span={16}>
          <Card
            title="相位配时编辑"
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                周期总长：{editingPhases.reduce((sum, p) => sum + p.greenTime + p.yellowTime + p.redTime, 0)} 秒
              </Typography.Text>
            }
          >
            <Table
              columns={phaseColumns}
              dataSource={editingPhases}
              rowKey="phaseNo"
              pagination={false}
              size="small"
              bordered
            />
          </Card>

          <Card title="相位时序可视化" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 2, height: 40, borderRadius: 4, overflow: 'hidden' }}>
              {editingPhases.map((phase) => (
                <div key={phase.phaseNo} style={{ display: 'flex', flex: phase.greenTime + phase.yellowTime + phase.redTime }}>
                  <div
                    style={{
                      flex: phase.greenTime,
                      background: '#52c41a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      color: '#fff',
                    }}
                  >
                    G{phase.phaseNo}
                  </div>
                  <div
                    style={{
                      flex: phase.yellowTime,
                      background: '#fadb14',
                    }}
                  />
                  <div
                    style={{
                      flex: phase.redTime,
                      background: '#f5222d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      color: '#fff',
                    }}
                  >
                    R{phase.phaseNo}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>
              <span>🟢 绿灯</span>
              <span>🟡 黄灯</span>
              <span>🔴 红灯</span>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
