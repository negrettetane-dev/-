// ===== 用户相关 =====

export interface User {
  id: string;
  phone: string;
  nickname?: string;
  avatar?: string;
  realName?: string;
  idCard?: string;
  isVerified: boolean; // 是否已实名
  carbonCredits: number;
}

export interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  token: string | null;
}

/** 通知消息 */
export interface Notification {
  id: string;
  type: 'congestion' | 'weather' | 'control' | 'workorder' | 'system';
  title: string;
  content: string;
  read: boolean;
  createTime: number;
  link?: string; // 点击跳转路由
}

/** 通知设置 */
export interface NotificationSettings {
  congestionAlert: boolean;
  weatherAlert: boolean;
  controlAlert: boolean;
  workorderProgress: boolean;
  systemNotice: boolean;
}
