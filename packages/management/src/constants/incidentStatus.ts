// ===== 事件状态/严重程度 中英文映射（管理端统一常量） =====
// 后端仍使用英文枚举值，前端展示统一走中文 label。

export interface StatusMeta {
  value: string;
  label: string;
  color: string;
}

/** 事件状态（管理员可保存的状态，用于详情页下拉） */
export const INCIDENT_STATUS_OPTIONS: StatusMeta[] = [
  { value: 'pending', label: '待审核', color: 'warning' },
  { value: 'processing', label: '处理中', color: 'orange' },
  { value: 'resolved', label: '已完成', color: 'success' },
];

/** 完整状态映射（含后端可能返回的全部状态，用于列表展示与筛选） */
export const ALL_INCIDENT_STATUS_OPTIONS: StatusMeta[] = [
  { value: 'pending', label: '待审核', color: 'warning' },
  { value: 'received', label: '已受理', color: 'processing' },
  { value: 'processing', label: '处理中', color: 'orange' },
  { value: 'resolved', label: '已完成', color: 'success' },
  { value: 'rejected', label: '已驳回', color: 'error' },
  { value: 'closed', label: '已关闭', color: 'default' },
];

const STATUS_INDEX = new Map(ALL_INCIDENT_STATUS_OPTIONS.map(item => [item.value, item]));

const STATUS_ALIASES: Record<string, string> = {
  pending: 'pending',
  new: 'pending',
  '待审核': 'pending',
  received: 'received',
  dispatched: 'received',
  '已受理': 'received',
  processing: 'processing',
  '处理中': 'processing',
  resolved: 'resolved',
  completed: 'resolved',
  '已完成': 'resolved',
  '已解决': 'resolved',
  rejected: 'rejected',
  '已驳回': 'rejected',
  closed: 'closed',
  archived: 'closed',
  '已关闭': 'closed',
};

/** 将后端历史英文值、大小写值和中文值统一为管理端状态枚举 */
export function normalizeIncidentStatus(value: string | undefined | null): string {
  if (!value) return '';
  const normalizedValue = value.trim();
  return STATUS_ALIASES[normalizedValue] ?? STATUS_ALIASES[normalizedValue.toLowerCase()] ?? normalizedValue;
}

/** 根据英文枚举取中文 label，未知值原样返回 */
export function incidentStatusLabel(value: string | undefined | null): string {
  if (!value) return '-';
  return STATUS_INDEX.get(normalizeIncidentStatus(value))?.label ?? value;
}

/** 根据英文枚举取 Tag 颜色，未知值返回 default */
export function incidentStatusColor(value: string | undefined | null): string {
  return STATUS_INDEX.get(normalizeIncidentStatus(value))?.color || 'default';
}

/** 严重程度枚举：high/medium/low */
export const INCIDENT_SEVERITY_OPTIONS: StatusMeta[] = [
  { value: 'high', label: '严重', color: 'red' },
  { value: 'medium', label: '中等', color: 'orange' },
  { value: 'low', label: '轻微', color: 'green' },
];

const SEVERITY_INDEX = new Map(INCIDENT_SEVERITY_OPTIONS.map(item => [item.value, item]));

export function incidentSeverityLabel(value: string | undefined | null): string {
  if (!value) return '-';
  return SEVERITY_INDEX.get(value)?.label ?? value;
}

export function incidentSeverityColor(value: string | undefined | null): string {
  return (value && SEVERITY_INDEX.get(value)?.color) || 'default';
}
