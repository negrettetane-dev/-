// ===== 定制公交：班次模板 / 班次实例 / 预约记录 三层契约 =====
// 三层分离原则：
//   1. 班次模板 (CustomBusTemplate)：长期存在的线路定义（每天何时发车/去哪/多少钱/多少座）
//   2. 班次实例 (CustomBusSchedule)：某一天的具体班车（预约的真实对象，独立 ID + 独立余座）
//   3. 预约记录 (CustomBusReservation)：用户 + 班次实例（含日期，取消时余座 +1）
// 前端不得伪造班次实例；所有实例由后端生成/返回，前端只消费。

/** 班次实例的预约状态（后端计算，前端只展示） */
export type CustomBusScheduleStatus =
  | 'NOT_OPEN'   // 尚未开放预约（超出开放周期）
  | 'AVAILABLE'  // 可预约
  | 'CLOSING'    // 即将截止（距截止 ≤ 阈值）
  | 'FULL'       // 已满（剩余 0）
  | 'CLOSED'     // 已停止预约（过了截止，未发车）
  | 'DEPARTED';  // 已发车

/** 第一层：班次模板（长期存在） */
export interface CustomBusTemplate {
  /** 线路模板 ID（如 cb-001） */
  templateId: string;
  from: string;
  to: string;
  boardingPointId: string;
  /** HH:mm */
  departTime: string;
  /** HH:mm */
  arriveTime: string;
  price: number;
  totalSeats: number;
  /** 早高峰通勤 / 晚高峰通勤 / 跨区通勤 */
  type: string;
  /** 开放周期（天）：可提前 N 天预约，含今天 */
  openDays: number;
}

/** 第二层：班次实例（某一天的具体班车，预约的真实对象） */
export interface CustomBusSchedule {
  /** 班次实例 ID（后端生成，预约时提交此 ID） */
  id: string;
  /** 关联的模板 ID */
  templateId: string;
  /** 线路/模板的稳定标识（后端用「模板+发车时间」生成，如 cb-001-0730） */
  scheduleId: string;
  from: string;
  to: string;
  boardingPointId: string;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** HH:mm */
  departTime: string;
  /** HH:mm */
  arriveTime: string;
  price: number;
  totalSeats: number;
  bookedSeats: number;
  remainingSeats: number;
  /** 早高峰通勤 / 晚高峰通勤 / 跨区通勤 */
  type: string;
  /** 后端计算的状态（前端不得自行推断） */
  status: CustomBusScheduleStatus;
  /** 截止时间戳（发车前 N 分钟），用于「即将截止」倒计时 */
  cutoffAt: number;
}

/** 第三层：预约记录 */
export interface CustomBusReservation {
  id: string;
  reservationNo: string;
  /** 班次实例 ID（预约绑定具体某天） */
  scheduleInstanceId: string;
  templateId: string;
  routeName: string;
  scheduleId: string;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** HH:mm */
  departureTime: string;
  boardingPoint: string;
  destination: string;
  price: number;
  passengerCount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'expired';
  createdAt: number;
}

/** 创建预约请求 */
export interface CreateCustomBusReservationRequest {
  /** 班次实例 ID（必须，不能是模板 ID） */
  scheduleInstanceId: string;
  passengerCount: number;
}

// ===== 长途客运购票记录（与定制公交预约合并展示，用 kind 区分） =====

/** 出行记录类型：reservation=定制公交预约，purchase=长途客运购票 */
export type TravelOrderKind = 'reservation' | 'purchase';

/** 长途客运购票记录 */
export interface LongDistancePurchase {
  id: string;
  purchaseNo: string;
  /** 购票记录类型（合并展示区分用） */
  kind: 'purchase';
  scheduleId: string;
  routeName: string;
  provider: string;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** HH:mm */
  departureTime: string;
  originStation: string;
  destinationStation: string;
  price: number;
  passengerCount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  createdAt: number;
}

/** 创建购票记录请求 */
export interface CreateLongDistancePurchaseRequest {
  scheduleId: string;
  date: string;
  passengerCount: number;
}

/** 按日期查班次实例的响应 */
export interface CustomBusSchedulesResponse {
  date: string;
  schedules: CustomBusSchedule[];
}
