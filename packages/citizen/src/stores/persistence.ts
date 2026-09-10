// ===== 智途云枢 · 平民端持久化数据层 =====
// 所有核心用户数据都在 localStorage 中持久化，
// 页面刷新不丢失。

const STORAGE_PREFIX = 'zhitu_';

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function set(key: string, value: unknown): void {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch { /* quota exceeded */ }
}

// ====== 类型定义 ======

export interface PersistedReport {
  id: string;
  workOrderNo: string;
  category: string;
  description: string;
  location: string;
  status: 'pending' | 'processing' | 'completed';
  createdAt: number;
  phone?: string;
}

export interface CarbonActivity {
  id: string;
  type: 'bus' | 'metro' | 'bike' | 'walk';
  date: string;
  distance: number;
  duration: number;
  carbonSaved: number;
  points: number;
  route?: string;
}

export interface PersistedUser {
  id: string;
  nickname: string;
  phone: string;
  isVerified: boolean;
  carbonCredits: number;
}

export interface NotificationSettings {
  congestion: boolean;
  weather: boolean;
  control: boolean;
  workorder: boolean;
  system: boolean;
}

// ====== 上报工单 ======

const REPORTS_KEY = 'reports';

export function getReports(userId = 'legacy'): PersistedReport[] {
  return get<PersistedReport[]>(userScopedKey(REPORTS_KEY, userId), []);
}

export function addReport(report: PersistedReport, userId = 'legacy'): void {
  const reports = getReports(userId);
  reports.unshift(report);
  set(userScopedKey(REPORTS_KEY, userId), reports);
}

export function updateReportStatus(id: string, status: PersistedReport['status'], userId = 'legacy'): void {
  const reports = getReports(userId);
  const r = reports.find(r => r.id === id);
  if (r) r.status = status;
  set(userScopedKey(REPORTS_KEY, userId), reports);
}

// ====== 碳积分 ======

const CARBON_KEY = 'carbon';

export function getCarbonStats() {
  return get(CARBON_KEY, {
    totalPoints: 0,
    totalCarbonSaved: 0,
    activities: [] as CarbonActivity[],
  });
}

export function addCarbonActivity(activity: CarbonActivity): void {
  const stats = getCarbonStats();
  stats.activities.unshift(activity);
  stats.totalPoints += activity.points;
  stats.totalCarbonSaved += activity.carbonSaved;
  set(CARBON_KEY, stats);
}

export interface CarbonReward {
  id: string; name: string; description: string; cost: number; stock: number; enabled?: boolean;
}

const DEFAULT_CARBON_REWARDS: CarbonReward[] = [
  { id: 'rw1', name: '公交9折优惠券', description: '乘坐公交享9折优惠，有效期30天', cost: 200, stock: 999, enabled: true },
  { id: 'rw2', name: '地铁5次免费卡', description: '地铁免费乘坐5次', cost: 500, stock: 500, enabled: true },
  { id: 'rw3', name: '共享单车月卡', description: '美团单车月卡，30天无限次', cost: 800, stock: 200, enabled: true },
  { id: 'rw4', name: '停车费抵扣券', description: '合作停车场5元抵扣券', cost: 150, stock: 1000, enabled: true },
];

export function getCarbonRewards(): CarbonReward[] {
  return get<CarbonReward[]>('carbon_rewards', DEFAULT_CARBON_REWARDS).filter(reward => reward.enabled !== false && reward.stock > 0);
}

export function redeemCarbonReward(rewardId: string): CarbonReward | null {
  const rewards = get<CarbonReward[]>('carbon_rewards', DEFAULT_CARBON_REWARDS);
  const reward = rewards.find(item => item.id === rewardId && item.enabled !== false && item.stock > 0);
  if (!reward) return null;
  reward.stock -= 1;
  set('carbon_rewards', rewards);
  return reward;
}

export interface CitizenCarbonConfig {
  carbonFactors: Record<string, number>;
  maxTripDistanceKm: number;
}

const DEFAULT_CARBON_CONFIG: CitizenCarbonConfig = {
  carbonFactors: { walk: 1, bike: 0.8, metro: 0.6, bus: 0.5, new_energy_vehicle: 0.2 },
  maxTripDistanceKm: 100,
};

export function getCarbonConfig(): CitizenCarbonConfig {
  const saved = get<Partial<CitizenCarbonConfig>>('carbon_config', {});
  return { ...DEFAULT_CARBON_CONFIG, ...saved, carbonFactors: { ...DEFAULT_CARBON_CONFIG.carbonFactors, ...(saved.carbonFactors || {}) } };
}

