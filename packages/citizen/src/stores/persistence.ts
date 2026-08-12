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

export function getReports(): PersistedReport[] {
  return get<PersistedReport[]>(REPORTS_KEY, []);
}

export function addReport(report: PersistedReport): void {
  const reports = getReports();
  reports.unshift(report);
  set(REPORTS_KEY, reports);
}

export function updateReportStatus(id: string, status: PersistedReport['status']): void {
  const reports = getReports();
  const r = reports.find(r => r.id === id);
  if (r) r.status = status;
  set(REPORTS_KEY, reports);
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

/** 演示内置账号：用户名 / 手机号 / 邮箱 均可登录同一账号 */
function builtInAccount(): StoredAccount {
  return {
    id: 'u1',
    username: 'zhangsan',
    phone: '13812345678',
    email: 'zhangsan@example.com',
    passwordHash: hashPassword('123456'),
    nickname: '演示用户zhangsan',
    role: 'user',
    carbonCredits: 1250,
    createdAt: 1723000000000,
  };
}

export function getAccounts(): StoredAccount[] {
  const list = get<StoredAccount[]>(ACCOUNTS_KEY, []);
  // 合并内置演示账号（始终存在，方便演示三种方式登录）
  const builtin = builtInAccount();
  if (!list.some(a => a.id === builtin.id)) return [builtin, ...list];
  return list;
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

const NOTIF_KEY = 'notification_settings';

export function getNotificationSettings(): NotificationSettings {
  return get<NotificationSettings>(NOTIF_KEY, {
    congestion: true, weather: true, control: true, workorder: true, system: false,
  });
}

export function setNotificationSettings(s: NotificationSettings): void {
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
const INITIAL_POINTS = 1250;

export function getUserPoints(): number {
  return get<number>(POINTS_KEY, INITIAL_POINTS);
}

/** 仅在"后端"调用 — 扣除积分（保证不出现负数） */
export function deductPoints(amount: number): { success: boolean; remaining: number } {
  const current = getUserPoints();
  if (current < amount) return { success: false, remaining: current };
  const remaining = current - amount;
  set(POINTS_KEY, remaining);
  return { success: true, remaining };
}

/** 增加积分（事件上报奖励、绿色出行等） */
export function addPoints(amount: number): number {
  const current = getUserPoints();
  const updated = current + amount;
  set(POINTS_KEY, updated);
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

export function getRedemptions(): RedemptionRecord[] {
  return get<RedemptionRecord[]>(REDEMPTIONS_KEY, []);
}

export function addRedemption(r: RedemptionRecord): void {
  const records = getRedemptions();
  records.unshift(r);
  set(REDEMPTIONS_KEY, records);
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
