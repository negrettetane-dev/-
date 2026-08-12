import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, message, Select, Space, Tag } from 'antd';
import { apiGet, apiPut } from '../../services/apiClient';

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

  const load = async () => {
    setLoading(true);
    try {
      const result = await apiGet<IncidentDetail>(`/incidents/${id}`);
      setIncident(result);
      setStatus(String(result.status || ''));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '事件详情加载失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);

  const update = async () => {
    setLoading(true);
    try {
      await apiPut(`/incidents/${id}`, { status });
      message.success('状态已更新');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '状态更新失败');
    } finally { setLoading(false); }
  };

  if (!incident) return <div className="content-page"><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/incidents')}>返回列表</Button><div style={{ padding: 60, textAlign: 'center' }}>{loading ? '加载中...' : '未找到事件'}</div></div>;

  return <div className="content-page">
    <Space style={{ marginBottom: 16 }}><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/incidents')}>返回列表</Button></Space>
    <div className="page-header"><h2>事件详情 - {incident.id}</h2></div>
    <Card title="基本信息" style={{ marginBottom: 16 }}>
      <Descriptions bordered column={2}>
        <Descriptions.Item label="类型">{incident.title || '-'}</Descriptions.Item>
        <Descriptions.Item label="状态"><Tag>{incident.status || '-'}</Tag></Descriptions.Item>
        <Descriptions.Item label="严重程度">{incident.severity || '-'}</Descriptions.Item>
        <Descriptions.Item label="位置">{incident.roadName || '-'}</Descriptions.Item>
        <Descriptions.Item label="上报人">{incident.reportedBy || '-'}</Descriptions.Item>
        <Descriptions.Item label="上报时间">{incident.reportedAt ? new Date(incident.reportedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>{incident.description || '-'}</Descriptions.Item>
      </Descriptions>
    </Card>
    <Card title="状态更新">
      <Space>
        <Select value={status} onChange={setStatus} style={{ width: 180 }} options={['pending','processing','resolved','closed'].map(value => ({ value, label: value }))} />
        <Button type="primary" loading={loading} onClick={() => void update()}>保存状态</Button>
      </Space>
      <div style={{ marginTop: 12, color: '#999' }}>当前后端接口只支持更新状态，尚未提供分派、处理备注和积分发放接口。</div>
    </Card>
  </div>;
}
