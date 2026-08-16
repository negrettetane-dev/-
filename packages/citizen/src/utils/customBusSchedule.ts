// ===== 智途云枢 · 定制公交班次生成与状态机 =====
// 数据真实性边界：
//   - 线路模板（线路/发车/到达/价格/基础座位）为演示数据，可继续使用。
//   - 班次按「日期 + 模板」生成：同一线路每天一班，座位数按日期确定性生成（演示），
//     不同日期互相独立，不会因为某天预约而扣掉其他日期座位。
//   - 每个班次独立计算预约状态：未开放 → 可预约 → 即将截止 → 已满 → 已停止预约 → 已发车。
//   - 预约截止规则：发车前 CUTOFF_MINUTES 分钟停止预约（默认 30，可配置，不写死在前端硬编码业务语义之外）。

export interface CustomBusTemplate {
  /** 线路模板 ID（用于预约，scheduleId 由模板+日期拼出） */
  templateId: string;
  from: string;
  to: string;
  boardingPointId: string;
  /** HH:mm */
  departTime: string;
  /** HH:mm */
  arriveTime: string;
  price: number;
  /** 基础座位数（演示：每日实际座位由此确定性生成） */
  baseSeats: number;
  type: string;
}

/** 预约截止窗口（分钟）：发车前 N 分钟停止预约。以后可由管理员配置。 */
export const CUTOFF_MINUTES = 30;
/** 可提前预约天数（含今天）：超过该天数显示「尚未开放预约」 */
export const OPEN_WINDOW_DAYS = 7;

export type BusStatus =
  | 'not-open'       // 尚未开放预约（超出开放周期）
  | 'available'      // 可预约
  | 'closing-soon'   // 即将截止（距截止 ≤ CLOSING_SOON_MINUTES）
  | 'full'           // 已满（余座 0）
  | 'closed'         // 已停止预约（过了截止，未发车）
  | 'departed';      // 已发车

/** 「即将截止」提醒阈值（分钟）：距停止预约 ≤ 该值显示「即将截止」 */
export const CLOSING_SOON_MINUTES = 30;

/** 某日某班次的具体实例（一个可预约/可查看单元） */
export interface CustomBusInstance {
  id: string;
  templateId: string;
  scheduleId: string;
  from: string;
  to: string;
  boardingPointId: string;
  /** 日期，YYYY-MM-DD */
  date: string;
  departTime: string;
  arriveTime: string;
  price: number;
  seats: number;
  type: string;
}

export const CUSTOM_BUS_TEMPLATES: CustomBusTemplate[] = [
  { templateId: 'cb-001', from: '回龙观', to: '中关村', boardingPointId: 'stop-hlg', departTime: '07:30', arriveTime: '08:30', price: 8, baseSeats: 12, type: '早高峰通勤' },
  { templateId: 'cb-002', from: '天通苑', to: '国贸 CBD', boardingPointId: 'stop-tty', departTime: '07:00', arriveTime: '08:15', price: 12, baseSeats: 5, type: '早高峰通勤' },
  { templateId: 'cb-003', from: '通州北苑', to: '建国门', boardingPointId: 'stop-tzby', departTime: '07:15', arriveTime: '08:10', price: 10, baseSeats: 18, type: '早高峰通勤' },
  { templateId: 'cb-004', from: '中关村', to: '回龙观', boardingPointId: 'stop-zgc', departTime: '18:00', arriveTime: '18:55', price: 8, baseSeats: 20, type: '晚高峰通勤' },
  { templateId: 'cb-005', from: '国贸 CBD', to: '天通苑', boardingPointId: 'stop-gm', departTime: '18:30', arriveTime: '19:40', price: 12, baseSeats: 3, type: '晚高峰通勤' },
  { templateId: 'cb-006', from: '亦庄', to: '西二旗', boardingPointId: 'stop-yz', departTime: '07:45', arriveTime: '09:00', price: 15, baseSeats: 8, type: '跨区通勤' },
];

