// ===== 管理端管理员认证 =====
// 登录接口：POST /api/admin/auth/login（apiClient baseURL 为 /api/admin）
// 返回 { accessToken, refreshToken, admin }，前端用 Bearer <accessToken>

import { apiPost } from '../services/apiClient';

export interface AdminInfo {
  id: string;
  account: string;
  realName: string;
  phone?: string;
  role: string;
}

export interface AdminLoginResult {
  ok: boolean;
  error?: string;
  admin?: AdminInfo;
  accessToken?: string;
}

const TOKEN_KEY = 'zhitu_admin_token';
const INFO_KEY = 'zhitu_admin_info';

/** 管理员登录 */
export async function adminLogin(account: string, password: string): Promise<AdminLoginResult> {
  try {
    const data = await apiPost<{
      accessToken: string;
      refreshToken: string;
      admin: AdminInfo;
    }>('/auth/login', { account, password });

    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(INFO_KEY, JSON.stringify(data.admin));
    return { ok: true, admin: data.admin, accessToken: data.accessToken };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error && error.message ? error.message : '登录失败，请重试',
    };
  }
}

/** 是否已登录（存在 accessToken） */
export function isAdminLoggedIn(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

/** 获取当前管理员信息 */
export function getAdminInfo(): AdminInfo | null {
  try {
    const raw = localStorage.getItem(INFO_KEY);
    return raw ? (JSON.parse(raw) as AdminInfo) : null;
  } catch {
    return null;
  }
}

/** 退出登录 */
export function adminLogout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(INFO_KEY);
}
