// ===== 智途云枢 · 无障碍设施（平民端使用 / 管理端维护） =====
// 平民端负责使用（查询/展示/路线评价），管理端负责维护（CRUD）。
// 设施状态三态：verified(已确认) / unknown(待确认) / obstacle(存在障碍)。

export type FacilityStatus = 'verified' | 'unknown' | 'obstacle';

export interface FacilityEntrance {
  /** 入口 ID（后端返回，编辑/删除入口用） */
  id?: string;
  /** 入口标识，如 A口 / B口 */
  name: string;
  elevator: boolean;
  ramp: boolean;
  /** 该入口是否只能走楼梯（轮椅无法通过） */
  stairsOnly: boolean;
  wheelchairAccessible: boolean;
  status: FacilityStatus;
  /** 入口最近一次人工确认时间（ISO 字符串） */
  lastVerifiedAt?: string;
  /** 入口设施更新时间（ISO 字符串） */
  updatedAt?: string;
  /** 故障、绕行或核验备注 */
  note?: string;
}

export interface StationFacility {
  stationId: string;
  stationName: string;
  /** 站台坐标（GCJ-02），用于地图 ♿/🛗 标记 */
  lng: number;
  lat: number;
  entrances: FacilityEntrance[];
  /** 无障碍卫生间 */
  accessibleRestroom: boolean;
  /** demo = 前端演示数据；backend = 后端真实数据 */
  source: 'demo' | 'backend';
  /** 设施记录最后更新时间（ISO 字符串，后端缺失时为空） */
  updatedAt?: string;
  /** 最近一次人工确认时间（ISO 字符串，后端缺失时为空） */
  lastVerifiedAt?: string;
}

/** 管理端创建/更新站点请求 */
export interface UpsertStationFacilityRequest {
  stationName: string;
  lng: number;
  lat: number;
  accessibleRestroom?: boolean;
  entrances: FacilityEntrance[];
}
