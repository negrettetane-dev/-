import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCurrentResolvedLocation, normalizeLocationError, isValidCoord,
  type ResolvedLocation,
} from '../../services/locationService';
import { uploadMoveCarImage, submitMoveCarRequest, type MoveCarRequestResult } from '../../services/moveCarService';
import LocationPickerModal from './LocationPickerModal';
import styles from './MoveCar.module.css';

const PLATE_PREFIXES = ['京A', '京B', '京C', '京E', '京F', '京G', '京H', '京J', '京K', '京L', '京M', '京N', '京P', '京Q', '京Y'];
const MAX_PHOTOS = 3;

const MoveCarPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prefix, setPrefix] = useState('京A');
  const [plateNum, setPlateNum] = useState('');

  // 真实定位状态
  const [vehicleLocation, setVehicleLocation] = useState<ResolvedLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle');
  const [locationError, setLocationError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [description, setDescription] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<MoveCarRequestResult | null>(null);

  // 卸载时释放全部 Blob URL
  useEffect(() => {
    return () => {
      previewUrls.forEach(u => URL.revokeObjectURL(u));
    };
  }, []);

  // ===== 定位 =====
  const locateVehicle = useCallback(async () => {
    setLocationStatus('locating');
    setLocationError('');
    try {
      const resolved = await getCurrentResolvedLocation();
      setVehicleLocation({ ...resolved, source: 'geolocation' });
      setLocationStatus('success');
    } catch (error) {
      setLocationError(normalizeLocationError(error));
      setLocationStatus('error');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setLocationStatus('locating');
    getCurrentResolvedLocation()
      .then(resolved => {
        if (!alive) return;
        setVehicleLocation({ ...resolved, source: 'geolocation' });
        setLocationStatus('success');
      })
      .catch((error) => {
        if (!alive) return;
        setLocationError(normalizeLocationError(error));
        setLocationStatus('error');
      });
    return () => { alive = false; };
  }, []);

  // ===== 图片 =====
  const handleAddPhoto = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const remaining = MAX_PHOTOS - photoFiles.length;
    const newFiles = Array.from(files).slice(0, remaining);
    const newUrls = newFiles.map(f => URL.createObjectURL(f));
    setPhotoFiles(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newUrls]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(previewUrls[idx]);
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviewUrls(prev => prev.filter((_, i) => i !== idx));
  };

  // ===== 提交 =====
  const plateNumber = `${prefix}${plateNum.trim()}`;
  const isPlateValid = plateNum.trim().length >= 5; // 排除前缀，普通车牌6位 / 新能源8位
  const canSubmit = isPlateValid
    && !!vehicleLocation
    && isValidCoord(vehicleLocation.lng, vehicleLocation.lat)
    && vehicleLocation.address.trim().length > 0
    && !submitting;

  const handleSubmit = async () => {
    setSubmitError('');
    if (!canSubmit) {
      setSubmitError('请先填写车牌号并确认车辆位置');
      return;
    }
    setSubmitting(true);
    try {
      // 1. 上传图片（真实后端 /api/upload）
      const imageUrls: string[] = [];
      for (const f of photoFiles) {
        try {
          const url = await uploadMoveCarImage(f);
          imageUrls.push(url);
        } catch (e) {
          setSubmitError(`图片「${f.name}」上传失败，请重试`);
          setSubmitting(false);
          return;
        }
      }
      // 2. 演示提交（后端暂无挪车接口）
      const loc = vehicleLocation!;
      const payload = {
        plateNumber,
        lng: loc.lng,
        lat: loc.lat,
        address: loc.address,
        description,
        images: imageUrls,
        locationSource: loc.source,
      };
      const r = await submitMoveCarRequest(payload);
      setResult(r);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 成功页（演示模式，明确标注） =====
  if (result) {
    return (
      <div className={styles.page}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>🧾</div>
          <div className={styles.successTitle}>演示请求已生成</div>
          <div className={styles.successId}>请求编号：{result.requestNo}</div>
          <div className={styles.successDesc}>
            位置：{vehicleLocation?.address || '-'}
          </div>
          <div className={styles.privacy} style={{ background: '#fffbe6', color: '#ad6800' }}>
            ⚠️ 当前为演示请求，未发送短信或 APP 通知，未联系真实车主。<br />
            后端挪车通知服务接入后即可发送真实通知。
          </div>
          <button className={styles.backBtn} onClick={() => navigate('/services')}>返回便民服务</button>
        </div>
        <div style={{ height: 24 }} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.back} onClick={() => navigate(-1)}>← 返回</span>
        <span className={styles.title}>📞 移车求助</span>
      </div>

      <div className={styles.form}>
        {/* 目标车牌号 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>对方车牌号 <span className={styles.required}>*</span></label>
          <div className={styles.plateRow}>
            <select className={styles.prefixSelect} value={prefix} onChange={e => setPrefix(e.target.value)}>
              {PLATE_PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              className={styles.plateInput}
              placeholder="输入车牌号（不含前缀）"
              value={plateNum}
              onChange={e => setPlateNum(e.target.value.toUpperCase())}
              maxLength={7}
            />
          </div>
          <div className={styles.hint}>普通车牌共6位、新能源共8位（已含前缀 {prefix}）</div>
        </div>

        {/* 车辆位置（真实定位 + 地图选点） */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>车辆位置 <span className={styles.required}>*</span></label>
          <div className={styles.locationBox}>
            <span>📍</span>
            {locationStatus === 'locating' && <span className={styles.locationText}>正在获取当前位置...</span>}
            {locationStatus === 'success' && vehicleLocation && (
              <span className={styles.locationText}>{vehicleLocation.address}</span>
            )}
            {locationStatus === 'error' && (
              <span className={styles.locationText} style={{ color: '#d4380d' }}>
                {locationError}
              </span>
            )}
            {locationStatus === 'idle' && <span className={styles.locationText}>尚未获取位置</span>}
          </div>

          {locationStatus === 'success' && vehicleLocation && (
            <div className={styles.coordinateText}>
              经度 {vehicleLocation.lng.toFixed(6)} · 纬度 {vehicleLocation.lat.toFixed(6)} · 来源：{vehicleLocation.source === 'geolocation' ? '定位' : '地图选点'}
            </div>
          )}

          <div className={styles.locationActions}>
            <button className={styles.locateButton} onClick={() => void locateVehicle()} disabled={locationStatus === 'locating'}>
              {locationStatus === 'locating' ? '定位中...' : '重新定位'}
            </button>
            <button className={styles.mapPickerButton} onClick={() => setPickerOpen(true)}>地图选点</button>
          </div>
        </div>

        {/* 补充描述 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>补充描述</label>
          <textarea
            className={styles.textarea}
            placeholder="描述车辆特征（颜色、型号等），方便确认..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {/* 现场照片 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>现场照片 <span className={styles.optional}>(选填，最多3张)</span></label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div className={styles.photoGrid}>
            {previewUrls.map((url, i) => (
              <div key={i} className={styles.photoBox} onClick={() => removePhoto(i)}>
                <img src={url} alt={`照片 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                <span className={styles.photoRemove}>✕</span>
              </div>
            ))}
            {photoFiles.length < MAX_PHOTOS && (
              <div className={styles.photoAdd} onClick={handleAddPhoto}>
                <span style={{ fontSize: 28 }}>+</span>
                <span className={styles.photoLabel}>添加照片</span>
              </div>
            )}
          </div>
        </div>

        {/* 隐私说明 */}
        <div className={styles.privacyBanner}>
          🔒 <b>隐私保护声明</b><br />
          您的手机号将被加密隐藏，双方通过虚拟号码联系，真实号码不会泄露。
        </div>

        {submitError && <div className={styles.error}>{submitError}</div>}

        {/* 提交 */}
        <button
          className={`${styles.submitBtn} ${!canSubmit ? styles.submitDisabled : ''}`}
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || submitting}
        >
          {submitting ? '提交中...' : '📞 生成挪车请求（演示）'}
        </button>
        <div className={styles.demoNote}>
          后端挪车通知服务暂未接入，提交后为演示请求，不会发送真实通知。
        </div>

        {/* 常见问题 */}
        <div className={styles.faqBox}>
          <div className={styles.faqTitle}>💡 使用须知</div>
          <ul className={styles.faqList}>
            <li>仅用于联系车主挪车，不得用于其他目的</li>
            <li>恶意使用将承担法律责任</li>
            <li>如对方10分钟内无响应，建议拨打122</li>
            <li>地下停车场可备注具体楼层和车位号</li>
          </ul>
        </div>
      </div>

      {/* 地图选点弹窗 */}
      {pickerOpen && (
        <LocationPickerModal
          initial={vehicleLocation}
          onConfirm={(loc) => { setVehicleLocation(loc); setLocationStatus('success'); setPickerOpen(false); }}
          onCancel={() => setPickerOpen(false)}
        />
      )}

      <div style={{ height: 32 }} />
    </div>
  );
};

export default MoveCarPage;
