import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, AtSign, Eye, EyeOff, KeyRound, LockKeyhole, Smartphone, Tag, UserRound } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuthStore } from '../../stores/authStore';
import { AuthShell } from './AuthShell';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuthStore();

  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendCode = () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) { setError('请输入正确的手机号'); return; }
    fetch('/api/user/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
    setError('');
    setCountdown(60);
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleRegister = async () => {
    setError('');
    if (!username.trim()) { setError('请输入用户名'); return; }
    if (!/^1[3-9]\d{9}$/.test(phone)) { setError('请输入正确的手机号'); return; }
    if (email.trim() && !/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(email.trim())) { setError('请输入正确的邮箱'); return; }
    if (!code.trim()) { setError('请输入验证码'); return; }
    if (password.length < 6) { setError('密码至少6位'); return; }
    if (password !== confirmPwd) { setError('两次密码不一致'); return; }
    if (!agree) { setError('请阅读并同意用户协议'); return; }

    setLoading(true);
    const res = await register({
      username: username.trim(),
      phone,
      email: email.trim(),
      password,
      nickname: nickname.trim() || username.trim(),
    });
    setLoading(false);
    if (res.ok) {
      alert('注册成功！欢迎加入智途云枢');
      navigate('/profile');
    } else {
      // 重复错误精确提示
      if (res.fieldError === 'username') setError('该用户名已存在');
      else if (res.fieldError === 'phone') setError('该手机号已注册');
      else if (res.fieldError === 'email') setError('该邮箱已注册');
      else setError(res.error || '注册失败，请重试');
    }
  };

  return (
    <AuthShell variant="register">
      <div className="mb-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Join us</div>
        <h2 className="m-0 text-[30px] font-semibold tracking-tight text-slate-950">创建账号</h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-slate-500">几步完成注册，开启更聪明的城市出行体验</p>
      </div>

      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void handleRegister(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">用户名 <span className="text-red-500">*</span></span>
            <span className="relative block">
              <UserRound className="pointer-events-none absolute inset-y-0 left-4 z-10 my-auto h-[18px] w-[18px] text-slate-400" />
              <Input className="pl-11" autoComplete="username" placeholder="登录使用，保持唯一" value={username} onChange={e => setUsername(e.target.value)} maxLength={20} />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">昵称 <span className="font-normal text-slate-400">选填</span></span>
            <span className="relative block">
              <Tag className="pointer-events-none absolute inset-y-0 left-4 z-10 my-auto h-[18px] w-[18px] text-slate-400" />
              <Input className="pl-11" placeholder="用于页面展示" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={20} />
            </span>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">手机号码 <span className="text-red-500">*</span></span>
            <span className="relative block">
              <Smartphone className="pointer-events-none absolute inset-y-0 left-4 z-10 my-auto h-[18px] w-[18px] text-slate-400" />
              <Input className="pl-11" inputMode="tel" autoComplete="tel" placeholder="11 位手机号码" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">电子邮箱 <span className="font-normal text-slate-400">选填</span></span>
            <span className="relative block">
              <AtSign className="pointer-events-none absolute inset-y-0 left-4 z-10 my-auto h-[18px] w-[18px] text-slate-400" />
              <Input className="pl-11" type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </span>
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">短信验证码 <span className="text-red-500">*</span></span>
          <span className="relative block">
            <KeyRound className="pointer-events-none absolute inset-y-0 left-4 z-10 my-auto h-[18px] w-[18px] text-slate-400" />
            <Input className="pl-11 pr-32" inputMode="numeric" autoComplete="one-time-code" placeholder="请输入验证码" value={code} onChange={e => setCode(e.target.value)} maxLength={6} />
            <Button className="absolute right-1.5 top-1.5" size="sm" variant="ghost" onClick={sendCode} disabled={countdown > 0}>
              {countdown > 0 ? `${countdown}s 后重试` : '获取验证码'}
            </Button>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">设置密码 <span className="text-red-500">*</span></span>
            <span className="relative block">
              <LockKeyhole className="pointer-events-none absolute inset-y-0 left-4 z-10 my-auto h-[18px] w-[18px] text-slate-400" />
              <Input className="pl-11 pr-12" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="至少 6 位" value={password} onChange={e => setPassword(e.target.value)} />
              <Button className="absolute right-1 top-1" size="icon" variant="ghost" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </Button>
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">确认密码 <span className="text-red-500">*</span></span>
            <span className="relative block">
              <LockKeyhole className="pointer-events-none absolute inset-y-0 left-4 z-10 my-auto h-[18px] w-[18px] text-slate-400" />
              <Input className="pl-11" type="password" autoComplete="new-password" placeholder="再次输入密码" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
            </span>
          </label>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50/50">
          <input className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
          <span className="leading-5">我已阅读并同意 <button type="button" className="border-0 bg-transparent p-0 font-medium text-blue-600">《用户协议》</button> 和 <button type="button" className="border-0 bg-transparent p-0 font-medium text-blue-600">《隐私政策》</button></span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" className="h-12 w-full rounded-2xl text-[15px]" disabled={loading}>
          {loading ? '正在创建账号...' : <>创建账号 <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-500">
        <span>已有账号？</span>
        <button type="button" className="border-0 bg-transparent p-0 font-semibold text-blue-600 hover:text-blue-700" onClick={() => navigate('/login')}>返回登录</button>
      </div>
    </AuthShell>
  );
};

export default RegisterPage;
