import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateQr, type QrState } from '../../services/qrCodeService';
import styles from './QRCode.module.css';

/** 生成伪随机二维码图案（SVG模拟, 非真实编码）*/
function makePattern(seed: string): number[][] {
  let h = 0;
  const hash = (s: string) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 100000; return x; };
  const base = hash(seed);
  return Array.from({ length: 21 }, (_, y) =>
    Array.from({ length: 21 }, (_, x) => {
      if (x < 7 && y < 7) return 1;
      if (x > 13 && y < 7) return 1;
      if (x < 7 && y > 13) return 1;
      h = (Math.sin(x * 7 + y * 13 + base) * 10000) % 1;
      return h > 0.35 ? 1 : 0;
    })
  );
}

const QR_VALIDITY = 60; // 秒

const QRCodePage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'bus' | 'metro'>('bus');
  const [faqOpen, setFaqOpen] = useState(false);

  // 公交码 / 地铁码完全独立
  const [busQr, setBusQr] = useState<QrState>(() => generateQr('bus'));
  const [metroQr, setMetroQr] = useState<QrState>(() => generateQr('metro'));
  const [busCountdown, setBusCountdown] = useState(QR_VALIDITY);
  const [metroCountdown, setMetroCountdown] = useState(QR_VALIDITY);

  const activeQr = mode === 'bus' ? busQr : metroQr;
  const activeCountdown = mode === 'bus' ? busCountdown : metroCountdown;
  const activePattern = useRef(makePattern(busQr.content));
  activePattern.current = makePattern(activeQr.content);

  // 公交码独立倒计时
  useEffect(() => {
    const t = setInterval(() => {
      setBusCountdown(prev => {
        if (prev <= 1) {
          const q = generateQr('bus');
          setBusQr(q);
          return QR_VALIDITY;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // 地铁码独立倒计时
  useEffect(() => {
    const t = setInterval(() => {
      setMetroCountdown(prev => {
        if (prev <= 1) {
          const q = generateQr('metro');
          setMetroQr(q);
          return QR_VALIDITY;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const refreshActive = useCallback(() => {
    if (mode === 'bus') {
      setBusQr(generateQr('bus'));
      setBusCountdown(QR_VALIDITY);
    } else {
      setMetroQr(generateQr('metro'));
      setMetroCountdown(QR_VALIDITY);
    }
  }, [mode]);

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
          <svg viewBox="0 0 21 21" className={styles.qrSvg}>
            {activePattern.current.map((row, y) =>
              row.map((cell, x) =>
                cell ? <rect key={`${y}-${x}`} x={x} y={y} width="1" height="1" fill="#000" /> : null
              )
            )}
          </svg>
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
        <div style={{ marginTop: 8, padding: '6px 10px', background: '#fffbe6', borderRadius: 6, fontSize: 11, color: '#ad6800' }}>
          ⚠️ 当前为演示二维码（{activeQr.content.slice(0, 28)}...），不能用于真实乘车支付
        </div>
      </div>

      {/* 余额信息 */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceItem}>
          <span className={styles.balanceLabel}>公交余额</span>
          <span className={styles.balanceValue}>¥ 38.50</span>
        </div>
        <div className={styles.balanceDivider} />
        <div className={styles.balanceItem}>
          <span className={styles.balanceLabel}>地铁余额</span>
          <span className={styles.balanceValue}>¥ 52.00</span>
        </div>
        <div className={styles.balanceDivider} />
        <div className={styles.balanceItem}>
          <span className={styles.balanceLabel}>碳积分</span>
          <span className={styles.balanceValue}>🌳 1250</span>
        </div>
      </div>

      {/* 最近乘车 */}
      <div className={styles.ridesCard}>
        <div className={styles.sectionTitle}>📋 最近乘车记录</div>
        {[
          { icon: '🚌', route: '1路', from: '西单', to: '王府井', time: '今天 08:30', cost: '-¥2.00' },
          { icon: '🚇', route: '1号线', from: '国贸', to: '西单', time: '昨天 18:15', cost: '-¥4.00' },
          { icon: '🚌', route: '52路', from: '王府井', to: '北京站', time: '07/31 09:00', cost: '-¥2.00' },
        ].map((r, i) => (
          <div key={i} className={styles.rideRow}>
            <span className={styles.rideIcon}>{r.icon}</span>
            <div className={styles.rideInfo}>
              <span className={styles.rideRoute}>{r.route}</span>
              <span className={styles.rideStops}>{r.from} → {r.to}</span>
            </div>
            <div className={styles.rideMeta}>
              <span className={styles.rideTime}>{r.time}</span>
              <span className={styles.rideCost}>{r.cost}</span>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      {faqOpen && (
        <div className={styles.faq}>
          <div className={styles.sectionTitle}>💡 使用帮助</div>
          <div className={styles.faqItem}><b>Q:</b> 公交码和地铁码内容相同吗？</div>
          <div className={styles.faqItem}><b>A:</b> 完全不同。公交码内容以 ZHITU-DEMO-BUS 开头，地铁码以 ZHITU-DEMO-METRO 开头，各自独立计时刷新。</div>
          <div className={styles.faqItem}><b>Q:</b> 为什么二维码会过期？</div>
          <div className={styles.faqItem}><b>A:</b> 为防止截屏盗刷，二维码每60秒自动刷新。公交码和地铁码互不影响。</div>
          <div className={styles.faqItem}><b>Q:</b> 这是官方乘车码吗？</div>
          <div className={styles.faqItem}><b>A:</b> 不是。当前为演示二维码，仅用于功能展示，不能用于真实乘车支付。</div>
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
};

export default QRCodePage;
