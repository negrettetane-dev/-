import type { FacilityEntrance, StationFacility } from '../types/accessibility';

type DemoEntrance = Readonly<FacilityEntrance>;
type DemoStation = Readonly<Omit<StationFacility, 'entrances'>> & {
  readonly entrances: readonly DemoEntrance[];
};

const station = (
  stationId: string,
  stationName: string,
  lng: number,
  lat: number,
  entrances: readonly DemoEntrance[],
  accessibleRestroom = false,
  lastVerifiedAt?: string,
  updatedAt?: string,
): DemoStation => ({
  stationId,
  stationName,
  lng,
  lat,
  entrances,
  accessibleRestroom,
  source: 'demo',
  lastVerifiedAt,
  updatedAt,
});

const DEMO_ACCESSIBILITY_SEED: readonly DemoStation[] = [
  station('bj_tiananmen_east', '天安门东', 116.404, 39.909, [
    { id: 'ent-1', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { id: 'ent-2', name: 'B口', elevator: false, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { id: 'ent-3', name: 'C口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle' },
  ], true),
  station('bj_wangfujing', '王府井', 116.410, 39.914, [
    { id: 'ent-4', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { id: 'ent-5', name: 'B口', elevator: true, ramp: false, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { id: 'ent-6', name: 'C口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'verified' },
  ], true),
  station('bj_xidan', '西单', 116.380, 39.913, [
    { id: 'ent-7', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { id: 'ent-8', name: 'B口', elevator: false, ramp: false, stairsOnly: false, wheelchairAccessible: true, status: 'unknown' },
    { id: 'ent-9', name: 'C口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle' },
  ]),
  station('bj_dongdan', '东单', 116.418, 39.909, [
    { id: 'ent-10', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { id: 'ent-11', name: 'B口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
  ], true),
  station('bj_beijing_station', '北京站', 116.433, 39.903, [
    { id: 'ent-12', name: '北广场入口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified', lastVerifiedAt: '2026-09-10T09:00:00+08:00', updatedAt: '2026-09-10T09:00:00+08:00', note: '推荐轮椅和婴儿车使用' },
    { id: 'ent-13', name: '南侧通道', elevator: false, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified', lastVerifiedAt: '2026-09-10T09:00:00+08:00', updatedAt: '2026-09-10T09:00:00+08:00' },
  ], true, '2026-09-10T09:00:00+08:00', '2026-09-10T09:00:00+08:00'),
  station('bj_xuanwumen', '宣武门', 116.374, 39.899, [
    { id: 'ent-14', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified', lastVerifiedAt: '2026-09-18T10:30:00+08:00', updatedAt: '2026-09-18T10:30:00+08:00', note: '推荐使用，电梯与坡道均已确认' },
    { id: 'ent-15', name: 'B口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle', lastVerifiedAt: '2026-09-18T10:30:00+08:00', updatedAt: '2026-09-18T10:30:00+08:00', note: '仅楼梯入口，轮椅和婴儿车请避开' },
    { id: 'ent-16', name: 'G口', elevator: true, ramp: false, stairsOnly: false, wheelchairAccessible: true, status: 'unknown', updatedAt: '2026-09-18T10:30:00+08:00', note: '电梯状态待现场复核' },
  ], false, '2026-09-18T10:30:00+08:00', '2026-09-18T10:30:00+08:00'),
  station('bj_beijing_south', '北京南站', 116.385, 39.863, [
    { id: 'ent-17', name: '北广场入口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified', lastVerifiedAt: '2026-09-16T14:20:00+08:00', updatedAt: '2026-09-16T14:20:00+08:00', note: '推荐进站入口，电梯直达站厅' },
    { id: 'ent-18', name: '东进站口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified', lastVerifiedAt: '2026-09-16T14:20:00+08:00', updatedAt: '2026-09-16T14:20:00+08:00' },
    { id: 'ent-19', name: '南侧地下通道', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle', lastVerifiedAt: '2026-09-16T14:20:00+08:00', updatedAt: '2026-09-16T14:20:00+08:00', note: '仅楼梯，已标记避开' },
  ], true, '2026-09-16T14:20:00+08:00', '2026-09-16T14:20:00+08:00'),
  station('bj_guomao', '国贸', 116.461, 39.909, [
    { id: 'ent-20', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { id: 'ent-21', name: 'C口', elevator: true, ramp: false, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { id: 'ent-22', name: 'D口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle' },
  ], true),
  station('bj_xizhimen', '西直门', 116.350, 39.940, [
    { id: 'ent-23', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { id: 'ent-24', name: 'B口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle' },
  ]),
  station('bj_fuxingmen', '复兴门', 116.360, 39.908, [
    { id: 'ent-25', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { id: 'ent-26', name: 'B口', elevator: false, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'unknown' },
  ]),
  station('bj_qianmen', '前门', 116.395, 39.899, [
    { id: 'ent-27', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    { id: 'ent-28', name: 'C口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'verified' },
  ]),
  station('bj_muxiyuan', '木樨园', 116.395, 39.862, [
    { id: 'ent-29', name: 'A口', elevator: false, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'unknown' },
  ]),
];

export function createDemoAccessibilityFacilities(): StationFacility[] {
  return DEMO_ACCESSIBILITY_SEED.map(item => ({
    ...item,
    entrances: item.entrances.map(entrance => ({ ...entrance })),
  }));
}
