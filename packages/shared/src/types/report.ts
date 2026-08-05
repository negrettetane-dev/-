// ===== 市民上报事件 =====

/** 上报分类 */
export type ReportCategory =
  | 'pothole'       // 路面坑洼
  | 'streetlight'   // 路灯损坏
  | 'illegal_park'  // 违停占道
  | 'manhole'       // 井盖破损
  | 'signal_fault'  // 信号灯故障
  | 'accident_clue' // 交通事故线索
  | 'barrier'       // 道路障碍
  | 'other';

export const REPORT_CATEGORIES: { value: ReportCategory; label: string; icon: string }[] = [
  { value: 'pothole', label: '路面坑洼', icon: '🕳️' },
  { value: 'streetlight', label: '路灯损坏', icon: '💡' },
  { value: 'illegal_park', label: '违停占道', icon: '🚗' },
  { value: 'manhole', label: '井盖破损', icon: '⭕' },
  { value: 'signal_fault', label: '信号灯故障', icon: '🚦' },
  { value: 'accident_clue', label: '事故线索', icon: '🚨' },
  { value: 'barrier', label: '道路障碍', icon: '🚧' },
  { value: 'other', label: '其他问题', icon: '📝' },
];

/** 工单状态 */
export type WorkOrderStatus = 'pending' | 'received' | 'processing' | 'completed' | 'rejected';

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  pending: '待受理',
  received: '已受理',
  processing: '处置中',
  completed: '已办结',
  rejected: '已驳回',
};

/** 市民上报 */
export interface CitizenReport {
  id: string;
  workOrderNo: string; // 工单编号
  category: ReportCategory;
  description: string;
  images: string[]; // 图片URL
  position: [number, number];
  address: string;
  contactPhone?: string;
  status: WorkOrderStatus;
  createTime: number;
  updateTime: number;
  processLogs: ProcessLog[];
  rating?: number; // 1-5 市民评分
  afterImage?: string; // 修复后对比图
}

/** 处理日志 */
export interface ProcessLog {
  time: number;
  action: string;
  operator: string;
  detail: string;
}
