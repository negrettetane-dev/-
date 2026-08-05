// ===== 格式化工具 =====

/** 距离格式化 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** 时长格式化 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

/** 手机号脱敏 */
export function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

/** 车牌脱敏 */
export function maskPlate(plate: string): string {
  if (plate.length <= 3) return plate;
  return plate.slice(0, 2) + '***' + plate.slice(-1);
}

/** 时间戳格式化 */
export function formatTime(ts: number, format: 'full' | 'date' | 'time' | 'relative' = 'full'): string {
  const d = new Date(ts);
  switch (format) {
    case 'date':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    case 'time':
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    case 'relative': {
      const diff = Date.now() - ts;
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
      return `${Math.floor(diff / 86400000)}天前`;
    }
    default:
      return `${formatTime(ts, 'date')} ${formatTime(ts, 'time')}`;
  }
}

/** 卡路里估算 */
export function estimateCalories(meters: number, mode: 'bike' | 'walk'): number {
  const rate = mode === 'bike' ? 0.03 : 0.05; // kcal/m
  return Math.round(meters * rate);
}

/** 碳减排估算 (克) */
export function estimateCarbonSaved(meters: number, mode: 'bus' | 'metro' | 'bike' | 'walk'): number {
  // 假设私家车碳排放约 200g/km
  const carEmission = 200;
  const factors: Record<string, number> = {
    bus: 0.3,   // 公交车人均是私家车的30%
    metro: 0.15, // 地铁人均是私家车的15%
    bike: 1,     // 骑行完全替代
    walk: 1,     // 步行完全替代
  };
  return Math.round((meters / 1000) * carEmission * factors[mode]);
}

/** 等效植树 (每棵树年吸收约5000g CO2，粗略换算) */
export function treeEquivalent(carbonGrams: number): number {
  return parseFloat((carbonGrams / 5000).toFixed(2));
}

/** 两点间距离 (Haversine) */
export function calcDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371000;
  const [lng1, lat1] = p1;
  const [lng2, lat2] = p2;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
