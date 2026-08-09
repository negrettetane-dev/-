import { create } from 'zustand';

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

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  token: string | null;
  /** 密码登录：account 支持 用户名/手机号/邮箱 */
  loginWithPassword: (account: string, password: string) => Promise<LoginResult>;
  /** 验证码登录：仅手机号 */
  loginWithSms: (phone: string, code: string) => Promise<LoginResult>;
  /** 注册：用户名 + 手机号 + 邮箱 + 密码 */
  register: (data: { username: string; phone: string; email: string; password: string; nickname: string }) => Promise<LoginResult>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

// 初始化时从 localStorage 恢复
const stored = (() => {
  try {
    const token = localStorage.getItem('zhitu_token');
    const user = localStorage.getItem('zhitu_user');
    return { token, user: user ? JSON.parse(user) : null };
  } catch { return { token: null, user: null }; }
})();

function persistLogin(user: User, token: string) {
  localStorage.setItem('zhitu_token', token);
  localStorage.setItem('zhitu_user', JSON.stringify(user));
  return { user, token };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: !!stored.token,
  user: stored.user,
  token: stored.token,

  loginWithPassword: async (account, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password }),
      });
      const data = await res.json();
      if (data.code === 0 && data.data?.token) {
        const u = data.data;
        const { user, token } = persistLogin(u, u.token);
        set({ isLoggedIn: true, user, token });
        return { ok: true };
      }
      return { ok: false, error: data.message || '账号或密码错误' };
    } catch {
      return { ok: false, error: '登录失败，请重试' };
    }
  },

  loginWithSms: async (phone, code) => {
    try {
      const res = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (data.code === 0 && data.data?.token) {
        const u = data.data;
        const { user, token } = persistLogin(u, u.token);
        set({ isLoggedIn: true, user, token });
        return { ok: true };
      }
      return { ok: false, error: data.message || '登录失败，请重试' };
    } catch {
      return { ok: false, error: '登录失败，请重试' };
    }
  },

  register: async ({ username, phone, email, password, nickname }) => {
    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, phone, email, password, nickname }),
      });
      const data = await res.json();
      if (data.code === 0 && data.data?.token) {
        const u = data.data;
        const { user, token } = persistLogin(u, u.token);
        set({ isLoggedIn: true, user, token });
        return { ok: true };
      }
      // 重复错误：区分具体字段
      if (data.code === 'username_exists') return { ok: false, fieldError: 'username', error: data.message };
      if (data.code === 'phone_exists') return { ok: false, fieldError: 'phone', error: data.message };
      if (data.code === 'email_exists') return { ok: false, fieldError: 'email', error: data.message };
      return { ok: false, error: data.message || '注册失败，请重试' };
    } catch {
      return { ok: false, error: '注册失败，请重试' };
    }
  },

  logout: () => {
    localStorage.removeItem('zhitu_token');
    localStorage.removeItem('zhitu_user');
    set({ isLoggedIn: false, user: null, token: null });
  },

  updateUser: (userPatch) => {
    const cur = get().user;
    if (!cur) return;
    const next = { ...cur, ...userPatch };
    localStorage.setItem('zhitu_user', JSON.stringify(next));
    set({ user: next });
  },
}));
