// ===== 智途云枢 · 无障碍设施数据（MVP 演示区域） =====
// 数据真实性边界：
//   - 当前为前端演示数据，明确标注 source: 'demo'，仅覆盖典型站点（天安门东/王府井/西单/东单/北京站等）。
//   - 设施状态三态：verified(已确认) / unknown(待确认) / obstacle(存在障碍)。
//   - 系统不会在数据不足时伪造「全程无障碍」——未收录站点在评分中计为「设施信息待确认」。
//   - 后续接入管理端「无障碍设施管理」后，此文件由后台数据替换。

export type FacilityStatus = 'verified' | 'unknown' | 'obstacle';

export interface FacilityEntrance {
  /** 入口标识，如 A口 / B口 */
  name: string;
  elevator: boolean;
  ramp: boolean;
  /** 该入口是否只能走楼梯（轮椅无法通过） */
  stairsOnly: boolean;
  wheelchairAccessible: boolean;
  status: FacilityStatus;
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
  source: 'demo';
}

const station = (
  stationId: string,
  stationName: string,
  lng: number,
  lat: number,
  entrances: FacilityEntrance[],
  accessibleRestroom = false,
): StationFacility => ({ stationId, stationName, lng, lat, entrances, accessibleRestroom, source: 'demo' });

export const ACCESSIBLE_FACILITIES: StationFacility[] = [
  station('bj_tiananmen_east', '天安门东', 116.404, 39.909, [
    { name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: 'B口', elevator: false, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: 'C口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle' },
  ], true),

  station('bj_wangfujing', '王府井', 116.410, 39.914, [
    { name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: 'B口', elevator: true, ramp: false, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: 'C口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'verified' },
  ], true),

  station('bj_xidan', '西单', 116.380, 39.913, [
    { name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: 'B口', elevator: false, ramp: false, stairsOnly: false, wheelchairAccessible: true, status: 'unknown' },
    { name: 'C口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle' },
  ], false),

  station('bj_dongdan', '东单', 116.418, 39.909, [
    { name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: 'B口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
  ], true),

  station('bj_beijing_station', '北京站', 116.433, 39.903, [
    { name: '北广场入口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: '南侧通道', elevator: false, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
  ], true),

  station('bj_guomao', '国贸', 116.461, 39.909, [
    { name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: 'C口', elevator: true, ramp: false, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: 'D口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle' },
  ], true),

  station('bj_xizhimen', '西直门', 116.350, 39.940, [
    { name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: 'B口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle' },
  ], false),

  station('bj_fuxingmen', '复兴门', 116.360, 39.908, [
    { name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: 'B口', elevator: false, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'unknown' },
  ], false),

  station('bj_qianmen', '前门', 116.395, 39.899, [
    { name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { name: 'C口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'verified' },
  ], false),

  station('bj_muxiyuan', '木樨园', 116.395, 39.862, [
    { name: 'A口', elevator: false, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'unknown' },
  ], false),
];

const FACILITY_MAP = new Map(ACCESSIBLE_FACILITIES.map(f => [normalizeFacilityName(f.stationName), f]));

/** 站名归一化（去除 站/枢纽 后缀、括号、空格），用于与高德返回站点名模糊匹配 */
export function normalizeFacilityName(name: string): string {
  return String(name || '')
    .replace(/[（）()\s·]/g, '')
    .replace(/公交枢纽站?|公交场站|枢纽站|总站|车站|站$/g, '');
}

/** 按站名查无障碍设施；未收录返回 null（视为「设施信息待确认」） */
export function getFacilityForStation(stationName: string): StationFacility | null {
  if (!stationName) return null;
  return FACILITY_MAP.get(normalizeFacilityName(stationName)) ?? null;
}
