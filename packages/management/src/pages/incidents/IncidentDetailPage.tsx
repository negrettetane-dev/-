import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, message, Select, Space, Tag, Input, Timeline, Image } from 'antd';
import { ApiError, apiGet, apiPut } from '../../services/apiClient';
import { uploadIncidentAfterImage } from '../../services/incidentAfterImageService';
import {
  INCIDENT_STATUS_OPTIONS,
  INCIDENT_SEVERITY_OPTIONS,
  incidentStatusLabel,
  incidentStatusColor,
  normalizeIncidentStatus,
  incidentSeverityLabel,
  incidentSeverityColor,
} from '../../constants/incidentStatus';

const MAX_AFTER_IMAGES = 6;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

const NEXT_STATUS: Record<string, string | undefined> = {
  pending: 'received',
  received: 'processing',
  processing: 'resolved',
  resolved: undefined,
};

function availableStatusOptions(currentStatus: string): Array<{ value: string; label: string; disabled?: boolean }> {
  const current = normalizeIncidentStatus(currentStatus);
  const next = NEXT_STATUS[current];
  return INCIDENT_STATUS_OPTIONS
    .filter(item => item.value === current || item.value === next)
    .map(item => ({ value: item.value, label: item.label }));
}

interface IncidentProcessLog {
  id?: string;
  time: number | string;
  action: string;
  operator: string;
  fromStatus?: string;
  toStatus?: string;
  detail?: string;
}

interface IncidentMedia {
  mediaId: string;
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
}

interface IncidentDetail {
  id: string;
  version?: number;
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
  afterImageMedia?: IncidentMedia[];
  afterImages?: string[];
  afterImage?: string;
  imageUrls?: string[];
  attachments?: Array<string | { url?: string; path?: string }>;
  media?: Array<string | { url?: string; path?: string }>;
  photos?: string[];
  accessibilityImpact?: boolean;
  platformFeedback?: string;
  feedback?: string;
  processLogs?: IncidentProcessLog[];
  [key: string]: unknown;
}

interface ExistingAfterImage {
  kind: 'existing';
  key: string;
  mediaId?: string;
  url: string;
  previewUrl: string;
  filename?: string;
}

interface LocalAfterImage {
  kind: 'local';
  key: string;
  file: File;
  previewUrl: string;
  uploadId?: string;
  uploadedUrl?: string;
  uploadStatus: 'local' | 'uploading' | 'uploaded' | 'error';
  error?: string;
}

type AfterImageDraft = ExistingAfterImage | LocalAfterImage;

function existingImages(incident: IncidentDetail): ExistingAfterImage[] {
  const media = Array.isArray(incident.afterImageMedia) ? incident.afterImageMedia : [];
  if (media.length) {
    return media.filter(item => item.url).map(item => ({
      kind: 'existing',
      key: `media:${item.mediaId}`,
      mediaId: item.mediaId,
      url: item.url,
      previewUrl: item.thumbnailUrl || item.url,
      filename: item.filename,
    }));
  }
  const urls = [...(incident.afterImages || []), ...(incident.afterImage ? [incident.afterImage] : [])];
  return [...new Set(urls.filter(Boolean))].map((url, index) => ({
    kind: 'existing',
    key: `legacy:${index}:${url}`,
    url,
    previewUrl: url,
  }));
}

const localFingerprint = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

