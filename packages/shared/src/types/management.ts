// ===== 管理端专用类型 =====

import type { CongestionLevel } from './traffic';

/** 信号灯路口 */
export interface Intersection {
  id: string;
  name: string;
  position: [number, number];
  phaseCount: number;
  currentPhase: number;
  cycleTime: number; // 周期时长(秒)
  optimizationStatus: 'manual' | 'auto' | 'optimizing';
  greenWaveGroup?: string; // 绿波带分组
}

/** 信号相位 */
export interface SignalPhase {
  id: string;
  intersectionId: string;
  phaseNo: number;
  direction: string;
  greenTime: number;
  yellowTime: number;
  redTime: number;
  minGreen: number;
  maxGreen: number;
}

/** 交通设备 */
export interface TrafficDevice {
  id: string;
  type: 'camera' | 'radar' | 'geomagnetic' | 'rsu' | 'signal_controller';
  name: string;
  position: [number, number];
  roadName: string;
  status: 'online' | 'offline' | 'fault' | 'maintenance';
  lastHeartbeat: number;
  uptime: number; // 运行时长百分比
}

/** 仿真场景 */
export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  area: { center: [number, number]; radius: number };
  duration: number; // 仿真时长(秒)
  parameters: SimulationParams;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

export interface SimulationParams {
  trafficVolume: number;  // 车流量倍率
  signalMode: 'fixed' | 'adaptive' | 'green_wave';
  incidentRate: number;   // 事故率
}

/** 管理端事件 */
export interface ManagementIncident {
  id: string;
  source: 'ai_detection' | 'citizen_report' | 'patrol' | 'sensor';
  type: string;
  title: string;
  description: string;
  position: [number, number];
  roadName: string;
  severity: 'normal' | 'serious' | 'critical';
  status: 'new' | 'dispatched' | 'processing' | 'resolved' | 'archived';
  assignedTo?: string;
  createTime: number;
  resolveTime?: number;
  images: string[];
}

/** 交通统计指标 */
export interface TrafficMetrics {
  timestamp: number;
  activeVehicles: number;
  avgSpeed: number;
  congestionIndex: number;
  incidentCount: number;
  congestedRoadCount: number;
  deviceOnlineRate: number;
}
