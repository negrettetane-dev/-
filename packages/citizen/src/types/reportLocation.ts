// ===== 智途云枢 · 事件上报位置模型 =====
// 核心原则：把「设备当前位置」与「事件发生位置」分离。
//   - 自动定位成功后，仍允许用户手动修改为事件实际发生位置。
//   - 定位失败时允许手动/搜索选点提交，但标记 locationStatus 供审核。
// 坐标系统一 GCJ-02（高德），前后端/地图/存储一致。

export type ReportLocationType = 'auto' | 'manual' | 'search';
export type ReportLocationStatus = 'verified' | 'unverified' | 'failed';

/** 事件发生位置（用户确认/选择的最终位置） */
export interface ReportLocation {
  address: string;
  /** GCJ-02 经度 */
  longitude: number;
  /** GCJ-02 纬度 */
  latitude: number;
  /** auto=自动定位 manual=地图选点 search=搜索选点 */
  locationType: ReportLocationType;
  /** verified=已确认 unverified=未验证(无定位兜底) failed=定位失败 */
  locationStatus: ReportLocationStatus;
  /** 定位精度（米）；搜索/手动选点可能无 */
  accuracy?: number;
  /** 搜索选点时保存 POI 名称（如「长沙火车站」） */
  poiName?: string;
  /** 行政区划代码（区县级） */
  districtCode?: string;
  /** 城市名 */
  city?: string;
  /** 定位/选点时间 */
  locatedAt: string;
}

/** 设备原始定位（保留用于审核与追溯） */
export interface DeviceLocation {
  longitude: number;
  latitude: number;
  accuracy?: number;
  locatedAt: string;
}
