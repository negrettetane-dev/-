import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../../services/apiClient';
import { getCurrentResolvedLocation } from '../../services/locationService';
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
const CATEGORY_LABELS: Record<string,string> = {
  pothole:'路面坑洼', streetlight:'路灯损坏', illegal_park:'违停占道',
  manhole:'井盖破损', signal_fault:'信号灯故障', accident_clue:'事故线索',
  barrier:'道路障碍', other:'其他问题',
};

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
  // 真实定位：不伪造固定坐标。定位失败时明确标注，不提交错误位置。
  const [location, setLocation] = useState<{ lng: number; lat: number; address: string } | null>(null);
  const [locating, setLocating] = useState(true);

  useEffect(() => {
    let alive = true;
    getCurrentResolvedLocation()
      .then(res => { if (alive) setLocation({ lng: res.lng, lat: res.lat, address: res.address }); })
      .catch(() => { if (alive) setLocation(null); })
      .finally(() => { if (alive) setLocating(false); });
    return () => { alive = false; };
  }, []);

  // 点击"添加照片"触发隐藏的 file input
  const handleAddPhoto = () => {
    fileInputRef.current?.click();
  };

  // 选择文件后：保存 File 对象 + 生成缩略图预览
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const remaining = MAX_PHOTOS - photoFiles.length;
    const newFiles = Array.from(files).slice(0, remaining);
    const newUrls = newFiles.map(f => URL.createObjectURL(f));
    setPhotoFiles(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newUrls]);
    // 清空 input.value，允许再次选择同一文件
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

  const handleSubmit = async () => {
    if (!category) { setValidationError('请选择问题类型'); return; }
    if (!description.trim()) { setValidationError('请填写问题描述'); return; }
    setValidationError('');

    try {
      await apiPost('/report/submit', {
        category,
        description: description.trim(),
        phone: phone.trim() || undefined,
        // 仅提交真实定位；未定位成功则不附带坐标，绝不写死天安门
        ...(location ? { lng: location.lng, lat: location.lat, address: location.address } : {}),
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
        {/* 隐藏的真实文件选择器 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div className={styles.photoArea}>
          {/* 已选图片缩略图 */}
          {previewUrls.map((url, i) => (
            <div key={i} className={styles.photoWrap}>
              <img className={styles.photoImg} src={url} alt={`照片 ${i + 1}`} />
              <button
                className={styles.photoRemove}
                onClick={() => handleRemovePhoto(i)}
                title="删除此图片"
              >
                ✕
              </button>
            </div>
          ))}
          {/* 添加按钮 */}
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

      {/* Location */}
      <div className={styles.formSection}>
        <div className={styles.formTitle}>📍 位置信息</div>
        <div style={{fontSize:13,color:'var(--text-secondary)',padding:'8px',background:'var(--bg-page)',borderRadius:8}}>
          {locating ? '正在获取当前位置…'
            : location ? `📍 ${location.address} · 已自动定位`
            : '⚠️ 未获取到定位，请在描述中补充位置信息'}
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
      <div style={{height:32}}/>
    </div>
  );
};

export default ReportFormPage;
