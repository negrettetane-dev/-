import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Spin,
  Row,
  Col,
  Timeline,
  Typography,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useDeviceStore } from '../../stores/deviceStore';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  online: { color: 'success', label: '在线' },
  offline: { color: 'error', label: '离线' },
  fault: { color: 'warning', label: '故障' },
  maintenance: { color: 'processing', label: '维护中' },
};

const TYPE_MAP: Record<string, string> = {
  camera: '摄像头',
  radar: '毫米波雷达',
  geomagnetic: '地磁传感器',
  rsu: 'RSU路侧单元',
  signal_controller: '信号控制机',
};

const { Text } = Typography;

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedDevice, loading, fetchById } = useDeviceStore();

  useEffect(() => {
    if (id) fetchById(id);
  }, [id, fetchById]);

  // Mock uptime history data
  const uptimeChartOption = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const data = hours.map((_, i) => {
      const base = 95;
      const hour = i;
      // Simulate slight dips during early morning
      const dip = (hour >= 2 && hour <= 5) ? -2 - Math.random() * 3 : Math.random() * 2 - 1;
      return Math.min(100, Math.max(85, base + dip));
    });
    return {
      backgroundColor: 'transparent',
      grid: { left: 10, right: 10, top: 10, bottom: 10, containLabel: true },
      tooltip: { trigger: 'axis' as const },
      xAxis: {
        type: 'category' as const,
        data: hours,
        axisLabel: { fontSize: 10, interval: 3 },
      },
      yAxis: {
        type: 'value' as const,
        min: 80,
        max: 100,
        axisLabel: { fontSize: 10, formatter: '{value}%' },
      },
      series: [
        {
          type: 'line',
          data,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#1677ff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(22,119,255,0.3)' },
              { offset: 1, color: 'rgba(22,119,255,0.02)' },
            ]),
          },
        },
      ],
    };
  }, []);

  // Recent alerts
  const recentAlerts = [
    { time: Date.now() - 7200000, type: 'warning', msg: '延迟升高至 350ms' },
    { time: Date.now() - 36000000, type: 'info', msg: '设备重启完成' },
    { time: Date.now() - 86400000, type: 'warning', msg: '短暂离线 2 分钟' },
    { time: Date.now() - 86400000 * 2, type: 'error', msg: '数据中断 15 分钟' },
    { time: Date.now() - 86400000 * 3, type: 'info', msg: '固件升级至 v2.3.1' },
  ];

  if (loading || !selectedDevice) {
    return (
      <div className="content-page flex-center">
        <Spin size="large" />
      </div>
    );
  }

  const dev = selectedDevice;
  const statusInfo = STATUS_MAP[dev.status];
  const installDate = dev.installDate
    ? new Date(dev.installDate).toLocaleDateString('zh-CN')
    : '未知';

  return (
    <div className="content-page">
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/devices')}>
          返回列表
        </Button>
      </div>

      <div className="page-header">
        <h2>{dev.name}</h2>
        <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
      </div>

      <Row gutter={16}>
        <Col span={10}>
          <Card title="设备信息" style={{ marginBottom: 16 }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="设备ID">
                <Text code>{dev.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="设备类型">
                {TYPE_MAP[dev.type] || dev.type}
              </Descriptions.Item>
              <Descriptions.Item label="设备型号">
                {dev.model || '--'}
              </Descriptions.Item>
              <Descriptions.Item label="所在路段">
                {dev.roadName}
              </Descriptions.Item>
              <Descriptions.Item label="GPS坐标">
                [{dev.position[0].toFixed(6)}, {dev.position[1].toFixed(6)}]
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="运行率">
                <span style={{
                  color: dev.uptime >= 95 ? '#52c41a' : dev.uptime >= 80 ? '#faad14' : '#f5222d',
                  fontWeight: 600,
                }}>
                  {dev.uptime.toFixed(1)}%
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="最后心跳">
                {new Date(dev.lastHeartbeat).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="安装日期">
                {installDate}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={14}>
          <Card title="24小时在线率趋势" style={{ marginBottom: 16 }}>
            <ReactEChartsCore
              echarts={echarts}
              option={uptimeChartOption}
              style={{ height: 240, width: '100%' }}
              notMerge
              lazyUpdate
            />
          </Card>

          <Card title="最近告警/事件">
            <Timeline
              items={recentAlerts.map((alert) => ({
                color: alert.type === 'error' ? 'red' : alert.type === 'warning' ? 'orange' : 'blue',
                children: (
                  <div>
                    <div style={{ fontWeight: 500 }}>{alert.msg}</div>
                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                      {new Date(alert.time).toLocaleString('zh-CN')}
                    </div>
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
