// ===== 事件状态/严重程度 中英文映射（管理端统一常量） =====
// 后端仍使用英文枚举值，前端展示统一走中文 label。

export interface StatusMeta {
  value: string;
  label: string;
  color: string;
}

/** 事件状态枚举：pending/processing/resolved/closed */
export const INCIDENT_STATUS_OPTIONS: StatusMeta[] = [
  { value: 'pending', label: '待审核', color: 'orange' },
  { value: 'processing', label: '处理中', color: 'processing' },
  { value: 'resolved', label: '已完成', color: 'green' },
  { value: 'closed', label: '已关闭', color: 'default' },
];

const STATUS_INDEX = new Map(INCIDENT_STATUS_OPTIONS.map(item => [item.value, item]));

/** 根据英文枚举取中文 label，未知值原样返回 */
export function incidentStatusLabel(value: string | undefined | null): string {
  if (!value) return '-';
  return STATUS_INDEX.get(value)?.label ?? value;
}

/** 根据英文枚举取 Tag 颜色，未知值返回 default */
export function incidentStatusColor(value: string | undefined | null): string {
  return (value && STATUS_INDEX.get(value)?.color) || 'default';
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
