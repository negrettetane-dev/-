// ===== 停车场 & 充电桩 =====

/** 停车场 */
export interface ParkingLot {
  id: string;
  name: string;
  address: string;
  position: [number, number];
  totalSpots: number;
  availableSpots: number;
  price: string; // "5元/小时" 或 "免费"
  priceValue: number; // 数值
  openTime: string;
  type: 'ground' | 'underground' | 'roadside';
  distance: number; // 距离用户 (米)
  hasCharging: boolean;
  images: string[];
}

/** 充电桩 */
export interface ChargingStation {
  id: string;
  name: string;
  address: string;
  position: [number, number];
  operator: string; // 运营商
  totalPiles: number;
  availablePiles: number;
  power: string; // "60kW" / "120kW"
  powerValue: number;
  price: string; // 电价描述
  connectorTypes: ('GB/T' | 'CCS2' | 'CHAdeMO')[];
  openTime: string;
  distance: number;
  status: 'online' | 'offline' | 'maintenance';
}

/** 停车支付记录 */
export interface ParkingPayment {
  id: string;
  lotName: string;
  plateNumber: string;
  enterTime: number;
  exitTime?: number;
  duration: number;
  amount: number;
  status: 'parking' | 'paid' | 'completed';
}
