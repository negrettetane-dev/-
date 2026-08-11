// ===== 管理端持久化层 =====
// 与公民端共享 localStorage（同域名 localhost），管理端直接读写公民端数据

const STORAGE_PREFIX = 'zhitu_';
function get<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(STORAGE_PREFIX + key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function set(key: string, value: unknown): void {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch {}
}

// ====== 类型 ======

export interface Report {
  id: string; workOrderNo: string; category: string; description: string;
  location: string; status: 'pending' | 'received' | 'processing' | 'completed' | 'rejected';
  createdAt: number; phone?: string; images?: string[];
}

export interface ProcessRecord {
  id: string; reportId: string; action: string; operator: string;
  fromStatus: string; toStatus: string; note: string; time: number;
}

export interface AdminUser {
  id: string; username: string; realName: string; role: 'super_admin' | 'event_handler' | 'content_admin' | 'ops_admin';
  department: string; phone: string; email: string; status: 'active' | 'disabled'; lastLogin: number;
}

export interface CitizenUser {
  id: string; username: string; nickname: string; phone: string; email: string;
  isVerified: boolean; carbonCredits: number; createdAt: number;
}

export interface PointTransaction {
  id: string; userId: string; type: 'earn' | 'redeem' | 'adjust';
  amount: number; reason: string; operator: string; time: number;
}

export interface OperationLog {
  id: string; operator: string; module: string; action: string;
  target: string; detail: string; ip: string; time: number;
}

export interface PointRule {
  id: string; name: string; action: string; points: number; enabled: boolean;
}

// ====== 事件/工单（共享公民端 localStorage key） ======

export function getReports(): Report[] {
  return get<Report[]>('reports', []);
}

export function getReportById(id: string): Report | null {
  return getReports().find(r => r.id === id || r.workOrderNo === id) || null;
}

export function updateReportStatus(id: string, status: Report['status']): void {
  const reports = getReports();
  const r = reports.find(r => r.id === id || r.workOrderNo === id);
  if (r) { r.status = status; set('reports', reports); }
}

export function getProcessRecords(reportId?: string): ProcessRecord[] {
  const all = get<ProcessRecord[]>('process_records', []);
  return reportId ? all.filter(p => p.reportId === reportId) : all;
}

export function addProcessRecord(record: ProcessRecord): void {
  const all = getProcessRecords();
  all.unshift(record);
  set('process_records', all);
}

// ====== 用户 ======

export function getCitizenUsers(): CitizenUser[] {
  const accounts = get<any[]>('user_accounts', []);
  // 内置演示账号
  return [{ id:'u1', username:'zhangsan', nickname:'北京市民', phone:'13812345678', email:'zhangsan@example.com', isVerified:true, carbonCredits: get<number>('user_points', 1250), createdAt:1723000000000 }, ...accounts.map(a => ({
    id: a.id, username: a.username, nickname: a.nickname, phone: a.phone, email: a.email,
    isVerified: true, carbonCredits: a.carbonCredits || 0, createdAt: a.createdAt || Date.now(),
  }))];
}

export function adjustUserPoints(userId: string, amount: number, reason: string, operator: string): void {
  const current = get<number>('user_points', 1250);
  set('user_points', current + amount);
  addPointTransaction({ id:'pt_'+Date.now().toString(36), userId, type:'adjust', amount, reason, operator, time:Date.now() });
}

// ====== 积分 ======

export function getPointTransactions(userId?: string): PointTransaction[] {
  const all = get<PointTransaction[]>('point_transactions', []);
  return userId ? all.filter(t => t.userId === userId) : all;
}

export function addPointTransaction(t: PointTransaction): void {
  const all = getPointTransactions();
  all.unshift(t);
  set('point_transactions', all);
}

export function getPointRules(): PointRule[] {
  return get<PointRule[]>('point_rules', [
    { id:'pr1', name:'公交出行', action:'bus_ride', points:5, enabled:true },
    { id:'pr2', name:'地铁出行', action:'metro_ride', points:5, enabled:true },
    { id:'pr3', name:'骑行', action:'bike_ride', points:10, enabled:true },
    { id:'pr4', name:'步行', action:'walk', points:10, enabled:true },
    { id:'pr5', name:'有效事件上报', action:'valid_report', points:20, enabled:true },
    { id:'pr6', name:'每日签到', action:'daily_checkin', points:3, enabled:true },
  ]);
}

export function setPointRules(rules: PointRule[]): void { set('point_rules', rules); }

export function getRedemptionRecords(): any[] { return get<any[]>('redemptions', []); }

// ====== 管理员 ======

export function getAdminUsers(): AdminUser[] {
  return get<AdminUser[]>('admin_users', [
    { id:'a1', username:'admin', realName:'系统管理员', role:'super_admin', department:'信息中心', phone:'13800000001', email:'admin@zhitu.com', status:'active', lastLogin:Date.now() },
    { id:'a2', username:'handler', realName:'张伟', role:'event_handler', department:'运营部', phone:'13800000002', email:'zhangwei@zhitu.com', status:'active', lastLogin:Date.now() },
    { id:'a3', username:'content', realName:'李明', role:'content_admin', department:'宣传部', phone:'13800000003', email:'liming@zhitu.com', status:'active', lastLogin:Date.now() },
  ]);
}

// ====== 操作日志 ======

export function getOperationLogs(limit = 50): OperationLog[] {
  const logs = get<OperationLog[]>('operation_logs', []);
  if (logs.length === 0) {
    // 初始化演示日志
    const demos: OperationLog[] = [
      { id:'l1', operator:'admin', module:'事件管理', action:'状态变更', target:'BJ20260805001', detail:'pending→received', ip:'127.0.0.1', time:Date.now()-3600000 },
      { id:'l2', operator:'handler', module:'事件管理', action:'状态变更', target:'BJ20260805001', detail:'received→processing', ip:'127.0.0.1', time:Date.now()-1800000 },
      { id:'l3', operator:'admin', module:'用户管理', action:'积分调整', target:'u1', detail:'+20积分（有效上报奖励）', ip:'127.0.0.1', time:Date.now()-7200000 },
    ];
    set('operation_logs', demos);
    return demos;
  }
  return logs.slice(0, limit);
}

export function addOperationLog(log: OperationLog): void {
  const logs = get<OperationLog[]>('operation_logs', []);
  logs.unshift(log);
  set('operation_logs', logs.slice(0, 200));
}

// ====== 停车/充电/资讯/便民（管理端编辑） ======

export function getParkingLots(): any[] { return get<any[]>('admin_parking', []); }
export function setParkingLots(lots: any[]): void { set('admin_parking', lots); }

export function getChargingStations(): any[] { return get<any[]>('admin_charging', []); }
export function setChargingStations(stations: any[]): void { set('admin_charging', stations); }

export function getTrafficNews(): any[] { return get<any[]>('admin_news', []); }
export function setTrafficNews(news: any[]): void { set('admin_news', news); }

export function getServices(): any[] { return get<any[]>('admin_services', []); }
export function setServices(services: any[]): void { set('admin_services', services); }

// ====== 统计 ======

export function getDashboardStats() {
  const reports = getReports();
  const users = getCitizenUsers();
  const pointsTxs = getPointTransactions();

  return {
    totalUsers: users.length + 1, // +1 for built-in
    todayReports: reports.filter(r => r.createdAt > Date.now() - 86400000).length,
    pendingReports: reports.filter(r => r.status === 'pending').length,
    processingReports: reports.filter(r => r.status === 'processing').length,
    completedReports: reports.filter(r => r.status === 'completed').length,
    todayPointsIssued: pointsTxs.filter(t => t.type === 'earn' && t.time > Date.now() - 86400000).reduce((sum, t) => sum + t.amount, 0),
    todayPointsRedeemed: pointsTxs.filter(t => t.type === 'redeem' && t.time > Date.now() - 86400000).reduce((sum, t) => sum + t.amount, 0),
  };
}

export function getReportStats() {
  const reports = getReports();
  const byCategory: Record<string,number> = {};
  const byDay: Record<string,number> = {};
  reports.forEach(r => {
    byCategory[r.category] = (byCategory[r.category]||0) + 1;
    const day = new Date(r.createdAt).toISOString().slice(5,10);
    byDay[day] = (byDay[day]||0) + 1;
  });
  const catArray = Object.entries(byCategory).map(([name,value]) => ({name,value}));
  const trend = Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,count])=>({date,count}));
  const statusCounts = { pending:0, received:0, processing:0, completed:0, rejected:0 };
  reports.forEach(r => { if (r.status in statusCounts) statusCounts[r.status as keyof typeof statusCounts]++; });
  return { byCategory: catArray, trend, statusCounts, total: reports.length };
}
