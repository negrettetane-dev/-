import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, message, Select, Space, Tag, Input } from 'antd';
import { apiGet, apiPut } from '../../services/apiClient';
import {
  INCIDENT_STATUS_OPTIONS,
  INCIDENT_SEVERITY_OPTIONS,
  incidentStatusLabel,
  incidentStatusColor,
  incidentSeverityLabel,
  incidentSeverityColor,
} from '../../constants/incidentStatus';

interface IncidentDetail {
  id: string;
  title?: string;
  description?: string;
  roadName?: string;
  severity?: string;
  status?: string;
  reportedAt?: string;
  reportedBy?: string;
  [key: string]: unknown;
}

export default function IncidentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const result = await apiGet<IncidentDetail>(`/incidents/${id}`);
      setIncident(result);
      setStatus(String(result.status || ''));
      setFeedback(String(result.platformFeedback || result.feedback || ''));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '事件详情加载失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);

  // 保存状态 + 平台反馈：一次性提交，后端同步更新市民端工单状态并向市民推送通知
  const update = async () => {
    if (!status) {
      message.warning('请先选择事件状态');
      return;
    }
    setSaving(true);
    try {
      await apiPut(`/incidents/${id}`, {
        status,
        platformFeedback: feedback.trim(),
        notifyCitizen: true,
      });
      message.success('状态与平台反馈已保存，并已通知市民端');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '状态更新失败');
    } finally { setSaving(false); }
  };

  if (!incident) return <div className="content-page"><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/incidents')}>返回列表</Button><div style={{ padding: 60, textAlign: 'center' }}>{loading ? '加载中...' : '未找到事件'}</div></div>;

  return <div className="content-page">
    <Space style={{ marginBottom: 16 }}><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/incidents')}>返回列表</Button></Space>
    <div className="page-header"><h2>事件详情 - {incident.id}</h2></div>
    <Card title="基本信息" style={{ marginBottom: 16 }}>
      <Descriptions bordered column={2}>
        <Descriptions.Item label="类型">{incident.title || '-'}</Descriptions.Item>
        <Descriptions.Item label="状态"><Tag color={incidentStatusColor(incident.status)}>{incidentStatusLabel(incident.status)}</Tag></Descriptions.Item>
        <Descriptions.Item label="严重程度"><Tag color={incidentSeverityColor(incident.severity)}>{incidentSeverityLabel(incident.severity)}</Tag></Descriptions.Item>
        <Descriptions.Item label="位置">{incident.roadName || '-'}</Descriptions.Item>
        <Descriptions.Item label="上报人">{incident.reportedBy || '-'}</Descriptions.Item>
        <Descriptions.Item label="上报时间">{incident.reportedAt ? new Date(incident.reportedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>{incident.description || '-'}</Descriptions.Item>
      </Descriptions>
    </Card>
    <Card title="状态更新与平台反馈">
      <div style={{ marginBottom: 8 }}>事件状态</div>
      <Select
        value={status || undefined}
        onChange={setStatus}
        style={{ width: 180 }}
        placeholder="请选择状态"
        options={incident?.status === 'closed'
          ? [...INCIDENT_STATUS_OPTIONS.map(item => ({ value: item.value, label: item.label })), { value: 'closed', label: '已关闭（历史状态）', disabled: true }]
          : INCIDENT_STATUS_OPTIONS.map(item => ({ value: item.value, label: item.label }))}
      />
      <div style={{ marginTop: 16, marginBottom: 8 }}>平台反馈（市民端可见）</div>
      <Input.TextArea
        rows={3}
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        placeholder="填写处理结果、预计恢复时间或注意事项，将与状态一起同步到市民端"
        maxLength={500}
        showCount
      />
      <div style={{ marginTop: 16 }}>
        <Button type="primary" loading={saving} onClick={() => void update()}>保存状态</Button>
        <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>保存后将同步更新市民端工单状态，并向市民推送进度通知</span>
      </div>
    </Card>
    <Card title="状态说明" style={{ marginTop: 16 }} size="small">
      <Space wrap size={[16, 8]}>
        {INCIDENT_STATUS_OPTIONS.map(item => (
          <Tag key={item.value} color={item.color}>{item.label}（{item.value}）</Tag>
        ))}
        <span style={{ color: '#999', fontSize: 12 }}>严重程度：</span>
        {INCIDENT_SEVERITY_OPTIONS.map(item => (
          <Tag key={item.value} color={item.color}>{item.label}（{item.value}）</Tag>
        ))}
      </Space>
    </Card>
  </div>;
}
