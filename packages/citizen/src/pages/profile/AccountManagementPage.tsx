import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { maskPhone } from '@zhitu/shared';
import { useAuthStore } from '../../stores/authStore';
import { apiPost } from '../../services/apiClient';
import styles from './Profile.module.css';

type EditableField = 'nickname' | 'phone' | 'email';
type Action = EditableField | 'freeze' | 'cancel' | 'about' | 'privacy' | 'agreement' | null;

const policyContent = {
  about: ['平台介绍', '智途云枢是面向城市交通治理的智慧出行平台，融合多源交通数据与智能决策能力，为市民提供实时路况、出行规划、公交地铁、停车充电、事件上报、碳积分等一站式出行服务。'],
  privacy: ['隐私政策', '我们重视您的隐私保护。您的账号信息、位置数据仅用于提供出行服务，不会向无关第三方披露。详细隐私政策请以官网公示版本为准。'],
  agreement: ['用户协议', '使用智途云枢即表示您同意遵守平台服务条款。请勿利用平台进行违法违规活动，事件上报请确保信息真实准确，恶意上报需承担相应责任。'],
} as const;

const actionTitle = (action: Exclude<Action, null>) => {
  if (action === 'nickname') return '修改昵称';
  if (action === 'phone') return '修改手机号';
  if (action === 'email') return '绑定邮箱';
  if (action === 'freeze') return '账号冻结';
  if (action === 'cancel') return '账号注销';
  return policyContent[action][0];
};

