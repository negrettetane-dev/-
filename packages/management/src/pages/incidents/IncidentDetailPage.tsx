import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Badge,
  Timeline,
  Button,
  Space,
  Select,
  Input,
  message,
  Spin,
  Row,
  Col,
  Image,
  Modal,
} from 'antd';
import {
  ArrowLeftOutlined,
  SendOutlined,
  CheckCircleOutlined,
  FolderOpenOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useIncidentStore } from '../../stores/incidentStore';

const SEVERITY_MAP: Record<string, { color: string; label: string }> = {
  normal: { color: 'blue', label: '一般' },
  serious: { color: 'orange', label: '严重' },
  critical: { color: 'red', label: '紧急' },
};

const STATUS_MAP: Record<string, { status: 'success' | 'processing' | 'warning' | 'error' | 'default'; label: string }> = {
  new: { status: 'error', label: '待处理' },
  dispatched: { status: 'processing', label: '已派发' },
  processing: { status: 'processing', label: '处置中' },
  resolved: { status: 'success', label: '已解决' },
  archived: { status: 'default', label: '已归档' },
};

const SOURCE_MAP: Record<string, { color: string; label: string }> = {
  ai_detection: { color: 'purple', label: 'AI检测' },
  citizen_report: { color: 'green', label: '市民上报' },
  patrol: { color: 'blue', label: '巡检' },
  sensor: { color: 'cyan', label: '传感器' },
};

