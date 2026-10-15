// ===== 智途云枢 · 出发时间统一模型 =====
// 中文选项只负责交互显示；departureMode 表达选择类型；departureAt 是真实业务时间（ISO）；
// departureTimeLabel 仅用于页面展示。所有内部计算一律使用 departureAt。

export type DepartureMode = 'now' | 'plus30' | 'plus60' | 'custom';

export interface DepartureState {
  departureMode: DepartureMode;
  /** ISO 时间（本地时区），业务计算唯一依据 */
  departureAt: string;
  /** 仅用于页面展示的中文标签 */
  departureTimeLabel: string;
}

const STORAGE_KEY = 'zhitu_travel_departure';

/** 模式 → 实际时间；custom 无固定值，返回 null（需用户确认） */
export function resolveDepartureAt(mode: DepartureMode, now = new Date()): Date | null {
  switch (mode) {
    case 'now': return now;
    case 'plus30': return new Date(now.getTime() + 30 * 60 * 1000);
    case 'plus60': return new Date(now.getTime() + 60 * 60 * 1000);
    case 'custom': return null;
  }
}

/** 由模式（+自定义时间）计算完整 DepartureState */
export function computeDepartureState(mode: DepartureMode, now?: Date, customAt?: Date): DepartureState {
  const base = mode === 'custom' ? customAt || new Date() : resolveDepartureAt(mode, now || new Date())!;
  return {
    departureMode: mode,
    departureAt: base.toISOString(),
    departureTimeLabel: formatDepartureLabel(base, mode),
  };
}

/** 展示文本：与真实值分离 */
export function formatDepartureLabel(date: Date, mode: DepartureMode): string {
  if (mode === 'now') return '现在出发';
  if (mode === 'plus30') return '30分钟后';
  if (mode === 'plus60') return '1小时后';

  const now = new Date();
  const isTomorrow =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate() + 1;
  if (isTomorrow) return `明天 ${formatTime(date)}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${formatTime(date)}`;
}

export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 构造本地时间（非 UTC），日期时间格式非法或 Invalid Date 返回 null */
export function parseCustomDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const date = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isValidDepartureAt(iso: string | undefined | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime());
}

/** 从 sessionStorage 恢复出发时间，无效回退「现在出发」 */
export function restoreDepartureState(): DepartureState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DepartureState;
      if (parsed && parsed.departureMode && isValidDepartureAt(parsed.departureAt)) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return computeDepartureState('now');
}

export function saveDepartureState(state: DepartureState): void {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/** 仅按 ISO 生成展示标签（用于结果页刷新恢复等无 mode 场景） */
export function labelForDepartureAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '现在出发';
  return formatDepartureLabel(d, 'custom');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
