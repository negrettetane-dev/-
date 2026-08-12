import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Smartphone, UserRound } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuthStore } from '../../stores/authStore';
import { AuthShell } from './AuthShell';
import { apiPost } from '../../services/apiClient';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithPassword, loginWithSms } = useAuthStore();

  // 验证码登录表单（仅手机号）
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  // 密码登录表单（用户名/手机号/邮箱）
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');

  const [mode, setMode] = useState<'code' | 'password'>('code');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = (location.state as any)?.from || '/';

  const sendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) { setError('请输入正确的手机号'); return; }
    try {
      await apiPost('/user/send-code', { phone });
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : '验证码发送失败');
      return;
    }
    setCountdown(60);
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleLogin = async () => {
    setError('');

    if (mode === 'code') {
      // 验证码登录：手机号 + 验证码，手机号格式校验
      if (!/^1[3-9]\d{9}$/.test(phone)) { setError('请输入正确的手机号'); return; }
      if (!code.trim()) { setError('请输入验证码'); return; }
      setLoading(true);
      const res = await loginWithSms(phone, code);
      setLoading(false);
      if (res.ok) navigate(from, { replace: true });
      else setError(res.error || '登录失败，请重试');
      return;
    }

    // 密码登录：用户名/手机号/邮箱 + 密码，仅判断非空
    if (!account.trim()) { setError('请输入账号'); return; }
    if (!password) { setError('请输入密码'); return; }
    setLoading(true);
    const res = await loginWithPassword(account.trim(), password);
    setLoading(false);
    if (res.ok) navigate(from, { replace: true });
    else setError(res.error || '账号或密码错误');
  };

  return (
    <AuthShell variant="login">
      <div className="mb-7">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Welcome back</div>
        <h2 className="m-0 text-[30px] font-semibold tracking-tight text-slate-950">欢迎登录</h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-slate-500">登录后体验完整的智慧出行与城市服务</p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="登录方式">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'code'}
          className={`rounded-lg border-0 px-3 py-2.5 text-sm font-medium transition ${mode === 'code' ? 'bg-white text-blue-700 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-800'}`}
          onClick={() => { setMode('code'); setError(''); }}
        >
          验证码登录
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'password'}
          className={`rounded-lg border-0 px-3 py-2.5 text-sm font-medium transition ${mode === 'password' ? 'bg-white text-blue-700 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-800'}`}
          onClick={() => { setMode('password'); setError(''); }}
        >
          密码登录
        </button>
      </div>

      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void handleLogin(); }}>
        {mode === 'code' ? (
          <>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">手机号码</span>
              <span className="relative block">
                <Smartphone className="pointer-events-none absolute inset-y-0 left-4 z-10 my-auto h-[18px] w-[18px] text-slate-400" />
                <Input className="pl-11" inputMode="tel" autoComplete="tel" placeholder="请输入手机号" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">短信验证码</span>
              <span className="relative block">
                <KeyRound className="pointer-events-none absolute inset-y-0 left-4 z-10 my-auto h-[18px] w-[18px] text-slate-400" />
                <Input className="pl-11 pr-32" inputMode="numeric" autoComplete="one-time-code" placeholder="请输入验证码" value={code} onChange={e => setCode(e.target.value)} maxLength={6} />
                <Button className="absolute right-1.5 top-1.5" size="sm" variant="ghost" onClick={sendCode} disabled={countdown > 0}>
                  {countdown > 0 ? `${countdown}s 后重试` : '获取验证码'}
                </Button>
              </span>
            </label>
          </>
        ) : (
          <>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">账号</span>
              <span className="relative block">
                <UserRound className="pointer-events-none absolute inset-y-0 left-4 z-10 my-auto h-[18px] w-[18px] text-slate-400" />
                <Input className="pl-11" autoComplete="username" placeholder="用户名 / 手机号 / 邮箱" value={account} onChange={e => setAccount(e.target.value)} />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">密码</span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute inset-y-0 left-4 z-10 my-auto h-[18px] w-[18px] text-slate-400" />
                <Input className="pl-11 pr-12" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="请输入密码" value={password} onChange={e => setPassword(e.target.value)} />
                <Button className="absolute right-1 top-1" size="icon" variant="ghost" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </Button>
              </span>
            </label>
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" className="h-12 w-full rounded-2xl text-[15px]" disabled={loading}>
          {loading ? '正在登录...' : <>登录 <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-slate-500">
        <span>还没有账号？</span>
        <button type="button" className="border-0 bg-transparent p-0 font-semibold text-blue-600 hover:text-blue-700" onClick={() => navigate('/register')}>立即注册</button>
        <span className="h-4 w-px bg-slate-200" />
        <button type="button" className="border-0 bg-transparent p-0 text-slate-500 hover:text-slate-900" onClick={() => navigate('/')}>游客浏览</button>
      </div>
    </AuthShell>
  );
};

export default LoginPage;
