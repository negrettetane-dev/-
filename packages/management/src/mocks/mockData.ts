// ===== 智途云枢 · Mock Data (北京) =====

// ---- Districts ----
export const DISTRICTS = [
  '东城区', '西城区', '朝阳区', '海淀区', '丰台区',
  '石景山区', '通州区', '昌平区', '大兴区', '顺义区',
];

// ---- Road segments (30+) ----
export interface MockRoadSegment {
  id: string;
  name: string;
  direction: string;
  startCoord: [number, number];
  endCoord: [number, number];
  speed: number;
  freeFlowSpeed: number;
  congestionLevel: 'free' | 'slow' | 'congested' | 'blocked';
  travelTimeIndex: number;
  timestamp: number;
}

const ROAD_TEMPLATES: Array<{
  name: string;
  startCoord: [number, number];
  endCoord: [number, number];
  freeFlowSpeed: number;
}> = [
  { name: '二环路南段', startCoord: [116.40, 39.88], endCoord: [116.44, 39.90], freeFlowSpeed: 60 },
  { name: '二环路北段', startCoord: [116.38, 39.94], endCoord: [116.42, 39.94], freeFlowSpeed: 60 },
  { name: '二环路东段', startCoord: [116.44, 39.89], endCoord: [116.44, 39.94], freeFlowSpeed: 60 },
  { name: '二环路西段', startCoord: [116.36, 39.89], endCoord: [116.36, 39.94], freeFlowSpeed: 60 },
  { name: '三环路南段', startCoord: [116.35, 39.86], endCoord: [116.46, 39.87], freeFlowSpeed: 80 },
  { name: '三环路北段', startCoord: [116.34, 39.96], endCoord: [116.47, 39.97], freeFlowSpeed: 80 },
  { name: '长安街东段', startCoord: [116.36, 39.91], endCoord: [116.44, 39.91], freeFlowSpeed: 60 },
  { name: '长安街西段', startCoord: [116.28, 39.91], endCoord: [116.36, 39.91], freeFlowSpeed: 60 },
  { name: '平安大街', startCoord: [116.38, 39.93], endCoord: [116.43, 39.93], freeFlowSpeed: 50 },
  { name: '中关村大街', startCoord: [116.32, 39.94], endCoord: [116.32, 40.00], freeFlowSpeed: 50 },
  { name: '学院路', startCoord: [116.35, 39.96], endCoord: [116.35, 40.01], freeFlowSpeed: 50 },
  { name: '建国路', startCoord: [116.43, 39.91], endCoord: [116.50, 39.91], freeFlowSpeed: 60 },
  { name: '两广路', startCoord: [116.36, 39.89], endCoord: [116.43, 39.89], freeFlowSpeed: 50 },
  { name: '复兴路', startCoord: [116.28, 39.90], endCoord: [116.36, 39.90], freeFlowSpeed: 55 },
  { name: '望京街', startCoord: [116.45, 39.99], endCoord: [116.50, 39.99], freeFlowSpeed: 60 },
  { name: '京通快速路', startCoord: [116.45, 39.91], endCoord: [116.55, 39.91], freeFlowSpeed: 80 },
  { name: '阜成路', startCoord: [116.30, 39.92], endCoord: [116.36, 39.92], freeFlowSpeed: 50 },
  { name: '五环路北段', startCoord: [116.33, 40.00], endCoord: [116.44, 40.00], freeFlowSpeed: 90 },
  { name: '东直门外大街', startCoord: [116.43, 39.94], endCoord: [116.47, 39.94], freeFlowSpeed: 55 },
  { name: '朝阳路', startCoord: [116.46, 39.92], endCoord: [116.52, 39.93], freeFlowSpeed: 50 },
  { name: '广渠路', startCoord: [116.42, 39.90], endCoord: [116.49, 39.90], freeFlowSpeed: 55 },
  { name: '西直门北大街', startCoord: [116.35, 39.94], endCoord: [116.35, 39.98], freeFlowSpeed: 50 },
  { name: '北辰西路', startCoord: [116.39, 39.99], endCoord: [116.39, 40.03], freeFlowSpeed: 50 },
  { name: '天坛东路', startCoord: [116.42, 39.88], endCoord: [116.42, 39.90], freeFlowSpeed: 45 },
  { name: '南三环中路', startCoord: [116.39, 39.86], endCoord: [116.44, 39.86], freeFlowSpeed: 80 },
  { name: '北四环中路', startCoord: [116.32, 39.98], endCoord: [116.43, 39.98], freeFlowSpeed: 85 },
  { name: '东三环中路', startCoord: [116.44, 39.88], endCoord: [116.46, 39.94], freeFlowSpeed: 80 },
  { name: '西三环中路', startCoord: [116.32, 39.88], endCoord: [116.32, 39.94], freeFlowSpeed: 80 },
  { name: '德胜门外大街', startCoord: [116.38, 39.94], endCoord: [116.38, 39.99], freeFlowSpeed: 55 },
  { name: '崇文门外大街', startCoord: [116.42, 39.88], endCoord: [116.42, 39.91], freeFlowSpeed: 45 },
];

