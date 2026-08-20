import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../../services/apiClient';
import { getCurrentResolvedLocation } from '../../services/locationService';
import type { ReportLocation, DeviceLocation } from '../../types/reportLocation';
import ReportLocationPicker from './ReportLocationPicker';
import styles from './Report.module.css';

const MAX_PHOTOS = 6;

const CATEGORIES = [
  { value:'pothole', label:'路面坑洼', icon:'🕳️' },
  { value:'streetlight', label:'路灯损坏', icon:'💡' },
  { value:'illegal_park', label:'违停占道', icon:'🚗' },
  { value:'manhole', label:'井盖破损', icon:'⭕' },
  { value:'signal_fault', label:'信号灯故障', icon:'🚦' },
  { value:'accident_clue', label:'事故线索', icon:'🚨' },
  { value:'barrier', label:'道路障碍', icon:'🚧' },
  { value:'other', label:'其他问题', icon:'📝' },
];

const ReportFormPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState('');

  // ===== 事件位置：设备当前位置 与 用户确认的事件位置 分离 =====
  // deviceLocation：设备原始定位（保留审核用）
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null);
  // eventLocation：用户最终确认的事件位置（自动定位结果 或 手动/搜索选点）
  const [eventLocation, setEventLocation] = useState<ReportLocation | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const startLocate = useCallback(() => {
    setLocating(true);
    setLocationError('');
    getCurrentResolvedLocation()
      .then(res => {
        const locatedAt = new Date().toISOString();
        // 设备定位（GCJ-02，高德返回）
        setDeviceLocation({ longitude: res.lng, latitude: res.lat, accuracy: res.accuracy, locatedAt });
        // 事件位置默认 = 设备位置（自动定位，已确认）
        setEventLocation({
          address: res.address,
          longitude: res.lng,
          latitude: res.lat,
          locationType: 'auto',
          locationStatus: 'verified',
          accuracy: res.accuracy,
          city: res.city,
          locatedAt,
        });
        setLocationError('');
      })
      .catch(() => {
        setDeviceLocation(null);
        setEventLocation(null);
        setLocationError('无法获取当前位置，可手动选择事件位置');
      })
      .finally(() => setLocating(false));
  }, []);

  useEffect(() => { startLocate(); }, [startLocate]);

  // 点击"添加照片"触发隐藏的 file input
  const handleAddPhoto = () => { fileInputRef.current?.click(); };

  // 选择文件后：保存 File 对象 + 生成缩略图预览
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

  // 删除已选图片
  const handleRemovePhoto = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // 清理所有预览 URL
  const revokeAllPreviews = () => {
    previewUrls.forEach(u => URL.revokeObjectURL(u));
  };

  // 地图选点/搜索确认：作为事件位置，locationType 由弹窗判定（manual/search）
  const handlePickerConfirm = (loc: ReportLocation) => {
    setEventLocation(loc);
    setPickerOpen(false);
    setLocationError('');
  };

  const handleSubmit = async () => {
    if (!category) { setValidationError('请选择问题类型'); return; }
    if (!description.trim()) { setValidationError('请填写问题描述'); return; }
    setValidationError('');

    try {
      await apiPost('/report/submit', {
        category,
        description: description.trim(),
        phone: phone.trim() || undefined,
        // 事件位置：有则提交；无定位且未手动选择时，允许无位置提交但标记 failed
        ...(eventLocation
          ? {
              eventLocation,
              // 冗余字段（兼容旧后端 / 便于管理端直接读）
              lng: eventLocation.longitude,
              lat: eventLocation.latitude,
              address: eventLocation.address,
              locationType: eventLocation.locationType,
              locationStatus: eventLocation.locationStatus,
            }
          : { locationStatus: 'failed' as const }),
        // 设备原始定位（保留审核追溯）
        ...(deviceLocation ? { deviceLocation } : {}),
      });
      revokeAllPreviews();
      setSubmitted(true);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : '提交失败，请检查网络后重试');
    }
  };

  return (
    <div className={styles.formPage}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
        <span onClick={()=>navigate(-1)} style={{cursor:'pointer',fontSize:20}}>←</span>
        <span style={{fontSize:18,fontWeight:700}}>新建上报</span>
      </div>

      {/* Category */}
      <div className={styles.formSection}>
        <div className={styles.formTitle}>选择问题类型</div>
        <div className={styles.catGrid}>
          {CATEGORIES.map(c => (
            <div key={c.value}
              className={`${styles.catCard} ${category===c.value?styles.catActive:''}`}
              onClick={()=>setCategory(c.value)}>
              <span style={{fontSize:24}}>{c.icon}</span>
              <span style={{fontSize:14}}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Photos */}
      <div className={styles.formSection}>
        <div className={styles.formTitle}>
          📸 拍照/上传图片
          <span style={{fontSize:12,fontWeight:400,color:'var(--text-hint)',marginLeft:8}}>
            ({photoFiles.length}/{MAX_PHOTOS})
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div className={styles.photoArea}>
          {previewUrls.map((url, i) => (
            <div key={i} className={styles.photoWrap}>
              <img className={styles.photoImg} src={url} alt={`照片 ${i + 1}`} />
              <button className={styles.photoRemove} onClick={() => handleRemovePhoto(i)} title="删除此图片">✕</button>
            </div>
          ))}
          {photoFiles.length < MAX_PHOTOS && (
            <div className={styles.photoSlot} onClick={handleAddPhoto}>
              <span style={{fontSize:24}}>+</span>
              <span>添加照片</span>
            </div>
          )}
        </div>
        <div style={{fontSize:12,color:'var(--text-hint)',marginTop:8}}>
          💡 支持 JPG/PNG，单张≤10MB，最多{MAX_PHOTOS}张。拍摄全景照片有助于快速定位。
        </div>
        {photoFiles.length > 0 && (
          <div style={{fontSize:12,color:'#ad6800',marginTop:6}}>
            当前后端尚未提供图片上传接口，本次只提交事件文字与位置，所选图片不会上传。
          </div>
        )}
      </div>

      {/* Description */}
      <div className={styles.formSection}>
        <div className={styles.formTitle}>📝 问题描述</div>
        <textarea className={styles.descInput} placeholder="请详细描述您发现的交通问题..." value={description} onChange={e=>setDescription(e.target.value)}/>
      </div>

      {/* Location：设备当前位置 与 事件发生位置 分离 */}
      <div className={styles.formSection}>
        <div className={styles.formTitle}>📍 位置信息</div>
        {/* 当前已确认的事件位置 */}
        <div style={{fontSize:13,color:'var(--text-secondary)',padding:'8px 10px',background:'var(--bg-page)',borderRadius:8}}>
          {locating ? '正在获取当前位置…'
            : eventLocation ? `${eventLocation.address}`
              : locationError ? `⚠️ ${locationError}`
              : '请选择事件发生位置'}
          {eventLocation && !locating && (
            <div style={{marginTop:4,fontSize:11,color:'var(--text-hint)'}}>
              {eventLocation.locationType === 'auto' ? '已自动定位'
                : eventLocation.locationType === 'search' ? `已搜索选点${eventLocation.poiName ? ` · ${eventLocation.poiName}` : ''}`
                : '已手动选点'}
              {eventLocation.accuracy != null ? ` · 精度约${Math.round(eventLocation.accuracy)}m` : ''}
              · 坐标 {eventLocation.longitude.toFixed(4)}, {eventLocation.latitude.toFixed(4)}
            </div>
          )}
        </div>
        {/* 操作：重新定位 / 修改位置 */}
        <div style={{display:'flex',gap:10,marginTop:10}}>
          <button
            type="button"
            className={styles.locationBtn}
            onClick={startLocate}
            disabled={locating}
          >
            📍 重新定位
          </button>
          <button
            type="button"
            className={styles.locationBtn}
            onClick={() => setPickerOpen(true)}
          >
            ✏️ 修改位置
          </button>
        </div>
        <div style={{fontSize:11,color:'var(--text-hint)',marginTop:8}}>
          💡 事件位置默认取当前位置；若事件发生在别处（远处坑洞/事故现场/已离开地点），可手动选点或搜索。
        </div>
      </div>

      {/* Contact */}
      <div className={styles.formSection}>
        <div className={styles.formTitle}>📞 联系电话（选填）</div>
        <input className={styles.descInput} style={{minHeight:36}} placeholder="方便工作人员联系您" value={phone} onChange={e=>setPhone(e.target.value)}/>
      </div>

      {submitted ? (
        <div style={{textAlign:'center',padding:'32px 16px',background:'#fff',borderRadius:12,boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:48,marginBottom:12}}>✅</div>
          <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>上报成功！</div>
          <div style={{fontSize:14,color:'var(--text-secondary)',marginBottom:16}}>工单已生成，持久化保存，1-3个工作日内处理</div>
          <button className={styles.submitBtn} onClick={() => navigate('/report')} style={{maxWidth:200,margin:'0 auto'}}>查看我的上报</button>
        </div>
      ) : (
        <>
          {validationError && (
            <div style={{padding:10,background:'#fff1f0',color:'#f5222d',borderRadius:8,fontSize:13,marginBottom:4}}>
              ⚠️ {validationError}
            </div>
          )}
          <button className={styles.submitBtn} onClick={handleSubmit}>📤 提交上报</button>
        </>
      )}

      {/* 位置选择弹窗（地图选点 + 搜索） */}
      {pickerOpen && (
        <ReportLocationPicker
          initial={eventLocation ? { lng: eventLocation.longitude, lat: eventLocation.latitude, address: eventLocation.address } : null}
          onConfirm={handlePickerConfirm}
          onCancel={() => setPickerOpen(false)}
        />
      )}

      <div style={{height:32}}/>
    </div>
  );
};

export default ReportFormPage;
