import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, message, Select, Space, Tag, Input, Timeline, Image } from 'antd';
import { apiGet, apiPut } from '../../services/apiClient';
import {
  INCIDENT_STATUS_OPTIONS,
  INCIDENT_SEVERITY_OPTIONS,
  incidentStatusLabel,
  incidentStatusColor,
  normalizeIncidentStatus,
  incidentSeverityLabel,
  incidentSeverityColor,
} from '../../constants/incidentStatus';

interface IncidentProcessLog {
  id?: string;
  time: number | string;
  action: string;
  operator: string;
  fromStatus?: string;
  toStatus?: string;
  detail?: string;
}

interface IncidentDetail {
  id: string;
  title?: string;
  description?: string;
  roadName?: string;
  position?: [number, number];
  severity?: string;
  status?: string;
  reportedAt?: string;
  reportedBy?: string;
  category?: string;
  department?: string;
  assignee?: string;
  estimatedProcessTime?: string;
  images?: string[];
  afterImages?: string[];
  afterImage?: string;
  accessibilityImpact?: boolean;
  platformFeedback?: string;
  feedback?: string;
  processLogs?: IncidentProcessLog[];
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
  const [department, setDepartment] = useState('');
  const [estimatedProcessTime, setEstimatedProcessTime] = useState('');
  const [afterImageUrl, setAfterImageUrl] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const result = await apiGet<IncidentDetail>(`/incidents/${id}`);
      const normalizedStatus = normalizeIncidentStatus(String(result.status || ''));
      setIncident({ ...result, status: normalizedStatus });
      setStatus(normalizedStatus);
      setFeedback(String(result.platformFeedback || result.feedback || ''));
      setDepartment(String(result.department || ''));
      setEstimatedProcessTime(String(result.estimatedProcessTime || ''));
      setAfterImageUrl(String(result.afterImages?.[0] || result.afterImage || ''));
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
        department: department.trim(),
        estimatedProcessTime: estimatedProcessTime.trim(),
        afterImages: afterImageUrl.trim() ? [afterImageUrl.trim()] : [],
        notifyCitizen: true,
      });
      message.success('状态、处理信息与平台反馈已保存，并已通知市民端');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '状态更新失败');
    } finally { setSaving(false); }
  };

  if (!incident) return <div className="content-page"><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/incidents')}>返回列表</Button><div style={{ padding: 60, textAlign: 'center' }}>{loading ? '加载中...' : '未找到事件'}</div></div>;

  const afterImages = incident.afterImages?.length ? incident.afterImages : (incident.afterImage ? [incident.afterImage] : []);

  return <div className="content-page">
    <Space style={{ marginBottom: 16 }}><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/incidents')}>返回列表</Button></Space>
    <div className="page-header"><h2>事件详情 - {incident.id}</h2></div>
    <Card title="基本信息" style={{ marginBottom: 16 }}>
      <Descriptions bordered column={2}>
        <Descriptions.Item label="类型">{incident.title || '-'}</Descriptions.Item>
        <Descriptions.Item label="状态"><Tag color={incidentStatusColor(incident.status)}>{incidentStatusLabel(incident.status)}</Tag></Descriptions.Item>
        <Descriptions.Item label="严重程度"><Tag color={incidentSeverityColor(incident.severity)}>{incidentSeverityLabel(incident.severity)}</Tag></Descriptions.Item>
        <Descriptions.Item label="位置">{incident.roadName || '-'}</Descriptions.Item>
        <Descriptions.Item label="坐标">{incident.position ? `${incident.position[0].toFixed(5)}, ${incident.position[1].toFixed(5)}` : '-'}</Descriptions.Item>
        <Descriptions.Item label="上报人">{incident.reportedBy || '-'}</Descriptions.Item>
        <Descriptions.Item label="上报时间">{incident.reportedAt ? new Date(incident.reportedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
        <Descriptions.Item label="受理部门">{incident.department || '-'}</Descriptions.Item>
        <Descriptions.Item label="预计处理时间">{incident.estimatedProcessTime || '-'}</Descriptions.Item>
        <Descriptions.Item label="无障碍影响">{incident.accessibilityImpact || incident.category?.startsWith('accessibility') ? <Tag color="purple">影响无障碍出行</Tag> : '-'}</Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>{incident.description || '-'}</Descriptions.Item>
      </Descriptions>
    </Card>

    <Card title="上报与处理图片" style={{ marginBottom: 16 }}>
      <Descriptions bordered column={2}>
        <Descriptions.Item label="上报图片">
          {incident.images?.length ? <Image.PreviewGroup>{incident.images.map((src, index) => <Image key={src} src={src} width={120} alt={`上报图片${index + 1}`} style={{ marginRight: 8 }} />)}</Image.PreviewGroup> : '暂无上报图片'}
        </Descriptions.Item>
        <Descriptions.Item label="处理后图片">
          {afterImages.length ? <Image.PreviewGroup>{afterImages.map((src, index) => <Image key={src} src={src} width={120} alt={`处理后图片${index + 1}`} style={{ marginRight: 8 }} />)}</Image.PreviewGroup> : '暂无处理后图片'}
        </Descriptions.Item>
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
      <Space direction="vertical" size={12} style={{ display: 'flex', marginTop: 16 }}>
        <label>受理部门<Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="例如：无障碍设施维护部门" /></label>
        <label>预计处理时间<Input value={estimatedProcessTime} onChange={e => setEstimatedProcessTime(e.target.value)} placeholder="例如：预计 4 小时内完成处置" /></label>
        <label>处理后图片 URL<Input value={afterImageUrl} onChange={e => setAfterImageUrl(e.target.value)} placeholder="演示环境可填写图片 URL" /></label>
      </Space>
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
        <Button type="primary" loading={saving} onClick={() => void update()}>保存状态与处理信息</Button>
        <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>保存后将同步更新市民端工单状态，并向市民推送进度通知</span>
      </div>
    </Card>
    <Card title="处理历史记录" style={{ marginTop: 16 }}>
      {incident.processLogs && incident.processLogs.length > 0 ? (
        <Timeline
          items={[...incident.processLogs]
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
            .map((log) => ({
              color: log.fromStatus && log.toStatus ? 'blue' : 'gray',
              children: (
                <div>
                  <div style={{ fontWeight: 600 }}>{log.action}</div>
                  <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>
                    {log.operator}
                    {log.fromStatus && log.toStatus ? ` · ${incidentStatusLabel(log.fromStatus)} → ${incidentStatusLabel(log.toStatus)}` : ''}
                    {log.detail ? ` · ${log.detail}` : ''}
                  </div>
                  <div style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12 }}>
                    {new Date(log.time).toLocaleString('zh-CN')}
                  </div>
                </div>
              ),
            }))}
        />
      ) : (
        <div style={{ color: '#999' }}>暂无处理记录</div>
      )}
    </Card>
  </div>;
}