function randomSpeed(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function getCongestionLevel(tti: number): 'free' | 'slow' | 'congested' | 'blocked' {
  if (tti <= 1.2) return 'free';
  if (tti <= 1.6) return 'slow';
  if (tti <= 2.2) return 'congested';
  return 'blocked';
}

export function generateRoadSegments(): MockRoadSegment[] {
  return ROAD_TEMPLATES.map((tpl, i) => {
    const freeFlow = tpl.freeFlowSpeed;
    const speed = randomSpeed(freeFlow * 0.15, freeFlow * 1.05);
    const tti = freeFlow / Math.max(speed, 1);
    return {
      id: `road-${(i + 1).toString().padStart(3, '0')}`,
      name: tpl.name,
      direction: i % 2 === 0 ? '由东向西' : '由南向北',
      startCoord: tpl.startCoord,
      endCoord: tpl.endCoord,
      speed,
      freeFlowSpeed: freeFlow,
      congestionLevel: getCongestionLevel(tti),
      travelTimeIndex: Math.round(tti * 100) / 100,
      timestamp: Date.now(),
    };
  });
}

// ---- Traffic metrics history (24h) ----
export interface HourlyMetrics {
  hour: number;
  activeVehicles: number;
  avgSpeed: number;
  congestionIndex: number;
  incidentCount: number;
}

export function generateHourlyMetrics(): HourlyMetrics[] {
  // Realistic 24h pattern: rush at 7-9, 17-19
  const hourlyPattern = [
    0.08, 0.05, 0.04, 0.04, 0.05, 0.10, 0.25, 0.65, 0.85, 0.60, 0.50, 0.48,
    0.45, 0.40, 0.45, 0.55, 0.65, 0.90, 0.85, 0.55, 0.40, 0.30, 0.20, 0.12,
  ];
  const baseVehicles = 80000;
  const maxVehicles = 160000;
  const baseSpeed = 45;
  const maxSpeed = 55;

  return hourlyPattern.map((factor, hour) => ({
    hour,
    activeVehicles: Math.round(baseVehicles + (maxVehicles - baseVehicles) * factor),
    avgSpeed: Math.round((maxSpeed - (maxSpeed - baseSpeed) * factor) * 10) / 10,
    congestionIndex: Math.round((1.5 + 6 * factor) * 10) / 10,
    incidentCount: Math.round(2 + 6 * factor),
  }));
}

// ---- District congestion data ----
export function generateDistrictCongestion() {
  return DISTRICTS.map((district, i) => {
    const index = Math.round((1.3 + Math.random() * 5.5) * 10) / 10;
    const trends: Array<'up' | 'down' | 'stable'> = ['up', 'down', 'stable'];
    return {
      district,
      index,
      avgSpeed: Math.round((60 - index * 5 + Math.random() * 5) * 10) / 10,
      trend: trends[i % 3],
    };
  });
}

// ---- Traffic incidents ----
export interface IncidentProcessLog {
  id: string;
  time: number;
  action: string;
  operator: string;
  fromStatus?: string;
  toStatus?: string;
  detail: string;
}

export interface MockIncident {
  id: string;
  title: string;
  description: string;
  roadName: string;
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  reportedAt: string;
  reportedBy: string;
  platformFeedback?: string;
  processLogs: IncidentProcessLog[];
}

const INCIDENT_TEMPLATES: Array<{ type: string; severity: 'high' | 'medium' | 'low'; roadName: string; position: [number, number] }> = [
  { type: '交通事故', severity: 'high', roadName: '长安街东段', position: [116.41, 39.91] },
  { type: '交通事故', severity: 'medium', roadName: '二环路东段', position: [116.44, 39.92] },
  { type: '交通事故', severity: 'low', roadName: '平安大街', position: [116.40, 39.93] },
  { type: '道路施工', severity: 'medium', roadName: '三环路南段', position: [116.40, 39.87] },
  { type: '道路施工', severity: 'low', roadName: '中关村大街', position: [116.32, 39.96] },
  { type: '临时管制', severity: 'medium', roadName: '长安街西段', position: [116.34, 39.91] },
  { type: '交通拥堵', severity: 'medium', roadName: '建国路', position: [116.46, 39.91] },
  { type: '交通拥堵', severity: 'low', roadName: '学院路', position: [116.35, 39.98] },
  { type: '信号灯故障', severity: 'high', roadName: '东三环中路', position: [116.45, 39.91] },
  { type: '信号灯故障', severity: 'medium', roadName: '复兴路', position: [116.32, 39.90] },
  { type: '路面塌陷', severity: 'high', roadName: '广渠路', position: [116.46, 39.90] },
  { type: '车辆故障', severity: 'low', roadName: '两广路', position: [116.40, 39.89] },
  { type: '落石/障碍', severity: 'medium', roadName: '京通快速路', position: [116.50, 39.91] },
  { type: '行人闯入', severity: 'low', roadName: '崇文门外大街', position: [116.42, 39.89] },
  { type: '逆行车辆', severity: 'high', roadName: '朝阳路', position: [116.48, 39.92] },
];

const INCIDENT_REPORTERS = ['张先生', '李女士', '王师傅', '赵师傅', '陈先生', '刘女士', '周先生', '吴女士'];

export const INCIDENT_STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  processing: '处理中',
  resolved: '已完成',
  closed: '已关闭',
};