export interface CitizenPointRule { id: string; name: string; action: string; points: number; }
export function getPointRules(): CitizenPointRule[] {
  return get<CitizenPointRule[]>('point_rules', [
    { id: 'pr1', name: '公交出行', action: 'bus_ride', points: 5 }, { id: 'pr2', name: '地铁出行', action: 'metro_ride', points: 5 },
    { id: 'pr3', name: '骑行', action: 'bike_ride', points: 10 }, { id: 'pr4', name: '步行', action: 'walk', points: 10 },
    { id: 'pr5', name: '有效事件上报', action: 'valid_report', points: 20 }, { id: 'pr6', name: '每日签到', action: 'daily_checkin', points: 3 },
    { id: 'pr7', name: '新能源汽车出行', action: 'new_energy_vehicle_ride', points: 1 },
  ]);
}

// ====== 用户信息 ======

const USER_KEY = 'user_profile';

export function getPersistedUser(): PersistedUser | null {
  return get<PersistedUser | null>(USER_KEY, null);
}

export function setPersistedUser(user: PersistedUser): void {
  set(USER_KEY, user);
}

// ====== 用户账号体系（多账号登录：用户名/手机号/邮箱 + 密码） ======

export interface StoredAccount {
  id: string;
  username: string;
  phone: string;
  email: string;
  passwordHash: string; // 演示哈希，真实项目用 bcrypt/argon2
  nickname: string;
  avatar?: string;
  role: 'user' | 'admin';
  carbonCredits: number;
  createdAt: number;
}

const ACCOUNTS_KEY = 'user_accounts';

/** 简单确定性哈希（演示用，非安全哈希；真实项目必须用 bcrypt/argon2） */
export function hashPassword(password: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < password.length; i++) {
    const c = password.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  return `zhitu$${h1.toString(16)}${h2.toString(16)}`;
}

export function getAccounts(): StoredAccount[] {
  return get<StoredAccount[]>(ACCOUNTS_KEY, []);
}

function saveAccounts(list: StoredAccount[]): void {
  set(ACCOUNTS_KEY, list);
}

/** 按 用户名/手机号/邮箱 查找账号（一个 account 同时匹配三字段） */
export function findAccount(account: string): StoredAccount | null {
  const acc = account.trim().toLowerCase();
  if (!acc) return null;
  return getAccounts().find(a =>
    a.username.toLowerCase() === acc ||
    a.phone === account.trim() ||
    a.email.toLowerCase() === acc
  ) || null;
}

export function findAccountById(userId: string): StoredAccount | null {
  return getAccounts().find(account => account.id === userId) || null;
}

/** 注册新账号；返回错误码：username_exists / phone_exists / email_exists / null(成功) */
export function registerAccount(data: {
  username: string; phone: string; email: string;
  password: string; nickname: string;
}): { error?: 'username_exists' | 'phone_exists' | 'email_exists'; account?: StoredAccount } {
  const list = getAccounts();
  const username = data.username.trim();
  const phone = data.phone.trim();
  const email = data.email.trim().toLowerCase();

  if (list.some(a => a.username.toLowerCase() === username.toLowerCase())) return { error: 'username_exists' };
  if (list.some(a => a.phone === phone)) return { error: 'phone_exists' };
  if (email && list.some(a => a.email.toLowerCase() === email)) return { error: 'email_exists' };

  const account: StoredAccount = {
    id: 'u' + Date.now().toString(36),
    username,
    phone,
    email,
    passwordHash: hashPassword(data.password),
    nickname: data.nickname.trim() || username,
    role: 'user',
    carbonCredits: 0,
    createdAt: Date.now(),
  };
  saveAccounts([...list, account]);
  return { account };
}

// ====== 通知设置 ======
// 按用户作用域持久化（key: notification_settings:{userId}），未登录/旧数据回退到公共 key。

const NOTIF_KEY = 'notification_settings';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  congestion: true, weather: true, control: true, workorder: true, system: false,
};

/** 读取通知设置：优先当前用户的 scoped 数据，其次旧版公共数据，最后默认值 */
export function getNotificationSettings(userId = 'legacy'): NotificationSettings {
  const scoped = get<NotificationSettings | null>(userScopedKey(NOTIF_KEY, userId), null);
  if (scoped) return { ...DEFAULT_NOTIFICATION_SETTINGS, ...scoped };
  return get<NotificationSettings>(NOTIF_KEY, DEFAULT_NOTIFICATION_SETTINGS);
}