const AccountManagementPage: React.FC<{ mode?: 'password' }> = ({ mode }) => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const [action, setAction] = useState<Action>(null);
  const [nickname, setNickname] = useState(user?.nickname || user?.username || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [notice, setNotice] = useState('');
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneCountdown, setPhoneCountdown] = useState(0);

  const close = () => setAction(null);
  const save = (field: EditableField) => {
    const value = field === 'nickname' ? nickname.trim() : field === 'phone' ? phone.trim() : email.trim();
    const invalidPhone = field === 'phone' && !/^1\d{10}$/.test(value);
    const invalidNickname = field === 'nickname' && value.length > 15;
    if (field === 'phone' && (!phoneCodeSent || !/^\d{6}$/.test(phoneCode))) {
      setNotice('请先获取验证码，并输入 6 位验证码。');
      return;
    }
    const invalidEmail = field === 'email' && !/^\S+@\S+\.\S+$/.test(value);
    if (!value || invalidPhone || invalidEmail || invalidNickname) {
      setNotice(invalidNickname ? '昵称不能超过 15 个字符。' : '请填写正确的资料后再保存。');
      return;
    }
    updateUser({ [field]: value });
    close();
    setNotice(field === 'email' ? '邮箱已在本地账号信息中更新，正式绑定需后端验证码确认。' : '已保存到本地账号信息。');
  };

  const sendPhoneCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setNotice('请输入正确的新手机号。');
      return;
    }
    try {
      await apiPost('/user/send-code', { phone });
      setPhoneCodeSent(true);
      setPhoneCountdown(60);
      const timer = window.setInterval(() => {
        setPhoneCountdown(current => {
          if (current <= 1) {
            window.clearInterval(timer);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
      setNotice('验证码已发送，请输入短信中的 6 位验证码。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '验证码发送失败，请稍后重试。');
    }
  };

  if (mode === 'password') {
    const savePassword = () => {
      if (!password.current || password.next.length < 6 || password.next !== password.confirm) {
        setNotice('请填写当前密码，新密码至少 6 位且两次输入一致。');
        return;
      }
      setNotice('密码修改界面已完成，正式保存需要后端接口。');
    };

    return (
      <div className={styles.accountPage}>
        <header className={styles.pageHeader}>
          <button type="button" className={styles.backButton} onClick={() => navigate('/profile/account')}>←</button>
          <div className={styles.pageTitle}>修改登录密码</div>
        </header>
        <section className={styles.accountSection}>
          <div className={styles.accountForm}>
            <p className={styles.accountFormTitle}>设置新的登录密码</p>
            <p className={styles.accountNotice}>当前为前端流程预览；正式保存需要后端验证当前密码并使旧登录状态失效。</p>
            {(['current', 'next', 'confirm'] as const).map(field => (
              <label className={styles.fieldGroup} key={field}>
                <span className={styles.fieldLabel}>{field === 'current' ? '当前密码' : field === 'next' ? '新密码' : '确认新密码'}</span>
                <input className={styles.fieldInput} type="password" value={password[field]} onChange={event => setPassword(old => ({ ...old, [field]: event.target.value }))} />
              </label>
            ))}
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => navigate('/profile/account')}>取消</button>
              <button type="button" className={styles.primaryButton} onClick={savePassword}>确认修改</button>
            </div>
          </div>
        </section>
        {notice && <p className={styles.accountNotice}>{notice}</p>}
      </div>
    );
  }

  const accountRows: Array<{ key: Action | 'password'; icon: string; label: string; hint: string }> = [
    { key: 'nickname', icon: '✏️', label: '昵称', hint: user?.nickname || user?.username || '未设置' },
    { key: 'phone', icon: '📱', label: '手机号', hint: user?.phone ? maskPhone(user.phone) : '未绑定' },
    { key: 'password', icon: '🔐', label: '登录密码', hint: '点击跳转修改' },
    { key: 'email', icon: '✉️', label: '绑定邮箱', hint: user?.email || '未绑定' },
  ];

  return (
    <div className={styles.accountPage}>
      <header className={styles.pageHeader}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/profile')}>←</button>
        <div className={styles.pageTitle}>账号管理</div>
      </header>
      {notice && <p className={styles.accountNotice}>{notice}</p>}
      <section className={styles.accountSection}>
        <div className={styles.accountSectionTitle}>账号资料</div>
        {accountRows.map(row => (
          <div className={styles.accountRow} key={row.key} onClick={() => row.key === 'password' ? navigate('/profile/account/password') : setAction(row.key)}>
            <span className={styles.accountRowIcon}>{row.icon}</span>
            <div className={styles.accountRowBody}><div className={styles.accountRowLabel}>{row.label}</div><div className={styles.accountRowHint}>{row.hint}</div></div>
            <span className={styles.accountRowAction}>›</span>
          </div>
        ))}
      </section>
      <section className={styles.accountSection}>
        <div className={styles.accountSectionTitle}>协议与信息</div>
        {(['about', 'privacy', 'agreement'] as const).map(key => (
          <div className={styles.accountRow} key={key} onClick={() => setAction(key)}>
            <span className={styles.accountRowIcon}>{key === 'about' ? 'ℹ️' : key === 'privacy' ? '🛡️' : '📄'}</span>
            <div className={styles.accountRowBody}><div className={styles.accountRowLabel}>{policyContent[key][0]}</div><div className={styles.accountRowHint}>{key === 'about' ? '平台介绍与版本信息' : '点击阅读'}</div></div>
            <span className={styles.accountRowAction}>›</span>
          </div>
        ))}
      </section>
      <section className={styles.accountSection}>
        <div className={styles.accountSectionTitle}>账号安全</div>
        {([['freeze', '❄️', '账号冻结', '临时停止账号登录和使用'], ['cancel', '🗑️', '账号注销', '永久删除或匿名化账号数据']] as const).map(([key, icon, label, hint]) => (
          <div className={`${styles.accountRow} ${styles.accountRowDanger}`} key={key} onClick={() => setAction(key)}>
            <span className={styles.accountRowIcon}>{icon}</span><div className={styles.accountRowBody}><div className={styles.accountRowLabel}>{label}</div><div className={styles.accountRowHint}>{hint}</div></div><span className={styles.accountRowAction}>›</span>
          </div>
        ))}
      </section>
      <section className={styles.accountSection}><button type="button" className={styles.accountLogout} onClick={() => { if (window.confirm('确定要退出当前账号吗？')) logout(); }}>退出账号</button></section>
      {action && (
        <div className={styles.accountModalMask} onClick={close}>
          <div className={styles.accountModal} role="dialog" aria-modal="true" aria-label={actionTitle(action)} onClick={event => event.stopPropagation()}>
            <div className={styles.accountModalHeader}><span>{actionTitle(action)}</span><button type="button" className={styles.modalClose} onClick={close}>×</button></div>
            <div className={styles.accountModalBody}>
              {action === 'nickname' && <label className={styles.fieldGroup}><span className={styles.fieldLabel}>昵称（最多 15 个字符）</span><input className={styles.fieldInput} value={nickname} maxLength={15} onChange={event => setNickname(event.target.value)} /></label>}
              {action === 'phone' && <>
                <label className={styles.fieldGroup}><span className={styles.fieldLabel}>新手机号</span><input className={styles.fieldInput} inputMode="numeric" value={phone} maxLength={11} onChange={event => { setPhone(event.target.value.replace(/\D/g, '')); setPhoneCodeSent(false); }} /></label>
                <label className={styles.fieldGroup}><span className={styles.fieldLabel}>短信验证码</span><span className={styles.codeField}><input className={styles.fieldInput} inputMode="numeric" value={phoneCode} maxLength={6} onChange={event => setPhoneCode(event.target.value.replace(/\D/g, ''))} /><button type="button" className={styles.codeButton} onClick={sendPhoneCode} disabled={phoneCountdown > 0}>{phoneCountdown > 0 ? `${phoneCountdown}s 后重试` : '获取验证码'}</button></span></label>
              </>}
              {action === 'email' && <label className={styles.fieldGroup}><span className={styles.fieldLabel}>邮箱地址</span><input className={styles.fieldInput} type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>}
              {action === 'freeze' && <p>冻结后应立即限制账号登录并使当前会话失效。当前为前端预览，不会实际冻结账号。</p>}
              {action === 'cancel' && <p>注销是不可逆操作，正式操作前需二次验证和明确数据处理策略。当前为前端预览，不会实际注销账号。</p>}
              {action in policyContent && <p>{policyContent[action as keyof typeof policyContent][1]}</p>}
            </div>
            <div className={styles.accountModalFooter}>
              {action === 'nickname' || action === 'phone' || action === 'email' ? <button type="button" className={styles.primaryButton} onClick={() => save(action)}>保存</button> : <button type="button" className={styles.secondaryButton} onClick={close}>我知道了</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagementPage;