export function generateIncidents(): MockIncident[] {
  const now = Date.now();
  return INCIDENT_TEMPLATES.map((tpl, i) => {
    const statuses: Array<MockIncident['status']> = ['pending', 'processing', 'resolved'];
    const status = statuses[i % statuses.length];
    const createOffset = Math.random() * 86400000 * 3;
    const reportedAt = new Date(now - createOffset).toISOString();
    const reporter = INCIDENT_REPORTERS[i % INCIDENT_REPORTERS.length];

    const logs: IncidentProcessLog[] = [{
      id: `pl-${i}-1`,
      time: now - createOffset,
      action: '创建事件',
      operator: `市民 ${reporter}`,
      detail: `上报${tpl.type}问题`,
    }];
    if (status === 'processing' || status === 'resolved') {
      logs.push({
        id: `pl-${i}-2`,
        time: now - createOffset + 1800000,
        action: '状态变更为「处理中」',
        operator: '管理员',
        fromStatus: 'pending',
        toStatus: 'processing',
        detail: '已派单处置',
      });
    }
    if (status === 'resolved') {
      logs.push({
        id: `pl-${i}-3`,
        time: now - createOffset + 3600000,
        action: '状态变更为「已完成」',
        operator: '管理员',
        fromStatus: 'processing',
        toStatus: 'resolved',
        detail: '现场已处置完成',
      });
    }

    return {
      id: `INC-${(i + 1).toString().padStart(4, '0')}`,
      title: `${tpl.roadName}${tpl.type}`,
      description: `在${tpl.roadName}检测到${tpl.type}事件，建议立即处置。${i % 3 === 0 ? '可能影响周边2公里范围交通。' : ''}`,
      roadName: tpl.roadName,
      severity: tpl.severity,
      status,
      reportedAt,
      reportedBy: reporter,
      platformFeedback: status === 'resolved' ? '已处置完成，感谢您的上报。' : undefined,
      processLogs: logs,
    };
  });
}

