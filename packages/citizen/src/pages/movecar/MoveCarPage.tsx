import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MoveCar.module.css';

const PLATE_PREFIXES = ['京A', '京B', '京C', '京E', '京F', '京G', '京H', '京J', '京K', '京L', '京M', '京N', '京P', '京Q', '京Y'];

const MoveCarPage: React.FC = () => {
  const navigate = useNavigate();
  const [prefix, setPrefix] = useState('京A');
  const [plateNum, setPlateNum] = useState('');
  const [location, setLocation] = useState('正在获取位置...');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocation('北京市朝阳区建国路88号 · SOHO现代城地面停车场');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const addPhoto = () => {
    if (photos.length < 3) {
      setPhotos(prev => [...prev, `photo_${Date.now()}`]);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!plateNum.trim() || plateNum.length < 5) return;
    const id = 'MCR' + Date.now().toString(36).toUpperCase();
    setRequestId(id);
    setSubmitted(true);
  };

  const isValid = plateNum.trim().length >= 5;

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✅</div>
          <div className={styles.successTitle}>挪车请求已发送</div>
          <div className={styles.successId}>请求编号：{requestId}</div>
          <div className={styles.successDesc}>
            对方车主将收到挪车通知（通过短信/APP推送），您的手机号已加密保护。
            预计等待时间：<b>3-5分钟</b>
          </div>
          <div className={styles.privacy}>
            🔒 双方手机号均加密隐藏 · 通话通过虚拟号码转接
          </div>
          <button className={styles.backBtn} onClick={() => navigate('/services')}>
            返回便民服务
          </button>
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
              placeholder="请输入车牌号"
              value={plateNum}
              onChange={e => setPlateNum(e.target.value.toUpperCase())}
              maxLength={7}
            />
          </div>
          <div className={styles.hint}>新能源车牌请输入8位（如 京AD12345）</div>
        </div>

        {/* 当前位置 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>车辆位置</label>
          <div className={styles.locationBox}>
            <span>📍</span>
            <span className={styles.locationText}>{location}</span>
          </div>
          <div className={styles.hint}>自动获取当前位置，如有偏差请手动描述</div>
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
          <div className={styles.photoGrid}>
            {photos.map((p, i) => (
              <div key={p} className={styles.photoBox} onClick={() => removePhoto(i)}>
                <span>📸</span>
                <span className={styles.photoLabel}>照片 {i + 1}</span>
                <span className={styles.photoRemove}>✕</span>
              </div>
            ))}
            {photos.length < 3 && (
              <div className={styles.photoAdd} onClick={addPhoto}>
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

        {/* 提交 */}
        <button
          className={`${styles.submitBtn} ${!isValid ? styles.submitDisabled : ''}`}
          onClick={handleSubmit}
          disabled={!isValid}
        >
          📞 一键发起挪车通知
        </button>

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

      <div style={{ height: 32 }} />
    </div>
  );
};

export default MoveCarPage;
