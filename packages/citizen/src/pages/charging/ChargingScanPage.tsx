import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChargingQrParseError, parseChargingQrContent, type ChargingQrPayload } from '../../services/chargingScanService';
import { createChargingSession } from '../../services/chargingSessionService';
import { formatPrice } from '../../utils/price';
import type { PriceValue } from '../../types/price';
import styles from './ChargingScan.module.css';

interface ChargingScanLocationState {
  stationId?: string;
  stationName?: string;
  operator?: string;
  power?: string;
  price?: PriceValue;
  address?: string;
}

type ScanStatus = 'idle' | 'decoding' | 'scanned' | 'confirmed';

const statusLabels: Record<ChargingQrPayload['status'], string> = {
  available: '空闲',
  occupied: '使用中',
  offline: '离线',
  fault: '故障',
};

const statusClassNames: Record<ChargingQrPayload['status'], string> = {
  available: styles.statusAvailable,
  occupied: styles.statusOccupied,
  offline: styles.statusUnavailable,
  fault: styles.statusUnavailable,
};

const decodeImageFile = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法读取图片');
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      if (!result) throw new Error('未识别到二维码，请选择清晰、完整的二维码图片');
      resolve(result.data);
    } catch (error) {
      reject(error);
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('无法读取图片，请选择有效的图片文件'));
  };
  image.src = url;
});

const ChargingScanPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const station = location.state as ChargingScanLocationState | null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const decodeRequestRef = useRef(0);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [payload, setPayload] = useState<ChargingQrPayload | null>(null);
  const [error, setError] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');

  useEffect(() => () => { decodeRequestRef.current += 1; }, []);

  const resetSelection = () => {
    decodeRequestRef.current += 1;
    setStatus('idle');
    setPayload(null);
    setError('');
    setSelectedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const requestId = ++decodeRequestRef.current;
    setStatus('decoding');
    setPayload(null);
    setError('');
    setSelectedFileName(file.name);

    try {
      const content = await decodeImageFile(file);
      if (requestId !== decodeRequestRef.current) return;
      const nextPayload = parseChargingQrContent(content);
      if (station?.stationId && nextPayload.stationId !== station.stationId) {
        throw new Error('二维码不属于当前充电站，请返回列表重新选择设备');
      }
      setPayload(nextPayload);
      setStatus('scanned');
    } catch (caught) {
      if (requestId !== decodeRequestRef.current) return;
      setStatus('idle');
      setPayload(null);
      setError(caught instanceof ChargingQrParseError || caught instanceof Error ? caught.message : '二维码识别失败，请重试');
    }
  };

  const handleConfirm = () => {
    if (!payload || payload.status !== 'available') return;
    createChargingSession(payload, {
      stationId: station?.stationId,
      stationName: station?.stationName,
      operator: station?.operator,
      address: station?.address,
    });
    navigate('/charging/session');
  };

  const canConfirm = payload?.status === 'available' && status === 'scanned';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.back} onClick={() => navigate(-1)}>← 返回</span>
        <span className={styles.title}>🔌 扫码充电</span>
        <span className={styles.demoBadge}>演示</span>
      </div>

      <div className={styles.warnBanner}>
        ⚠️ 演示扫码充电 · 未连接真实充电运营平台，不会启动实体充电
      </div>

      <div className={styles.stationCard}>
        <div className={styles.stationName}>
          {station?.stationName ? `🔌 ${station.stationName}` : '未选择充电站'}
        </div>
        {station ? (
          <>
            <div className={styles.stationRow}><span>地址</span><span>{station.address || '-'}</span></div>
            <div className={styles.stationRow}><span>运营商</span><span>{station.operator || '-'}</span></div>
            <div className={styles.stationRow}><span>功率</span><span>{station.power || '-'}</span></div>
            <div className={styles.stationRow}><span>价格</span><span>{formatPrice(station.price)}</span></div>
            <div className={styles.stationRow}><span>站点编号</span><span>{station.stationId || '-'}</span></div>
          </>
        ) : (
          <div className={styles.noStation}>
            <div>未选择充电站（页面刷新后上下文丢失）</div>
            <button className={styles.secondaryBtn} onClick={() => navigate('/parking')}>返回充电站列表</button>
          </div>
        )}
      </div>

      <div className={styles.formCard}>
        <div className={styles.formTitle}>识别充电设备</div>
        <div className={styles.formHint}>从电脑文件夹选择充电桩二维码图片，系统会自动识别充电桩和充电枪。</div>
        <input ref={fileInputRef} className={styles.fileInput} type="file" accept="image/*" onChange={handleFileChange} />
        <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()} disabled={status === 'decoding'}>
          {status === 'decoding' ? '正在识别二维码…' : payload ? '重新选择二维码' : '选择二维码图片'}
        </button>
        {selectedFileName && <div className={styles.fileName}>已选择：{selectedFileName}</div>}
        {error && <div className={styles.error} role="alert">⚠️ {error}</div>}
      </div>

      {payload && (
        <div className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <div className={styles.resultTitle}>已识别充电设备</div>
            <span className={`${styles.statusBadge} ${statusClassNames[payload.status]}`}>
              ● {statusLabels[payload.status]}
            </span>
          </div>
          <div className={styles.deviceGrid}>
            <div><span>充电桩</span><b>{payload.pileCode}</b></div>
            <div><span>充电枪</span><b>{payload.gunCode}</b></div>
            <div><span>充电类型</span><b>直流快充</b></div>
            <div><span>最大功率</span><b>{payload.powerKw} kW</b></div>
            <div><span>当前电价</span><b>{formatPrice(payload.price)}</b></div>
          </div>
          {payload.status !== 'available' && (
            <div className={styles.unavailableNote}>该充电枪当前不可用，请选择其他设备。</div>
          )}
          {status === 'scanned' && (
            <button className={styles.btn} onClick={handleConfirm} disabled={!canConfirm}>
              确认设备并开始演示
            </button>
          )}
          <button className={styles.resetBtn} onClick={resetSelection}>重新选择二维码</button>
        </div>
      )}

      {!payload && !error && status === 'idle' && (
        <div className={styles.emptyHint}>尚未识别设备，请先选择一张充电桩二维码图片。</div>
      )}
      <div style={{ height: 32 }} />
    </div>
  );
};

export default ChargingScanPage;