// ---- Intersections (12) ----
export interface MockIntersection {
  id: string;
  name: string;
  position: [number, number];
  phaseCount: number;
  currentPhase: number;
  cycleTime: number;
  optimizationStatus: 'manual' | 'auto' | 'optimizing';
  greenWaveGroup?: string;
}

const INTERSECTION_NAMES = [
  '长安街-东单路口', '二环路-东直门桥口', '长安街-西单路口',
  '二环路-建国门桥口', '三环路-国贸桥口', '平安大街-地安门口',
  '中关村大街-知春路口', '学院路-成府路口', '建国路-国贸路口',
  '两广路-磁器口', '复兴路-公主坟桥口', '东三环-双井桥口',
];

export function generateIntersections(): MockIntersection[] {
  return INTERSECTION_NAMES.map((name, i) => {
    const phaseCount = [4, 6, 8][i % 3];
    return {
      id: `int-${(i + 1).toString().padStart(3, '0')}`,
      name,
      position: [116.32 + Math.random() * 0.16, 39.87 + Math.random() * 0.12] as [number, number],
      phaseCount,
      currentPhase: Math.floor(Math.random() * phaseCount) + 1,
      cycleTime: [90, 120, 150, 180][i % 4],
      optimizationStatus: (['manual', 'auto', 'optimizing'] as const)[i % 3],
      greenWaveGroup: i < 4 ? `绿波带-${['A', 'B', 'A', 'B'][i]}` : undefined,
    };
  });
}

// ---- Signal phases (for first intersection) ----
export function generatePhases(intersectionId: string, phaseCount: number) {
  const directions = ['东西直行', '东西左转', '南北直行', '南北左转', '东向南左转', '西向北左转', '南向东右转', '北向西右转'];
  return Array.from({ length: phaseCount }, (_, i) => ({
    id: `phase-${intersectionId}-${i + 1}`,
    intersectionId,
    phaseNo: i + 1,
    direction: directions[i % directions.length],
    greenTime: 30 + Math.floor(Math.random() * 40),
    yellowTime: 3,
    redTime: 60 + Math.floor(Math.random() * 40),
    minGreen: 20,
    maxGreen: 60,
  }));
}

// ---- Devices (40) ----
export interface MockDevice {
  id: string;
  type: 'camera' | 'radar' | 'geomagnetic' | 'rsu' | 'signal_controller';
  name: string;
  position: [number, number];
  roadName: string;
  status: 'online' | 'offline' | 'fault' | 'maintenance';
  lastHeartbeat: number;
  uptime: number;
  installDate?: number;
  model?: string;
}

const DEVICE_TYPES: Array<'camera' | 'radar' | 'geomagnetic' | 'rsu' | 'signal_controller'> = [
  'camera', 'radar', 'geomagnetic', 'rsu', 'signal_controller',
];

const DEVICE_MODELS: Record<string, string> = {
  camera: 'Hikvision DS-2CD5A46G0',
  radar: 'Smartmicro UMRR-11',
  geomagnetic: 'Sensys S60',
  rsu: 'Huawei RSU5201',
  signal_controller: 'SCOOT MK5',
};

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateDevices(): MockDevice[] {
  const roadNames = ROAD_TEMPLATES.map((r) => r.name);
  const now = Date.now();
  return Array.from({ length: 40 }, (_, i) => {
    const type = DEVICE_TYPES[i % DEVICE_TYPES.length];
    const statusWeights = [0.65, 0.15, 0.1, 0.1];
    const r = Math.random();
    let status: 'online' | 'offline' | 'fault' | 'maintenance';
    if (r < statusWeights[0]) status = 'online';
    else if (r < statusWeights[0] + statusWeights[1]) status = 'offline';
    else if (r < statusWeights[0] + statusWeights[1] + statusWeights[2]) status = 'fault';
    else status = 'maintenance';

    return {
      id: `DEV-${(i + 1).toString().padStart(4, '0')}`,
      type,
      name: `${type === 'camera' ? '摄像头' : type === 'radar' ? '毫米波雷达' : type === 'geomagnetic' ? '地磁传感器' : type === 'rsu' ? 'RSU路侧单元' : '信号机'} #${i + 1}`,
      position: [116.30 + Math.random() * 0.2, 39.85 + Math.random() * 0.16] as [number, number],
      roadName: randomElement(roadNames),
      status,
      lastHeartbeat: status === 'online' ? now - Math.floor(Math.random() * 300000) : now - Math.floor(Math.random() * 86400000),
      uptime: status === 'online' ? 95 + Math.random() * 5 : 60 + Math.random() * 30,
      installDate: now - Math.floor(Math.random() * 365 * 2 * 86400000),
      model: DEVICE_MODELS[type],
    };
  });
}

