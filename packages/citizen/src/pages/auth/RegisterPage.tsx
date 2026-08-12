import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import styles from './Auth.module.css';
import { apiPost } from '../../services/apiClient';

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
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <div className={styles.authSide}>
          <div className={styles.sideLogo}>🚦</div>
          <h1 className={styles.sideTitle}>智途云枢</h1>
          <p className={styles.sideDesc}>加入智慧交通<br/>让出行更简单、更绿色</p>
          <div className={styles.sideStats}>
            <div className={styles.sideStat}><div className={styles.sideStatNum}>50万+</div><div>注册用户</div></div>
            <div className={styles.sideStat}><div className={styles.sideStatNum}>5000+</div><div>合作停车场</div></div>
            <div className={styles.sideStat}><div className={styles.sideStatNum}>98%</div><div>问题处置率</div></div>
          </div>
        </div>

        <div className={styles.authForm}>
          <h2 className={styles.formTitle}>创建账号</h2>
          <p className={styles.formSub}>注册成为智途云枢用户</p>

          <div className={styles.field}>
            <span className={styles.fieldIcon}>👤</span>
            <input className={styles.input} placeholder="用户名（登录用，唯一）" value={username} onChange={e => setUsername(e.target.value)} maxLength={20} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldIcon}>🏷️</span>
            <input className={styles.input} placeholder="昵称（选填）" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={20} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldIcon}>📱</span>
            <input className={styles.input} placeholder="请输入手机号" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldIcon}>📧</span>
            <input className={styles.input} placeholder="邮箱（选填）" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldIcon}>🔢</span>
            <input className={styles.input} placeholder="请输入验证码" value={code} onChange={e => setCode(e.target.value)} maxLength={6} />
            <button className={styles.codeBtn} onClick={sendCode} disabled={countdown > 0}>
              {countdown > 0 ? `${countdown}s` : '获取验证码'}
            </button>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldIcon}>🔒</span>
            <input
              className={styles.input}
              type={showPassword ? 'text' : 'password'}
              placeholder="设置密码(至少6位)"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <span className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>{showPassword ? '🙈' : '👁'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldIcon}>🔒</span>
            <input className={styles.input} type="password" placeholder="确认密码" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
          </div>

          <div className={styles.agreeRow}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span className={styles.agreeText}>
              我已阅读并同意 <span className={styles.link}>《用户协议》</span> 和 <span className={styles.link}>《隐私政策》</span>
            </span>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submitBtn} onClick={handleRegister} disabled={loading}>
            {loading ? '注册中...' : '注 册'}
          </button>

          <div className={styles.authFooter}>
            <span>已有账号？</span>
            <span className={styles.link} onClick={() => navigate('/login')}>去登录</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
