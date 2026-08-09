import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import styles from './Auth.module.css';

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
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <div className={styles.authSide}>
          <div className={styles.sideLogo}>🚦</div>
          <h1 className={styles.sideTitle}>智途云枢</h1>
          <p className={styles.sideDesc}>基于多源数据融合与智能决策的<br/>城市智慧交通平台</p>
          <div className={styles.sideFeatures}>
            <div className={styles.sideFeature}>🗺️ 实时路况 · 一张图看全城</div>
            <div className={styles.sideFeature}>🧭 智能出行 · AI预判拥堵</div>
            <div className={styles.sideFeature}>📷 市民共治 · 一键上报问题</div>
            <div className={styles.sideFeature}>🌳 绿色出行 · 碳积分兑换</div>
          </div>
        </div>

        <div className={styles.authForm}>
          <h2 className={styles.formTitle}>欢迎登录</h2>
          <p className={styles.formSub}>登录后体验完整的智慧出行服务</p>

          <div className={styles.modeSwitch}>
            <button className={`${styles.modeBtn} ${mode === 'code' ? styles.modeActive : ''}`} onClick={() => { setMode('code'); setError(''); }}>验证码登录</button>
            <button className={`${styles.modeBtn} ${mode === 'password' ? styles.modeActive : ''}`} onClick={() => { setMode('password'); setError(''); }}>密码登录</button>
          </div>

          {mode === 'code' ? (
            <>
              <div className={styles.field}>
                <span className={styles.fieldIcon}>📱</span>
                <input className={styles.input} placeholder="请输入手机号" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} />
              </div>
              <div className={styles.field}>
                <span className={styles.fieldIcon}>🔢</span>
                <input className={styles.input} placeholder="请输入验证码" value={code} onChange={e => setCode(e.target.value)} maxLength={6} />
                <button className={styles.codeBtn} onClick={sendCode} disabled={countdown > 0}>
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.field}>
                <span className={styles.fieldIcon}>👤</span>
                <input className={styles.input} placeholder="请输入用户名 / 手机号 / 邮箱" value={account} onChange={e => setAccount(e.target.value)} />
              </div>
              <div className={styles.field}>
                <span className={styles.fieldIcon}>🔒</span>
                <input
                  className={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <span className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)} title={showPassword ? '隐藏密码' : '显示密码'}>
                  {showPassword ? '🙈' : '👁'}
                </span>
              </div>
            </>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submitBtn} onClick={handleLogin} disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </button>

          <div className={styles.authFooter}>
            <span>还没有账号？</span>
            <span className={styles.link} onClick={() => navigate('/register')}>立即注册</span>
            <span className={styles.divider}>|</span>
            <span className={styles.link} onClick={() => navigate('/')}>游客浏览</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