// ---- Simulation scenarios (5) ----
export interface MockScenario {
  id: string;
  name: string;
  description: string;
  area: { center: [number, number]; radius: number };
  duration: number;
  parameters: { trafficVolume: number; signalMode: 'fixed' | 'adaptive' | 'green_wave'; incidentRate: number };
  status: 'idle' | 'running' | 'completed' | 'failed';
}

export const SIMULATION_SCENARIOS: MockScenario[] = [
  {
    id: 'sim-001',
    name: '早高峰长安街拥堵缓解',
    description: '模拟早高峰（7:30-9:00）长安街交通流，测试自适应信号控制对拥堵的缓解效果。',
    area: { center: [116.40, 39.91], radius: 3000 },
    duration: 300,
    parameters: { trafficVolume: 1.4, signalMode: 'adaptive', incidentRate: 0.02 },
    status: 'idle',
  },
  {
    id: 'sim-002',
    name: '二环路绿波带优化',
    description: '针对二环路沿线12个路口，模拟绿波信号配时优化方案，评估通行效率提升。',
    area: { center: [116.40, 39.91], radius: 5000 },
    duration: 600,
    parameters: { trafficVolume: 1.0, signalMode: 'green_wave', incidentRate: 0.01 },
    status: 'idle',
  },
  {
    id: 'sim-003',
    name: '大型活动交通管制仿真',
    description: '模拟鸟巢/国家体育场举办大型活动时，周边道路交通管制方案的可行性与影响分析。',
    area: { center: [116.39, 40.00], radius: 4000 },
    duration: 900,
    parameters: { trafficVolume: 1.8, signalMode: 'fixed', incidentRate: 0.05 },
    status: 'idle',
  },
  {
    id: 'sim-004',
    name: '三环路事故应急推演',
    description: '模拟三环路南段突发多车追尾事故后的交通分流与应急处置方案。',
    area: { center: [116.40, 39.87], radius: 3500 },
    duration: 450,
    parameters: { trafficVolume: 1.2, signalMode: 'adaptive', incidentRate: 0.08 },
    status: 'completed',
  },
  {
    id: 'sim-005',
    name: '中关村路网扩容评估',
    description: '评估中关村大街至学院路区域增加潮汐车道后的交通改善效果。',
    area: { center: [116.32, 39.98], radius: 4000 },
    duration: 720,
    parameters: { trafficVolume: 1.3, signalMode: 'green_wave', incidentRate: 0.03 },
    status: 'completed',
  },
];

// ---- AI-detected alerts (for dashboard real-time panel) ----
export interface AiAlert {
  id: string;
  type: string;
  location: string;
  time: number;
  confidence: number;
  description: string;
}

export function generateAiAlerts(): AiAlert[] {
  const now = Date.now();
  return [
    { id: 'ai-001', type: '交通事故', location: '长安街东段·东单路口', time: now - 120000, confidence: 0.96, description: '两车追尾，占用左侧车道' },
    { id: 'ai-002', type: '异常停车', location: '三环路南段·国贸桥', time: now - 300000, confidence: 0.89, description: '车辆在应急车道长时间停留' },
    { id: 'ai-003', type: '逆行车辆', location: '朝阳路·东四环路口', time: now - 480000, confidence: 0.94, description: '检测到逆行车辆，车速约30km/h' },
    { id: 'ai-004', type: '行人闯入', location: '中关村大街·知春路口', time: now - 600000, confidence: 0.85, description: '行人翻越隔离栏进入主路' },
    { id: 'ai-005', type: '交通拥堵', location: '建国路·国贸路口', time: now - 900000, confidence: 0.98, description: '车流排队长度超过500米' },
    { id: 'ai-006', type: '路面异常', location: '平安大街·地安门口', time: now - 1200000, confidence: 0.82, description: '路面疑似出现塌陷痕迹' },
    { id: 'ai-007', type: '抛洒物', location: '二环路东段·东直门桥', time: now - 1500000, confidence: 0.91, description: '货车掉落货物占据右侧车道' },
    { id: 'ai-008', type: '信号灯异常', location: '复兴路·公主坟桥口', time: now - 1800000, confidence: 0.88, description: '信号灯疑似全红闪烁状态' },
  ];
}