const DEPARTMENTS = [
  '交警东城支队', '市政工程处', '路桥维护中心', '信号控制中心',
  '海淀区交管局', '朝阳区城管局', '西城区交警大队',
];

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedIncident, loading, fetchById, updateStatus } = useIncidentStore();
  const [assignDept, setAssignDept] = useState<string>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (id) fetchById(id);
  }, [id, fetchById]);

  const handleAssign = async () => {
    if (!assignDept) {
      message.warning('请选择指派部门');
      return;
    }
    await updateStatus(id!, 'dispatched');
    message.success(`已派发至 ${assignDept}`);
    if (id) fetchById(id);
  };

  const handleResolve = async () => {
    Modal.confirm({
      title: '确认解决',
      content: '确认将该事件标记为已解决？',
      onOk: async () => {
        await updateStatus(id!, 'resolved');
        message.success('事件已标记为已解决');
        if (id) fetchById(id);
      },
    });
  };

  const handleArchive = async () => {
    Modal.confirm({
      title: '确认归档',
      content: '确认将该事件归档？归档后不可再修改。',
      onOk: async () => {
        await updateStatus(id!, 'archived');
        message.success('事件已归档');
        if (id) fetchById(id);
      },
    });
  };

  if (loading || !selectedIncident) {
    return (
      <div className="content-page flex-center">
        <Spin size="large" />
      </div>
    );
  }

  const inc = selectedIncident;
  const severityInfo = SEVERITY_MAP[inc.severity];
  const statusInfo = STATUS_MAP[inc.status];
  const sourceInfo = SOURCE_MAP[inc.source];

  // Generate mock timeline
  const timeline = [
    {
      time: inc.createTime,
      action: '事件创建',
      detail: `${sourceInfo.label}发现事件：${inc.title}`,
      color: 'blue',
    },
    ...(inc.status !== 'new'
      ? [
          {
            time: inc.createTime + 600000,
            action: '系统派发',
            detail: `自动派发至 ${inc.assignedTo || '待分配部门'}`,
            color: 'green',
          },
        ]
      : []),
    ...(inc.status === 'processing' || inc.status === 'resolved' || inc.status === 'archived'
      ? [
          {
            time: inc.createTime + 1800000,
            action: '处置开始',
            detail: `${inc.assignedTo || '处置单位'} 已到场处置`,
            color: 'orange',
          },
        ]
      : []),
    ...(inc.status === 'resolved' || inc.status === 'archived'
      ? [
          {
            time: inc.resolveTime || inc.createTime + 3600000,
            action: '处置完成',
            detail: '事件已处理完毕，交通恢复正常',
            color: 'green',
          },
        ]
      : []),
  ];

  return (
    <div className="content-page">
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/incidents')}>
          返回列表
        </Button>
      </div>

      <div className="page-header">
        <h2>事件详情 - {inc.id}</h2>
        <p className="page-desc">{inc.title}</p>
      </div>

      <Row gutter={16}>
        {/* Left: Incident info + Timeline */}
        <Col span={16}>
          <Card title="基本信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="事件编号">{inc.id}</Descriptions.Item>
              <Descriptions.Item label="来源">
                <Tag color={sourceInfo.color}>{sourceInfo.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="事件类型">{inc.type}</Descriptions.Item>
              <Descriptions.Item label="严重程度">
                <Tag color={severityInfo.color}>{severityInfo.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge status={statusInfo.status} text={statusInfo.label} />
              </Descriptions.Item>
              <Descriptions.Item label="指派单位">
                {inc.assignedTo || '--'}
              </Descriptions.Item>
              <Descriptions.Item label="发生位置" span={2}>
                {inc.roadName}
              </Descriptions.Item>
              <Descriptions.Item label="坐标" span={2}>
                [{inc.position[0].toFixed(4)}, {inc.position[1].toFixed(4)}]
              </Descriptions.Item>
              <Descriptions.Item label="发生时间" span={2}>
                {new Date(inc.createTime).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {inc.description}
              </Descriptions.Item>
            </Descriptions>

            {inc.images.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>现场图片</div>
                <Image.PreviewGroup>
                  {inc.images.map((img, idx) => (
                    <Image key={idx} src={img} width={200} style={{ marginRight: 8 }} fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjE0Ij7kuI3lj6/nlKjnmoTlm77niYc8L3RleHQ+PC9zdmc+" />
                  ))}
                </Image.PreviewGroup>
              </div>
            )}
          </Card>

          <Card title="处理时间线" style={{ marginBottom: 16 }}>
            <Timeline
              items={timeline.map((t) => ({
                color: t.color,
                children: (
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.action}</div>
                    <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>{t.detail}</div>
                    <div style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12 }}>
                      {new Date(t.time).toLocaleString('zh-CN')}
                    </div>
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>

        {/* Right: Actions panel */}
        <Col span={8}>
          <Card title="处置操作" style={{ marginBottom: 16 }}>
            {inc.status === 'new' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>派发处置</div>
                <Select
                  placeholder="选择指派部门"
                  style={{ width: '100%', marginBottom: 8 }}
                  value={assignDept || undefined}
                  onChange={setAssignDept}
                  options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  block
                  onClick={handleAssign}
                >
                  派发处置
                </Button>
              </div>
            )}

            {inc.status === 'dispatched' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.45)' }}>
                  已派发至：<Tag>{inc.assignedTo}</Tag>
                </div>
                <Button
                  icon={<CheckCircleOutlined />}
                  style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
                  block
                  onClick={handleResolve}
                >
                  标记已解决
                </Button>
              </div>
            )}

            {inc.status === 'processing' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.45)' }}>
                  处置中：<Tag>{inc.assignedTo}</Tag>
                </div>
                <Button
                  icon={<CheckCircleOutlined />}
                  style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
                  block
                  onClick={handleResolve}
                >
                  标记已解决
                </Button>
              </div>
            )}

            {inc.status === 'resolved' && (
              <div style={{ marginBottom: 16 }}>
                <Button
                  icon={<FolderOpenOutlined />}
                  block
                  onClick={handleArchive}
                >
                  归档事件
                </Button>
              </div>
            )}

            {inc.status === 'archived' && (
              <div style={{ color: 'rgba(0,0,0,0.45)', textAlign: 'center' }}>
                该事件已归档
              </div>
            )}

            <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #f0f0f0' }} />

            {/* Internal notes */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>处置备注</div>
              <Input.TextArea
                rows={4}
                placeholder="添加内部备注..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                type="link"
                icon={<EditOutlined />}
                style={{ marginTop: 8 }}
                onClick={() => message.info('备注已保存（演示）')}
              >
                保存备注
              </Button>
            </div>
          </Card>

          {/* Info card */}
          <Card title="位置信息" size="small">
            <div style={{
              height: 200,
              background: 'linear-gradient(135deg, #0a1628, #162850)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 13,
            }}>
              <div>📍 {inc.roadName}</div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                [{inc.position[0].toFixed(4)}, {inc.position[1].toFixed(4)}]
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