/** 日期工具：YYYY-MM-DD */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** 确定性 hash（djb2）：用于每日座位数生成，避免固定数字、不同日期互不相同 */
function hashStr(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 某日某模板的演示座位数：baseSeats 上下浮动 0~4（确定性，随日期变化） */
export function seatsFor(template: CustomBusTemplate, date: string): number {
  const delta = hashStr(`${template.templateId}:${date}`) % 5;
  return Math.max(0, template.baseSeats + delta);
}

/** 生成某一天的班次实例列表 */
export function instancesForDate(base: Date, date: Date): CustomBusInstance[] {
  const dateStr = toDateStr(date);
  return CUSTOM_BUS_TEMPLATES.map(template => ({
    id: `${template.templateId}-${dateStr}`,
    templateId: template.templateId,
    scheduleId: `${template.templateId}-${dateStr.replace(/-/g, '')}`,
    from: template.from,
    to: template.to,
    boardingPointId: template.boardingPointId,
    date: dateStr,
    departTime: template.departTime,
    arriveTime: template.arriveTime,
    price: template.price,
    seats: seatsFor(template, dateStr),
    type: template.type,
  }));
}

/** 解析 HH:mm → 当天 Date */
function parseTime(dateStr: string, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** 计算单个班次的预约状态（以 now 为基准，独立判断，不互相影响） */
export function computeBusStatus(instance: CustomBusInstance, now: Date): BusStatus {
  const depart = parseTime(instance.date, instance.departTime);
  const cutoff = new Date(depart.getTime() - CUTOFF_MINUTES * 60 * 1000);

  // 超出开放周期：尚未开放
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const maxOpen = new Date(todayStart);
  maxOpen.setDate(maxOpen.getDate() + (OPEN_WINDOW_DAYS - 1));
  if (depart.getTime() > maxOpen.getTime() + 24 * 60 * 60 * 1000 - 1) {
    return 'not-open';
  }

  // 已发车
  if (now.getTime() >= depart.getTime()) return 'departed';
  // 已停止预约（过了截止，未发车）
  if (now.getTime() >= cutoff.getTime()) return 'closed';
  // 已满
  if (instance.seats <= 0) return 'full';
  // 即将截止
  const closingSoonMs = CLOSING_SOON_MINUTES * 60 * 1000;
  if (cutoff.getTime() - now.getTime() <= closingSoonMs) return 'closing-soon';
  return 'available';
}

export interface BusStatusMeta {
  label: string;
  className: string;
}

export const BUS_STATUS_META: Record<BusStatus, BusStatusMeta> = {
  'not-open': { label: '尚未开放', className: 'stNotOpen' },
  available: { label: '可预约', className: 'stAvailable' },
  'closing-soon': { label: '即将截止', className: 'stClosing' },
  full: { label: '已满', className: 'stFull' },
  closed: { label: '已停止预约', className: 'stClosed' },
  departed: { label: '已发车', className: 'stDeparted' },
};

/** 截止时间标签：HH:mm 停止预约 */
export function cutoffTimeLabel(instance: CustomBusInstance): string {
  const depart = parseTime(instance.date, instance.departTime);
  const cutoff = new Date(depart.getTime() - CUTOFF_MINUTES * 60 * 1000);
  const h = String(cutoff.getHours()).padStart(2, '0');
  const m = String(cutoff.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** 距离停止预约剩余分钟数 */
export function minutesToCutoff(instance: CustomBusInstance, now: Date): number {
  const depart = parseTime(instance.date, instance.departTime);
  const cutoff = new Date(depart.getTime() - CUTOFF_MINUTES * 60 * 1000);
  return Math.max(0, Math.round((cutoff.getTime() - now.getTime()) / 60000));
}

/** 班次排序：可预约 → 即将截止 → 已满 → 已停止 → 已发车 → 尚未开放；同类按发车时间 */
export function sortInstances(instances: CustomBusInstance[], now: Date): CustomBusInstance[] {
  const rank: Record<BusStatus, number> = {
    available: 0,
    'closing-soon': 1,
    full: 2,
    closed: 3,
    departed: 4,
    'not-open': 5,
  };
  return [...instances].sort((a, b) => {
    const ra = rank[computeBusStatus(a, now)];
    const rb = rank[computeBusStatus(b, now)];
    if (ra !== rb) return ra - rb;
    return a.departTime.localeCompare(b.departTime);
  });
}

/** 某天是否存在可预约/即将截止的班次 */
export function hasBookable(instances: CustomBusInstance[], now: Date): boolean {
  return instances.some(i => {
    const s = computeBusStatus(i, now);
    return s === 'available' || s === 'closing-soon';
  });
}
