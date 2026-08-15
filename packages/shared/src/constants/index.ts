// ===== 应用配置常量 =====

/** 城市中心坐标（本项目为北京） */
export const CITY_CENTER: [number, number] = [116.397, 39.909];

/** 默认地图缩放级别 */
export const DEFAULT_MAP_ZOOM = 13;

/** 地图最大/最小缩放 */
export const MAP_ZOOM_RANGE: [number, number] = [10, 18];

/** API 基础路径 */
export const API_BASE_URL = '/api';

/** 轮询间隔 (毫秒) */
export const POLL_INTERVALS = {
  traffic: 30000,    // 路况 30s
  bus: 10000,        // 公交 10s
  parking: 60000,    // 停车位 60s
  alerts: 15000,     // 预警 15s
};

/** 存储键 */
export const STORAGE_KEYS = {
  token: 'zhitu_token',
  user: 'zhitu_user',
  elderMode: 'zhitu_elder_mode',
  history: 'zhitu_search_history',
  settings: 'zhitu_settings',
};

/** 功能开关 */
export const FEATURES = {
  aiAssistant: true,
  customBus: true,
  carbonCredits: true,
  voiceInput: true,
  contactlessPay: true,
  nfcTransit: false, // 需要硬件支持
};