// ---- Dashboard real-time metrics ----
export function generateRealTimeMetrics() {
  return {
    timestamp: Date.now(),
    activeVehicles: 128563,
    avgSpeed: 32.5,
    congestionIndex: 5.8,
    incidentCount: 8,
    congestedRoadCount: 23,
    deviceOnlineRate: 96.8,
  };
}

// ---- Users (for settings page) ----
export interface MockUser {
  id: string;
  username: string;
  realName: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  status: 'active' | 'disabled';
  lastLogin: number;
}

export const MOCK_USERS: MockUser[] = [
  { id: 'u-001', username: 'admin', realName: '系统管理员', role: '超级管理员', department: '信息中心', phone: '13800000001', email: 'admin@zhitu.com', status: 'active', lastLogin: Date.now() - 60000 },
  { id: 'u-002', username: 'zhangwei', realName: '张伟', role: '运营主管', department: '运营部', phone: '13800000002', email: 'zhangwei@zhitu.com', status: 'active', lastLogin: Date.now() - 1800000 },
  { id: 'u-003', username: 'liming', realName: '李明', role: '信号工程师', department: '信号中心', phone: '13800000003', email: 'liming@zhitu.com', status: 'active', lastLogin: Date.now() - 3600000 },
  { id: 'u-004', username: 'wangfang', realName: '王芳', role: '数据分析师', department: '数据部', phone: '13800000004', email: 'wangfang@zhitu.com', status: 'active', lastLogin: Date.now() - 7200000 },
  { id: 'u-005', username: 'chengang', realName: '陈刚', role: '值班员', department: '指挥中心', phone: '13800000005', email: 'chengang@zhitu.com', status: 'disabled', lastLogin: Date.now() - 86400000 * 7 },
  { id: 'u-006', username: 'liuqin', realName: '刘琴', role: '调度员', department: '指挥中心', phone: '13800000006', email: 'liuqin@zhitu.com', status: 'active', lastLogin: Date.now() - 900000 },
  { id: 'u-007', username: 'zhaolei', realName: '赵磊', role: '设备维护', department: '运维部', phone: '13800000007', email: 'zhaolei@zhitu.com', status: 'active', lastLogin: Date.now() - 5400000 },
];

// ---- System logs ----
export interface MockSystemLog {
  id: string;
  time: number;
  user: string;
  action: string;
  module: string;
  detail: string;
  ip: string;
}

export function generateSystemLogs(): MockSystemLog[] {
  const actions = ['登录系统', '修改配置', '派发工单', '导出报表', '编辑信号配时', '添加设备', '启动仿真', '查看大屏'];
  const modules = ['系统管理', '事件管理', '信号控制', '设备管理', '工单处理', '数据报表', '仿真推演'];
  const users = ['admin', 'zhangwei', 'liming', 'wangfang', 'chengang', 'liuqin'];
  const ips = ['192.168.1.100', '192.168.1.101', '10.0.1.23', '10.0.1.45', '172.16.0.8'];

  const now = Date.now();
  return Array.from({ length: 50 }, (_, i) => ({
    id: `log-${i + 1}`,
    time: now - i * 600000 - Math.floor(Math.random() * 300000),
    user: randomElement(users),
    action: randomElement(actions),
    module: randomElement(modules),
    detail: `用户执行了${randomElement(actions)}操作`,
    ip: randomElement(ips),
  }));
}

// ---- 无障碍设施（管理端 mock）----
export interface MockFacilityEntrance {
  id: string;
  name: string;
  elevator: boolean;
  ramp: boolean;
  stairsOnly: boolean;
  wheelchairAccessible: boolean;
  status: 'verified' | 'unknown' | 'obstacle';
}

