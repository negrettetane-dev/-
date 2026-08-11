import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Badge, Timeline, Button, Space, Select, Input, message, Row, Col, Modal } from 'antd';
import { ArrowLeftOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { getReportById, updateReportStatus, getProcessRecords, addProcessRecord, adjustUserPoints, addOperationLog } from '../../stores/adminPersistence';
import type { Report, ProcessRecord } from '../../stores/adminPersistence';

const STATUS_FLOW: Record<string, string[]> = { pending: ['received', 'rejected'], received: ['processing', 'rejected'], processing: ['completed'], completed: [], rejected: [] };
const STATUS_LABELS: Record<string, { label: string; color: string }> = { pending: { label: '待审核', color: 'orange' }, received: { label: '已受理', color: 'blue' }, processing: { label: '处理中', color: 'processing' }, completed: { label: '已完成', color: 'green' }, rejected: { label: '已驳回', color: 'red' } };
const ASSIGNEES = ['交警东城支队', '市政工程处', '路桥维护中心', '信号控制中心', '海淀区交管局', '朝阳区城管局'];

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [records, setRecords] = useState<ProcessRecord[]>([]);
  const [note, setNote] = useState('');
  const [targetStatus, setTargetStatus] = useState('');
  const [assignee, setAssignee] = useState('');

  const load = () => {
    const r = getReportById(id || '');
    setReport(r); setRecords(getProcessRecords(id));
  };
  useEffect(() => { if (id) load(); }, [id]);

  const handleAction = () => {
    if (!report || !targetStatus) { message.warning('请选择目标状态'); return; }
    if (targetStatus === 'processing' && !assignee) { message.warning('请选择分派单位'); return; }
    Modal.confirm({
      title: '确认操作', content: `确定将事件从「${STATUS_LABELS[report.status]?.label}」变更为「${STATUS_LABELS[targetStatus]?.label}」吗？`,
      onOk: () => {
        updateReportStatus(report.id, targetStatus as Report['status']);
        addProcessRecord({ id: 'pr_'+Date.now().toString(36), reportId: report.id, action: '状态变更', operator: '管理员', fromStatus: report.status, toStatus: targetStatus, note, time: Date.now() });
        addOperationLog({ id: 'l_'+Date.now().toString(36), operator: '管理员', module: '事件管理', action: '状态变更', target: report.workOrderNo, detail: `${report.status}→${targetStatus} ${assignee} ${note}`, ip: '127.0.0.1', time: Date.now() });
        if (targetStatus === 'completed') {
          adjustUserPoints('u1', 20, `有效事件上报奖励（工单${report.workOrderNo}）`, '系统');
          addOperationLog({ id: 'l_'+Date.now().toString(36)+'_pt', operator: '系统', module: '积分管理', action: '积分发放', target: 'u1', detail: `+20积分（事件完成，工单${report.workOrderNo}）`, ip: '127.0.0.1', time: Date.now() });
          message.success('事件已完成，已发放20碳积分');
        } else message.success(`状态已变更为「${STATUS_LABELS[targetStatus]?.label}」`);
        setNote(''); setTargetStatus(''); setAssignee(''); load();
      }
    });
  };

  if (!report) return <div className="content-page"><div style={{ textAlign: 'center', padding: 60 }}>工单不存在或暂未同步</div></div>;
  const st = STATUS_LABELS[report.status] || { label: report.status, color: 'default' };
  const nextStatuses = STATUS_FLOW[report.status] || [];

  return (
    <div className="content-page">
      <div style={{ marginBottom: 16 }}><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/incidents')}>返回列表</Button></div>
      <div className="page-header"><h2>事件详情 - {report.workOrderNo}</h2></div>
      <Row gutter={16}>
        <Col span={16}>
          <Card title="基本信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="工单编号">{report.workOrderNo}</Descriptions.Item>
              <Descriptions.Item label="状态"><Badge status={st.color as any} text={st.label} /></Descriptions.Item>
              <Descriptions.Item label="类型">{report.category}</Descriptions.Item>
              <Descriptions.Item label="位置">{report.location}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{report.description}</Descriptions.Item>
              <Descriptions.Item label="上报时间" span={2}>{new Date(report.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
              {report.phone && <Descriptions.Item label="联系电话">{report.phone}</Descriptions.Item>}
            </Descriptions>
          </Card>
          <Card title="处理记录">
            {records.length === 0 ? <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无处理记录</div> : (
              <Timeline items={records.map(r => ({ color: r.toStatus === 'completed' ? 'green' : r.toStatus === 'rejected' ? 'red' : 'blue',
                children: <div><div style={{ fontWeight: 600 }}>{STATUS_LABELS[r.fromStatus]?.label} → {STATUS_LABELS[r.toStatus]?.label}</div><div style={{ color: '#666', fontSize: 13 }}>{r.note || r.action}</div><div style={{ color: '#999', fontSize: 11 }}>{new Date(r.time).toLocaleString('zh-CN')} · {r.operator}</div></div>
              }))} />
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="处置操作">
            {nextStatuses.length > 0 ? (<>
              <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 600, marginBottom: 6 }}>目标状态</div><Select placeholder="选择目标状态" style={{ width: '100%' }} value={targetStatus || undefined} onChange={setTargetStatus} options={nextStatuses.map(s => ({ value: s, label: STATUS_LABELS[s]?.label || s }))} /></div>
              {targetStatus === 'processing' && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 600, marginBottom: 6 }}>分派处置单位</div><Select placeholder="选择处置单位" style={{ width: '100%' }} value={assignee || undefined} onChange={setAssignee} options={ASSIGNEES.map(a => ({ value: a, label: a }))} /></div>}
              <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 600, marginBottom: 6 }}>处理备注</div><Input.TextArea rows={3} placeholder="填写处理说明..." value={note} onChange={e => setNote(e.target.value)} /></div>
              <Space direction="vertical" style={{ width: '100%' }}>
                {targetStatus === 'received' ? <Button type="primary" icon={<CheckCircleOutlined />} block onClick={handleAction}>受理事件</Button> :
                 targetStatus === 'rejected' ? <Button danger icon={<CloseCircleOutlined />} block onClick={handleAction}>驳回事件</Button> :
                 targetStatus === 'processing' ? <Button type="primary" icon={<SendOutlined />} block onClick={handleAction}>分派并开始处理</Button> :
                 <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} icon={<CheckCircleOutlined />} block onClick={handleAction}>标记已完成（发放积分）</Button>}
              </Space>
            </>) : <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>{report.status === 'completed' ? '✅ 该事件已完成处置' : '该状态不可再操作'}</div>}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