/** 写入通知设置（用户作用域） */
export function setNotificationSettings(s: NotificationSettings, userId = 'legacy'): void {
  set(userScopedKey(NOTIF_KEY, userId), s);
  // 兼容旧读取方：同步写一份公共 key（退出登录时会被清理）
  set(NOTIF_KEY, s);
}

// ====== 收藏公交 ======

const STARRED_KEY = 'starred_buses';

export function getStarredBuses(): string[] {
  return get<string[]>(STARRED_KEY, []);
}

export function toggleStarredBus(lineId: string): boolean {
  const starred = getStarredBuses();
  const idx = starred.indexOf(lineId);
  if (idx >= 0) { starred.splice(idx, 1); set(STARRED_KEY, starred); return false; }
  else { starred.push(lineId); set(STARRED_KEY, starred); return true; }
}

// ====== 积分余额 ======

const POINTS_KEY = 'user_points';

function userScopedKey(key: string, userId: string): string {
  return `${key}:${userId}`;
}

export function getUserPoints(userId = 'legacy'): number {
  const accountPoints = getAccounts().find(account => account.id === userId)?.carbonCredits ?? 0;
  return get<number>(userScopedKey(POINTS_KEY, userId), accountPoints);
}

/** 仅在"后端"调用 — 扣除积分（保证不出现负数） */
export function deductPoints(amount: number, userId = 'legacy'): { success: boolean; remaining: number } {
  const current = getUserPoints(userId);
  if (current < amount) return { success: false, remaining: current };
  const remaining = current - amount;
  set(userScopedKey(POINTS_KEY, userId), remaining);
  return { success: true, remaining };
}

/** 增加积分（事件上报奖励、绿色出行等） */
export function addPoints(amount: number, userId = 'legacy'): number {
  const current = getUserPoints(userId);
  const updated = current + amount;
  set(userScopedKey(POINTS_KEY, userId), updated);
  return updated;
}

// ====== 兑换记录 ======

export interface RedemptionRecord {
  id: string;
  user_id: string;
  reward_id: string | number;
  reward_name: string;
  points_cost: number;
  /** 后端可能返回中文状态或英文状态，也可能是任意未知值 */
  status: 'unused' | 'used' | 'expired' | '未使用' | '已使用' | '已过期' | string;
  redeemed_at: string | null;
  expires_at: string | null;
}

const REDEMPTIONS_KEY = 'redemptions';

export function getRedemptions(userId = 'legacy'): RedemptionRecord[] {
  return get<RedemptionRecord[]>(userScopedKey(REDEMPTIONS_KEY, userId), []);
}

export function addRedemption(r: RedemptionRecord, userId = 'legacy'): void {
  const records = getRedemptions(userId);
  records.unshift(r);
  set(userScopedKey(REDEMPTIONS_KEY, userId), records);
}

// ====== 最近目的地 ======

const RECENT_DEST_KEY = 'recent_destinations';

export function getRecentDestinations(): string[] {
  return get<string[]>(RECENT_DEST_KEY, []);
}

export function addRecentDestination(dest: string): void {
  if (!dest || dest === '我的位置' || dest.startsWith('经度')) return;
  const recents = getRecentDestinations().filter(d => d !== dest);
  recents.unshift(dest);
  set(RECENT_DEST_KEY, recents.slice(0, 8));
}

// ====== 清空所有 ======

export function clearAllData(): void {
  Object.keys(localStorage)
    .filter(k => k.startsWith(STORAGE_PREFIX))
    .forEach(k => localStorage.removeItem(k));
}

// ====== 退出登录：清理个人作用域缓存（防止 A/B 用户串号） ======
// 保留公共缓存（公交线路、新闻、停车场、地图等不走 localStorage 的公共数据）。
// 不删除 user_accounts 注册库。
const PERSONAL_KEYS = [
  'carbon',
  'notification_settings',
  'starred_buses',
  'recent_destinations',
  'process_records',
  'point_transactions',
];

/** 退出时清除所有个人作用域数据，公共数据不受影响 */
export function clearPersonalData(): void {
  PERSONAL_KEYS.forEach(key => {
    try { localStorage.removeItem(STORAGE_PREFIX + key); } catch { /* ignore */ }
  });
  // 通知设置为用户作用域 key（notification_settings:{userId}），需要前缀匹配清理
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX + 'notification_settings'))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
  try { localStorage.removeItem(STORAGE_PREFIX + USER_KEY); } catch { /* ignore */ }
}