export interface MockStationFacility {
  stationId: string;
  stationName: string;
  lng: number;
  lat: number;
  entrances: MockFacilityEntrance[];
  accessibleRestroom: boolean;
  source: 'backend' | 'demo';
}

export const MOCK_ACCESSIBILITY_STATIONS: MockStationFacility[] = [
  {
    stationId: 'bj_tiananmen_east', stationName: '天安门东', lng: 116.404, lat: 39.909, accessibleRestroom: true, source: 'backend',
    entrances: [
      { id: 'ent-1', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
      { id: 'ent-2', name: 'B口', elevator: false, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
      { id: 'ent-3', name: 'C口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle' },
    ],
  },
  {
    stationId: 'bj_wangfujing', stationName: '王府井', lng: 116.410, lat: 39.914, accessibleRestroom: true, source: 'backend',
    entrances: [
      { id: 'ent-4', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
      { id: 'ent-5', name: 'B口', elevator: true, ramp: false, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
      { id: 'ent-6', name: 'C口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'verified' },
    ],
  },
  {
    stationId: 'bj_xidan', stationName: '西单', lng: 116.380, lat: 39.913, accessibleRestroom: false, source: 'backend',
    entrances: [
      { id: 'ent-7', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
      { id: 'ent-8', name: 'B口', elevator: false, ramp: false, stairsOnly: false, wheelchairAccessible: true, status: 'unknown' },
      { id: 'ent-9', name: 'C口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle' },
    ],
  },
  {
    stationId: 'bj_guomao', stationName: '国贸', lng: 116.461, lat: 39.909, accessibleRestroom: true, source: 'backend',
    entrances: [
      { id: 'ent-10', name: 'A口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
      { id: 'ent-11', name: 'D口', elevator: false, ramp: false, stairsOnly: true, wheelchairAccessible: false, status: 'obstacle' },
    ],
  },
  {
    stationId: 'bj_beijing_station', stationName: '北京站', lng: 116.433, lat: 39.903, accessibleRestroom: true, source: 'backend',
    entrances: [
      { id: 'ent-12', name: '北广场入口', elevator: true, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
      { id: 'ent-13', name: '南侧通道', elevator: false, ramp: true, stairsOnly: false, wheelchairAccessible: true, status: 'verified' },
    ],
  },
];

// ---- Admin notifications（管理端通知中心）----
export interface MockAdminNotification {
  id: string;
  type: 'event' | 'user' | 'stock';
  title: string;
  content: string;
  relatedId?: string;
  read: boolean;
  createdAt: number;
}

export function generateAdminNotifications(): MockAdminNotification[] {
  const now = Date.now();
  const hour = 3600000;
  const pending = generateIncidents().filter((i) => i.status === 'pending').slice(0, 2);
  const recentUsers = [
    { id: 'u5', nickname: '新用户', username: 'sunqi', phone: '13512345678' },
    { id: 'u6', nickname: '骑行爱好者', username: 'zhouba', phone: '13412345678' },
  ];

  const list: MockAdminNotification[] = [];

  pending.forEach((inc, i) => {
    list.push({
      id: `an-event-${i}`,
      type: 'event',
      title: '新事件上报',
      content: `${inc.reportedBy} 上报了「${inc.title}」，请及时审核。`,
      relatedId: inc.id,
      read: false,
      createdAt: now - (i + 1) * hour,
    });
  });

  recentUsers.forEach((u, i) => {
    list.push({
      id: `an-user-${i}`,
      type: 'user',
      title: '新用户注册',
      content: `${u.nickname || u.username}（${u.phone}）刚刚注册成为新用户。`,
      relatedId: u.id,
      read: false,
      createdAt: now - (i + 2) * hour,
    });
  });

  list.push({
    id: 'an-stock-0',
    type: 'stock',
    title: '兑换商品库存预警',
    content: '「共享单车月卡」库存仅剩 8 件，低于安全阈值 10，请及时补货。',
    relatedId: 'rw3',
    read: false,
    createdAt: now - 30 * 60000,
  });

  list.push({
    id: 'an-event-read',
    type: 'event',
    title: '事件已办结',
    content: '「长安街东段交通事故」已完成处置。',
    relatedId: 'INC-0001',
    read: true,
    createdAt: now - 24 * hour,
  });

  return list;
}
