import { create } from 'zustand';

export interface User {
  id: string;
  phone: string;
  nickname?: string;
  realName?: string;
  isVerified: boolean;
  carbonCredits: number;
  avatar?: string;
}

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  token: string | null;
  login: (phone: string, code: string) => Promise<boolean>;
  register: (data: { phone: string; code: string; password: string; nickname: string }) => Promise<boolean>;
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

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: !!stored.token,
  user: stored.user,
  token: stored.token,

  login: async (phone: string, code: string) => {
    try {
      const res = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (data.code === 0 && data.data?.token) {
        const user = data.data;
        localStorage.setItem('zhitu_token', user.token);
        localStorage.setItem('zhitu_user', JSON.stringify(user));
        set({ isLoggedIn: true, user, token: user.token });
        return true;
      }
      return false;
    } catch { return false; }
  },

  register: async ({ phone, code, password, nickname }) => {
    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, password, nickname }),
      });
      const data = await res.json();
      if (data.code === 0 && data.data?.token) {
        const user = data.data;
        localStorage.setItem('zhitu_token', user.token);
        localStorage.setItem('zhitu_user', JSON.stringify(user));
        set({ isLoggedIn: true, user, token: user.token });
        return true;
      }
      return false;
    } catch { return false; }
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
