import { create } from 'zustand';
import { apiGet, apiPost } from '../services/apiClient';
import { clearPersonalData } from './persistence';
import { clearTravelOriginCache } from './travelLocationStore';
import { useTripStore } from './tripStore';
import { useReservationStore } from './reservationStore';
import { useTravelPlanStore } from './travelPlanStore';

export interface User {
  id: string;
  username?: string;
  phone: string;
  email?: string;
  nickname?: string;
  realName?: string;
  role?: 'user' | 'admin';
  isVerified: boolean;
  carbonCredits: number;
  avatar?: string;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  fieldError?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'guest' | 'expired';

interface AuthState {
  isLoggedIn: boolean;
  isAuthenticated: boolean;
  authStatus: AuthStatus;
  user: User | null;
  token: string | null;
  loginWithPassword: (account: string, password: string) => Promise<LoginResult>;
  loginWithSms: (phone: string, code: string) => Promise<LoginResult>;
  register: (data: { username: string; phone: string; email: string; password: string; nickname: string }) => Promise<LoginResult>;
  logout: () => void;
  markSessionExpired: () => void;
  updateUser: (user: Partial<User>) => void;
  refreshProfile: () => Promise<void>;
}

const stored = (() => {
  try {
    const token = localStorage.getItem('zhitu_token');
    const rawUser = localStorage.getItem('zhitu_user');
    return { token, user: rawUser ? JSON.parse(rawUser) as User : null };
  } catch {
    return { token: null, user: null };
  }
})();

function persistLogin(user: User, token: string) {
  localStorage.setItem('zhitu_token', token);
  localStorage.setItem('zhitu_user', JSON.stringify(user));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** 标准化后端用户数据 → 前端 User（兼容 /api/auth/login 与 /api/user/register 字段差异） */
function normalizeUser(raw: Partial<User> & Record<string, unknown>): User {
  return {
    id: String(raw.id ?? ''),
    username: raw.username ?? '',
    phone: raw.phone ?? '',
    email: raw.email ?? '',
    nickname: raw.nickname ?? raw.username ?? '市民用户',
    realName: raw.realName,
    role: (raw.role as User['role']) ?? 'user',
    isVerified: raw.isVerified ?? true,
    carbonCredits: Number(raw.carbonCredits ?? 0),
    avatar: raw.avatar,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: Boolean(stored.token),
  isAuthenticated: Boolean(stored.token),
  authStatus: stored.token ? 'authenticated' : 'guest',
  user: stored.user,
  token: stored.token,

  loginWithPassword: async (account, password) => {
    try {
      // 真实后端登录接口：POST /api/auth/login（返回 JWT + 完整用户信息）
      const data = await apiPost<Partial<User> & Record<string, unknown> & { token: string }>(
        '/auth/login',
        { account, password },
      );
      const user = normalizeUser(data);
      persistLogin(user, data.token);
      set({ isLoggedIn: true, isAuthenticated: true, authStatus: 'authenticated', user, token: data.token });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error, '登录失败，请重试') };
    }
  },

  loginWithSms: async (phone, code) => {
    try {
      // 真实后端：POST /api/auth/verify-code { phone, code }（校验验证码；未注册手机号自动注册）
      const data = await apiPost<Partial<User> & Record<string, unknown> & { token: string }>(
        '/auth/verify-code',
        { phone, code },
      );
      const user = normalizeUser(data);
      persistLogin(user, data.token);
      set({ isLoggedIn: true, isAuthenticated: true, authStatus: 'authenticated', user, token: data.token });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error, '验证码登录失败，请重试') };
    }
  },

  register: async ({ username, phone, email, password, nickname }) => {
    try {
      // 后端仅提供 /api/user/register（兼容接口，token 为演示值）
      const data = await apiPost<Partial<User> & Record<string, unknown> & { token: string }>(
        '/user/register',
        { username, phone, email, password },
      );
      const user = { ...normalizeUser(data), nickname: data.nickname || nickname || username };
      persistLogin(user, data.token);
      set({ isLoggedIn: true, isAuthenticated: true, authStatus: 'authenticated', user, token: data.token });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error, '注册失败，请重试') };
    }
  },

  logout: () => {
    // 清 Token 与用户状态，同时清理个人作用域缓存（防止 A/B 用户串号）
    localStorage.removeItem('zhitu_token');
    localStorage.removeItem('zhitu_user');
    clearPersonalData();
    clearTravelOriginCache();
    useTripStore.getState().reset();
    useReservationStore.getState().clearUserReservationData();
    useTravelPlanStore.getState().clear();
    set({ isLoggedIn: false, isAuthenticated: false, authStatus: 'guest', user: null, token: null });
  },

  markSessionExpired: () => {
    localStorage.removeItem('zhitu_token');
    localStorage.removeItem('zhitu_user');
    useTripStore.getState().reset();
    // Token 失效时保留 pendingReservation，供重新登录后继续确认。
    useReservationStore.getState().setReservationsCache([]);
    set({ isLoggedIn: false, isAuthenticated: false, authStatus: 'expired', user: null, token: null });
  },

  updateUser: (patch) => {
    const current = get().user;
    if (!current) return;
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<User>;
    const user = { ...current, ...definedPatch };
    localStorage.setItem('zhitu_user', JSON.stringify(user));
    set({ user });
  },

  refreshProfile: async () => {
    if (!get().token) return;
    try {
      const profile = await apiGet<Partial<User>>('/user/profile');
      get().updateUser(profile);
    } catch {
      // Token 失效 → 标记 expired，页面据此清除并跳转登录
      localStorage.removeItem('zhitu_token');
      localStorage.removeItem('zhitu_user');
      useTripStore.getState().reset();
      set({ isLoggedIn: false, isAuthenticated: false, authStatus: 'expired', user: null, token: null });
    }
  },
}));
