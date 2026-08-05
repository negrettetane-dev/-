import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Select,
  Timeline,
  Input,
  message,
  Spin,
  Row,
  Col,
  Image,
  Modal,
  Rate,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useWorkOrderStore } from '../../stores/workOrderStore';

const { TextArea } = Input;
const { Text } = Typography;

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待受理' },
  received: { color: 'processing', label: '已受理' },
  processing: { color: 'orange', label: '处置中' },
  completed: { color: 'success', label: '已办结' },
  rejected: { color: 'error', label: '已驳回' },
};

const CATEGORY_MAP: Record<string, string> = {
  pothole: '路面坑洼',
  streetlight: '路灯损坏',
  illegal_park: '违停占道',
  manhole: '井盖破损',
  signal_fault: '信号灯故障',
  accident_clue: '交通事故线索',
  barrier: '道路障碍',
  other: '其他问题',
};

const DEPARTMENTS = [
  '市政维护一处', '市政维护二处', '路灯管理处', '交警大队',
  '城管执法队', '路桥维护中心', '通信管线维护',
];

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedWorkOrder, loading, fetchById, updateStatus } = useWorkOrderStore();
  const [assignDept, setAssignDept] = useState('');
  const [internalNote, setInternalNote] = useState('');

  useEffect(() => {
    if (id) fetchById(id);
  }, [id, fetchById]);

  const handleAccept = async () => {
    await updateStatus(id!, 'received');
    message.success('工单已受理');
    if (id) fetchById(id);
  };

  const handleDispatch = async () => {
    if (!assignDept) {
      message.warning('请选择处置部门');
      return;
    }
    await updateStatus(id!, 'processing');
    message.success(`已派发至 ${assignDept}`);
    if (id) fetchById(id);
  };

  const handleComplete = async () => {
    Modal.confirm({
      title: '确认办结',
      content: '确认该工单处置完成？',
      onOk: async () => {
        await updateStatus(id!, 'completed');
        message.success('工单已办结');
        if (id) fetchById(id);
      },
    });
  };

  const handleReject = async () => {
    Modal.confirm({
      title: '驳回工单',
      content: (
        <div>
          <Text>请输入驳回原因：</Text>
          <TextArea rows={2} placeholder="驳回原因..." />
        </div>
      ),
      onOk: async () => {
        await updateStatus(id!, 'rejected');
        message.success('工单已驳回');
        if (id) fetchById(id);
      },
    });
  };

  if (loading || !selectedWorkOrder) {
    return (
      <div className="content-page flex-center">
        <Spin size="large" />
      </div>
    );
  }

  const wo = selectedWorkOrder;
  const statusInfo = STATUS_MAP[wo.status];

  return (
    <div className="content-page">
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/workorders')}>
          返回列表
        </Button>
      </div>

      <div className="page-header">
        <h2>工单详情 - {wo.workOrderNo}</h2>
        <Space>
          <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
          <Tag>{CATEGORY_MAP[wo.category]}</Tag>
          {wo.rating && (
            <span>
              <Rate disabled value={wo.rating} style={{ fontSize: 14 }} />
            </span>
          )}
        </Space>
      </div>

      <Row gutter={16}>
        {/* Left: Details */}
        <Col span={16}>
          <Card title="上报信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="工单编号">{wo.workOrderNo}</Descriptions.Item>
              <Descriptions.Item label="问题分类">
                {CATEGORY_MAP[wo.category]}
              </Descriptions.Item>
              <Descriptions.Item label="上报人">{wo.reporterName || '匿名'}</Descriptions.Item>
              <Descriptions.Item label="联系电话">
                {wo.contactPhone || '未提供'}
              </Descriptions.Item>
              <Descriptions.Item label="上报时间">
                {new Date(wo.createTime).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="最后更新">
                {new Date(wo.updateTime).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="发生地址" span={2}>
                {wo.address}
              </Descriptions.Item>
              <Descriptions.Item label="GPS坐标" span={2}>
                [{wo.position[0].toFixed(6)}, {wo.position[1].toFixed(6)}]
              </Descriptions.Item>
              <Descriptions.Item label="问题描述" span={2}>
                {wo.description}
              </Descriptions.Item>
            </Descriptions>

            {wo.images.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>现场照片</div>
                <Image.PreviewGroup>
                  {wo.images.map((img, idx) => (
                    <Image key={idx} src={img} width={200} style={{ marginRight: 8 }} fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjE0Ij7kuI3lj6/nlKjnmoTlm77niYc8L3RleHQ+PC9zdmc+" />
                  ))}
                </Image.PreviewGroup>
              </div>
            )}
          </Card>

          <Card title="处理时间线">
            <Timeline
              items={wo.processLogs.map((log) => ({
                children: (
                  <div>
                    <div style={{ fontWeight: 600 }}>{log.action}</div>
                    <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>
                      {log.operator} · {log.detail}
                    </div>
                    <div style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12 }}>
                      {new Date(log.time).toLocaleString('zh-CN')}
                    </div>
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>

        {/* Right: Actions */}
        <Col span={8}>
          <Card title="处置操作" style={{ marginBottom: 16 }}>
            {wo.status === 'pending' && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  block
                  onClick={handleAccept}
                >
                  受理工单
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  block
                  onClick={handleReject}
                >
                  驳回工单
                </Button>
              </Space>
            )}

            {wo.status === 'received' && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>派发处置</div>
                <Select
                  placeholder="选择处置部门"
                  style={{ width: '100%', marginBottom: 12 }}
                  value={assignDept || undefined}
                  onChange={setAssignDept}
                  options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                />
                <Button type="primary" icon={<SendOutlined />} block onClick={handleDispatch}>
                  派发处置
                </Button>
              </div>
            )}

            {wo.status === 'processing' && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary">正在处置中...</Text>
                </div>
                <Button
                  icon={<CheckCircleOutlined />}
                  style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
                  block
                  onClick={handleComplete}
                >
                  标记办结
                </Button>
              </div>
            )}

            {wo.status === 'completed' && (
              <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.45)' }}>
                <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
                <div>该工单已办结</div>
                {wo.rating && (
                  <div style={{ marginTop: 8 }}>
                    <Text>市民评价：</Text>
                    <Rate disabled value={wo.rating} style={{ fontSize: 16 }} />
                  </div>
                )}
              </div>
            )}

            {wo.status === 'rejected' && (
              <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.45)' }}>
                <CloseCircleOutlined style={{ fontSize: 32, color: '#f5222d', marginBottom: 8 }} />
                <div>该工单已被驳回</div>
              </div>
            )}
          </Card>

          <Card title="内部备注" size="small">
            <TextArea
              rows={5}
              placeholder="添加内部备注..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
            />
            <Button
              type="link"
              style={{ marginTop: 8 }}
              onClick={() => message.info('备注已保存（演示）')}
            >
              保存备注
            </Button>
          </Card>

          <Card title="位置信息" size="small" style={{ marginTop: 16 }}>
            <div
              style={{
                height: 180,
                background: 'linear-gradient(135deg, #0a1628, #162850)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 13,
              }}
            >
              <div>📍 {wo.address}</div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                [{wo.position[0].toFixed(6)}, {wo.position[1].toFixed(6)}]
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