export default function IncidentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const afterImagesRef = useRef<AfterImageDraft[]>([]);
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [department, setDepartment] = useState('');
  const [estimatedProcessTime, setEstimatedProcessTime] = useState('');
  const [afterImages, setAfterImages] = useState<AfterImageDraft[]>([]);

  useEffect(() => { afterImagesRef.current = afterImages; }, [afterImages]);
  useEffect(() => () => {
    afterImagesRef.current.forEach(item => { if (item.kind === 'local') URL.revokeObjectURL(item.previewUrl); });
  }, []);

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
      setAfterImages(current => {
        current.forEach(item => { if (item.kind === 'local') URL.revokeObjectURL(item.previewUrl); });
        return existingImages(result);
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '事件详情加载失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);

  const selectImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length) return;
    const existingLocalKeys = new Set(afterImages.filter((item): item is LocalAfterImage => item.kind === 'local').map(item => localFingerprint(item.file)));
    const accepted: File[] = [];
    for (const file of selected) {
      const typeAllowed = IMAGE_TYPES.has(file.type) || (!file.type && IMAGE_EXTENSIONS.test(file.name));
      if (!typeAllowed) { message.warning(`“${file.name}”格式不支持，仅支持 JPG、PNG、WebP`); continue; }
      if (file.size > MAX_IMAGE_BYTES) { message.warning(`“${file.name}”超过 10MB`); continue; }
      const fingerprint = localFingerprint(file);
      if (existingLocalKeys.has(fingerprint)) { message.warning(`“${file.name}”已选择`); continue; }
      if (afterImages.length + accepted.length >= MAX_AFTER_IMAGES) { message.warning(`处理后图片最多 ${MAX_AFTER_IMAGES} 张`); break; }
      existingLocalKeys.add(fingerprint);
      accepted.push(file);
    }
    if (!accepted.length) return;
    setAfterImages(current => [...current, ...accepted.map(file => ({
      kind: 'local' as const,
      key: `local:${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
      file,
      previewUrl: URL.createObjectURL(file),
      uploadStatus: 'local' as const,
    }))]);
  };

  const removeImage = (key: string) => {
    if (saving) return;
    setAfterImages(current => {
      const target = current.find(item => item.key === key);
      if (target?.kind === 'local') URL.revokeObjectURL(target.previewUrl);
      return current.filter(item => item.key !== key);
    });
  };

  const uploadNewImages = async (): Promise<AfterImageDraft[]> => {
    let working = [...afterImages];
    for (const item of working) {
      if (item.kind !== 'local' || item.uploadId) continue;
      working = working.map(candidate => candidate.key === item.key ? { ...candidate, uploadStatus: 'uploading', error: undefined } as LocalAfterImage : candidate);
      setAfterImages(working);
      try {
        const uploaded = await uploadIncidentAfterImage(id, item.file);
        working = working.map(candidate => candidate.key === item.key ? {
          ...candidate,
          uploadId: uploaded.uploadId,
          uploadedUrl: uploaded.url,
          uploadStatus: 'uploaded',
          error: undefined,
        } as LocalAfterImage : candidate);
        setAfterImages(working);
      } catch (error) {
        const reason = error instanceof Error ? error.message : '上传失败';
        working = working.map(candidate => candidate.key === item.key ? { ...candidate, uploadStatus: 'error', error: reason } as LocalAfterImage : candidate);
        setAfterImages(working);
        throw new Error(`“${item.file.name}”上传失败：${reason}`);
      }
    }
    return working;
  };

  const update = async () => {
    if (!status) { message.warning('请先选择事件状态'); return; }
    setSaving(true);
    try {
      const uploaded = await uploadNewImages();
      const retainedAfterImageIds = uploaded.flatMap(item => item.kind === 'existing' && item.mediaId ? [item.mediaId] : []);
      const retainedLegacyAfterImages = uploaded.flatMap(item => item.kind === 'existing' && !item.mediaId ? [item.url] : []);
      const afterImageUploadIds = uploaded.flatMap(item => item.kind === 'local' && item.uploadId ? [item.uploadId] : []);
      await apiPut(`/incidents/${id}`, {
        version: incident?.version,
        status,
        platformFeedback: feedback.trim(),
        department: department.trim(),
        estimatedProcessTime: estimatedProcessTime.trim(),
        retainedAfterImageIds,
        retainedLegacyAfterImages,
        afterImageUploadIds,
        notifyCitizen: true,
      });
      message.success('状态、处理信息与图片已保存，并已通知市民端');
      await load();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 409 || error.code === 'INCIDENT_VERSION_CONFLICT')) {
        message.error('事件已被其他管理员更新，请刷新详情后重新操作');
      } else {
        message.error(error instanceof Error ? error.message : '状态更新失败');
      }
    } finally { setSaving(false); }
  };

  if (!incident) return <div className="content-page"><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/incidents')}>返回列表</Button><div style={{ padding: 60, textAlign: 'center' }}>{loading ? '加载中...' : '未找到事件'}</div></div>;

  const imageList = (...groups: Array<unknown>): string[] => groups
    .flatMap(group => Array.isArray(group) ? group : [])
    .map(item => typeof item === 'string' ? item : (item && typeof item === 'object' ? String((item as { url?: string; path?: string }).url || (item as { url?: string; path?: string }).path || '') : ''))
    .filter(Boolean);
  const reportImages = imageList(incident.images, incident.imageUrls, incident.attachments, incident.media, incident.photos);
  const persistedAfterImages = imageList(incident.afterImageMedia, incident.afterImages, incident.afterImage ? [incident.afterImage] : []);

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
          {reportImages.length ? <Image.PreviewGroup>{reportImages.map((src, index) => <Image key={`${src}-${index}`} src={src} width={120} alt={`上报图片${index + 1}`} style={{ marginRight: 8 }} />)}</Image.PreviewGroup> : '暂无上报图片'}
        </Descriptions.Item>
        <Descriptions.Item label="处理后图片">
          {persistedAfterImages.length ? <Image.PreviewGroup>{persistedAfterImages.map((src, index) => <Image key={`${src}-${index}`} src={src} width={120} alt={`处理后图片${index + 1}`} style={{ marginRight: 8 }} />)}</Image.PreviewGroup> : '暂无处理后图片'}
        </Descriptions.Item>
      </Descriptions>
    </Card>

    <Card title="状态更新与平台反馈">
      <div style={{ marginBottom: 8 }}>事件状态</div>
      <Select value={status || undefined} onChange={setStatus} disabled={saving} style={{ width: 180 }} placeholder="请选择状态" options={incident?.status === 'closed' ? [{ value: 'closed', label: '已关闭（历史状态）', disabled: true }] : availableStatusOptions(String(incident?.status || ''))} />
      <Space direction="vertical" size={12} style={{ display: 'flex', marginTop: 16 }}>
        <label>受理部门<Input value={department} disabled={saving} onChange={e => setDepartment(e.target.value)} placeholder="例如：无障碍设施维护部门" /></label>
        <label>预计处理时间<Input value={estimatedProcessTime} disabled={saving} onChange={e => setEstimatedProcessTime(e.target.value)} placeholder="例如：预计 4 小时内完成处置" /></label>
        <div>
          <div style={{ marginBottom: 8 }}>处理后图片（{afterImages.length}/{MAX_AFTER_IMAGES}）</div>
          <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden onChange={selectImages} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {afterImages.map(item => (
              <div key={item.key} style={{ width: 128 }}>
                <div style={{ width: 128, height: 104, position: 'relative', border: item.kind === 'local' && item.uploadStatus === 'error' ? '1px solid #ff4d4f' : '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden', background: '#fafafa' }}>
                  <Image src={item.previewUrl} alt={item.kind === 'local' ? item.file.name : item.filename || '处理后图片'} width={128} height={104} style={{ objectFit: 'cover' }} preview />
                  <Button aria-label="移除图片" title="移除图片" icon={<DeleteOutlined />} danger size="small" disabled={saving} onClick={() => removeImage(item.key)} style={{ position: 'absolute', right: 4, top: 4, zIndex: 2 }} />
                </div>
                <div title={item.kind === 'local' ? item.file.name : item.filename || item.url} style={{ marginTop: 4, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.kind === 'local' ? item.file.name : item.filename || '已保存图片'}</div>
                {item.kind === 'local' && <div style={{ fontSize: 12, color: item.uploadStatus === 'error' ? '#ff4d4f' : '#8c8c8c' }}>{item.uploadStatus === 'uploading' ? '上传中…' : item.uploadStatus === 'uploaded' ? '已上传，待保存' : item.error || '待上传'}</div>}
              </div>
            ))}
            {afterImages.length < MAX_AFTER_IMAGES && <Button type="dashed" disabled={saving} icon={<PlusOutlined />} onClick={() => fileInputRef.current?.click()} style={{ width: 128, height: 104 }}>选择图片</Button>}
          </div>
          <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>支持 JPG、PNG、WebP，单张不超过 10MB，最多 {MAX_AFTER_IMAGES} 张；点击保存后上传并绑定到当前事件。</div>
        </div>
      </Space>
      <div style={{ marginTop: 16, marginBottom: 8 }}>平台反馈（市民端可见）</div>
      <Input.TextArea rows={3} value={feedback} disabled={saving} onChange={e => setFeedback(e.target.value)} placeholder="填写处理结果、预计恢复时间或注意事项，将与状态一起同步到市民端" maxLength={500} showCount />
      <div style={{ marginTop: 16 }}>
        <Button type="primary" loading={saving} onClick={() => void update()}>保存状态与处理信息</Button>
        <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>保存后将同步更新市民端工单状态，并向市民推送进度通知</span>
      </div>
    </Card>
    <Card title="处理历史记录" style={{ marginTop: 16 }}>
      {incident.processLogs && incident.processLogs.length > 0 ? (
        <Timeline items={[...incident.processLogs].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()).map(log => ({
          color: log.fromStatus && log.toStatus ? 'blue' : 'gray',
          children: <div><div style={{ fontWeight: 600 }}>{log.action}</div><div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>{log.operator}{log.fromStatus && log.toStatus ? ` · ${incidentStatusLabel(log.fromStatus)} → ${incidentStatusLabel(log.toStatus)}` : ''}{log.detail ? ` · ${log.detail}` : ''}</div><div style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12 }}>{new Date(log.time).toLocaleString('zh-CN')}</div></div>,
        }))} />
      ) : <div style={{ color: '#999' }}>暂无处理记录</div>}
    </Card>
  </div>;
}
