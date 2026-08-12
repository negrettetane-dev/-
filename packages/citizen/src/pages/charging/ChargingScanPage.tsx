import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generateChargingDemoQr, type ChargingDemoQrState } from '../../services/chargingScanService';
import DemoQrCode from '../../components/DemoQrCode';
import styles from './ChargingScan.module.css';

interface ChargingScanLocationState {
  stationId?: string;
  stationName?: string;
  operator?: string;
  power?: string;
  price?: string;
  address?: string;
}

type ScanStatus = 'idle' | 'scanned';

const VALIDITY = 60; // 秒

const ChargingScanPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const station = location.state as ChargingScanLocationState | null;

  const [pileCode, setPileCode] = useState('');
  const [gunCode, setGunCode] = useState('GUN-01');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [scanning, setScanning] = useState(false);
  const [qr, setQr] = useState<ChargingDemoQrState | null>(null);
  const [countdown, setCountdown] = useState(VALIDITY);
  const [error, setError] = useState('');
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 卸载时清理 Timer
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const startCountdown = useCallback(() => {
    clearTimer();
    setCountdown(VALIDITY);
    timerRef.current = window.setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // 过期后重新生成
          if (station?.stationId) {
            setQr(generateChargingDemoQr(station.stationId, pileCode, gunCode));
          } else {
            setQr(generateChargingDemoQr('UNKNOWN', pileCode, gunCode));
          }
          return VALIDITY;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer, pileCode, gunCode, station]);

  const handleScan = () => {
    if (scanning) return;
    if (!pileCode.trim()) { setError('请输入充电桩编号'); return; }
    if (!gunCode.trim()) { setError('请输入充电枪编号'); return; }
    setError('');
    setScanning(true);

    // 模拟扫码（短延迟）
    setTimeout(() => {
      const sid = station?.stationId || 'UNKNOWN';
      const q = generateChargingDemoQr(sid, pileCode.trim(), gunCode.trim());
      setQr(q);
      setStatus('scanned');
      setScanning(false);
      startCountdown();
    }, 600);
  };

  const handleRescan = () => {
    clearTimer();
    setQr(null);
    setStatus('idle');
    setCountdown(VALIDITY);
    setError('');
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.back} onClick={() => navigate(-1)}>← 返回</span>
        <span className={styles.title}>🔌 扫码充电</span>
        <span className={styles.demoBadge}>演示</span>
      </div>

      {/* 演示警告 */}
      <div className={styles.warnBanner}>
        ⚠️ 演示扫码充电 · 未连接真实充电运营平台，不会启动实体充电
      </div>

      {/* 充电站信息 */}
      <div className={styles.stationCard}>
        <div className={styles.stationName}>
          {station?.stationName ? `🔌 ${station.stationName}` : '未选择充电站'}
        </div>
        {station ? (
          <>
            <div className={styles.stationRow}><span>地址</span><span>{station.address || '-'}</span></div>
            <div className={styles.stationRow}><span>运营商</span><span>{station.operator || '-'}</span></div>
            <div className={styles.stationRow}><span>功率</span><span>{station.power || '-'}</span></div>
            <div className={styles.stationRow}><span>价格</span><span>{station.price || '-'}</span></div>
            <div className={styles.stationRow}><span>站点编号</span><span>{station.stationId || '-'}</span></div>
          </>
        ) : (
          <div className={styles.noStation}>
            <div>未选择充电站（页面刷新后上下文丢失）</div>
            <button className={styles.btn} onClick={() => navigate('/parking')}>返回充电站列表</button>
          </div>
        )}
      </div>

      {/* 扫码表单 */}
      <div className={styles.formCard}>
        <div className={styles.formTitle}>输入充电桩 / 充电枪</div>
        <label className={styles.label}>充电桩编号</label>
        <input
          className={styles.input}
          placeholder="如：P-001"
          value={pileCode}
          onChange={e => setPileCode(e.target.value)}
          maxLength={20}
        />
        <label className={styles.label}>充电枪编号</label>
        <select className={styles.select} value={gunCode} onChange={e => setGunCode(e.target.value)}>
          {['GUN-01', 'GUN-02', 'GUN-03', 'GUN-04'].map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        {error && <div className={styles.error}>{error}</div>}

        {status === 'idle' ? (
          <button className={styles.btn} onClick={handleScan} disabled={scanning}>
            {scanning ? '识别中...' : '📷 模拟扫码'}
          </button>
        ) : (
          <button className={styles.btn} onClick={handleRescan}>🔄 重新扫码</button>
        )}
      </div>

      {/* 扫码结果 */}
      {status === 'scanned' && qr && (
        <div className={styles.resultCard}>
          <div className={styles.resultTitle}>已识别演示充电枪</div>
          <div className={styles.resultInfo}>
            <div>充电桩：<b>{pileCode}</b></div>
            <div>充电枪：<b>{gunCode}</b></div>
            {station?.stationName && <div>充电站：<b>{station.stationName}</b></div>}
          </div>

          <div className={styles.qrBox}>
            <DemoQrCode content={qr.content} className={styles.qrSvg} />
            {countdown <= 10 && (
              <div className={styles.qrOverlay}>
                <span>即将过期</span>
                <span onClick={handleRescan} style={{ cursor: 'pointer', color: '#1677ff', textDecoration: 'underline' }}>重新扫码</span>
              </div>
            )}
          </div>

          <div className={styles.qrTimer}>
            ⏱️ 二维码有效 <b style={{ color: countdown <= 10 ? '#f5222d' : '#52c41a' }}>{countdown}s</b> · 自动刷新
          </div>

          <div className={styles.demoNote}>
            当前为演示二维码，未连接真实充电运营平台，不会启动实体充电、不会计费。
          </div>
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
};

export default ChargingScanPage;
