import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateTransitQr, type QrState } from '../../services/qrCodeService';
import { useAuthStore } from '../../stores/authStore';
import DemoQrCode from '../../components/DemoQrCode';
import styles from './QRCode.module.css';

const QR_VALIDITY = 60; // 秒

const QRCodePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?.id || '';
  const [mode, setMode] = useState<'bus' | 'metro'>('bus');
  const [faqOpen, setFaqOpen] = useState(false);

  // 公交码 / 地铁码完全独立
  const [busQr, setBusQr] = useState<QrState>(() => generateTransitQr('bus', userId));
  const [metroQr, setMetroQr] = useState<QrState>(() => generateTransitQr('metro', userId));
  const [busCountdown, setBusCountdown] = useState(QR_VALIDITY);
  const [metroCountdown, setMetroCountdown] = useState(QR_VALIDITY);

  const activeQr = mode === 'bus' ? busQr : metroQr;
  const activeCountdown = mode === 'bus' ? busCountdown : metroCountdown;

  // 公交码独立倒计时
  useEffect(() => {
    const t = setInterval(() => {
      setBusCountdown(prev => {
        if (prev <= 1) {
          setBusQr(generateTransitQr('bus', userId));
          return QR_VALIDITY;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [userId]);

  // 地铁码独立倒计时
  useEffect(() => {
    const t = setInterval(() => {
      setMetroCountdown(prev => {
        if (prev <= 1) {
          setMetroQr(generateTransitQr('metro', userId));
          return QR_VALIDITY;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [userId]);

  const refreshActive = useCallback(() => {
    if (mode === 'bus') {
      setBusQr(generateTransitQr('bus', userId));
      setBusCountdown(QR_VALIDITY);
    } else {
      setMetroQr(generateTransitQr('metro', userId));
      setMetroCountdown(QR_VALIDITY);
    }
  }, [mode, userId]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.back} onClick={() => navigate(-1)}>← 返回</span>
        <span className={styles.title}>统一乘车码</span>
        <span className={styles.help} onClick={() => setFaqOpen(!faqOpen)}>❓</span>
      </div>

      {/* 模式切换 */}
      <div className={styles.modeSwitch}>
        <button className={`${styles.modeBtn} ${mode === 'bus' ? styles.modeActive : ''}`} onClick={() => setMode('bus')}>
          🚌 公交码
          {busCountdown <= 10 && <span style={{ marginLeft: 4, fontSize: 11, color: '#f5222d' }}>{busCountdown}s</span>}
        </button>
        <button className={`${styles.modeBtn} ${mode === 'metro' ? styles.modeActive : ''}`} onClick={() => setMode('metro')}>
          🚇 地铁码
          {metroCountdown <= 10 && <span style={{ marginLeft: 4, fontSize: 11, color: '#f5222d' }}>{metroCountdown}s</span>}
        </button>
      </div>

      {/* 二维码区 */}
      <div className={styles.qrCard}>
        <div className={styles.qrLabel}>
          {mode === 'bus' ? '🚌 北京公交' : '🚇 北京地铁'} · 演示乘车码
        </div>
        <div className={styles.qrBox}>
          <DemoQrCode content={activeQr.content} className={styles.qrSvg} />
          {activeCountdown <= 10 && (
            <div className={styles.qrOverlay}>
              <span>即将过期</span>
              <span onClick={refreshActive} style={{ cursor: 'pointer', color: '#1677ff', textDecoration: 'underline' }}>点击刷新</span>
            </div>
          )}
        </div>
        <div className={styles.qrTimer}>
          ⏱️ 二维码有效 <b style={{ color: activeCountdown <= 10 ? '#f5222d' : '#52c41a' }}>{activeCountdown}s</b> · 自动刷新
        </div>
        <button
          type="button"
          onClick={refreshActive}
          style={{
            marginTop: 10,
            padding: '8px 22px',
            border: '1px solid #1677ff',
            borderRadius: 18,
            background: '#fff',
            color: '#1677ff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🔄 刷新二维码
        </button>
        <div style={{ marginTop: 8, padding: '6px 10px', background: '#fffbe6', borderRadius: 6, fontSize: 11, color: '#ad6800' }}>
          ⚠️ 当前为演示二维码（{activeQr.content.slice(0, 28)}...），不能用于真实乘车支付
        </div>
      </div>

      <div className={styles.balanceCard} style={{ flexDirection: 'column', gap: 8, padding: '18px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>账户余额与乘车记录服务暂未接入</div>
        <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>当前页面仅提供明确标记的演示乘车码，不展示固定用户数据。</div>
      </div>

      {/* FAQ 居中弹窗 */}
      {faqOpen && (
        <div className={styles.faqOverlay} onClick={() => setFaqOpen(false)}>
          <div className={styles.faqModal} onClick={e => e.stopPropagation()}>
            <div className={styles.faqHeader}>
              <span>💡 使用帮助</span>
              <span className={styles.faqClose} onClick={() => setFaqOpen(false)}>✕</span>
            </div>
            <div className={styles.faqItem}><b>Q:</b> 公交码和地铁码内容相同吗？</div>
            <div className={styles.faqItem}><b>A:</b> 完全不同。公交码内容以 ZHITU-DEMO-BUS 开头，地铁码以 ZHITU-DEMO-METRO 开头，各自独立计时刷新。</div>
            <div className={styles.faqItem}><b>Q:</b> 为什么二维码会过期？</div>
            <div className={styles.faqItem}><b>A:</b> 为防止截屏盗刷，二维码每60秒自动刷新。公交码和地铁码互不影响。</div>
            <div className={styles.faqItem}><b>Q:</b> 这是官方乘车码吗？</div>
            <div className={styles.faqItem}><b>A:</b> 不是。当前为演示二维码，仅用于功能展示，不能用于真实乘车支付。</div>
            <button className={styles.faqBtn} onClick={() => setFaqOpen(false)}>知道了</button>
          </div>
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
};

export default QRCodePage;
