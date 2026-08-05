import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Report.module.css';

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
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [phone, setPhone] = useState('');

  const handleSubmit = () => {
    if (!category || !description.trim()) return;
    fetch('/api/report/submit', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ category, description, photos, phone, position:[116.40,39.90], address:'自动定位' })
    }).then(() => {
      alert('上报成功！工单已生成');
      navigate('/report');
    });
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
        <div className={styles.formTitle}>📸 拍照/上传图片</div>
        <div className={styles.photoArea}>
          {photos.map((p,i) => (
            <div key={i} className={styles.photoImg} style={{background:'#eee',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>📷</div>
          ))}
          <div className={styles.photoSlot} onClick={()=>setPhotos([...photos,'mock'])}>
            <span style={{fontSize:24}}>+</span>
            <span>添加照片</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className={styles.formSection}>
        <div className={styles.formTitle}>📝 问题描述</div>
        <textarea className={styles.descInput} placeholder="请详细描述您发现的交通问题..." value={description} onChange={e=>setDescription(e.target.value)}/>
      </div>

      {/* Location */}
      <div className={styles.formSection}>
        <div className={styles.formTitle}>📍 位置信息（自动定位）</div>
        <div style={{fontSize:13,color:'var(--text-secondary)',padding:'8px',background:'var(--bg-page)',borderRadius:8}}>
          北京市西城区天安门附近 · 📍 已自动定位
        </div>
      </div>

      {/* Contact */}
      <div className={styles.formSection}>
        <div className={styles.formTitle}>📞 联系电话（选填）</div>
        <input className={styles.descInput} style={{minHeight:36}} placeholder="方便工作人员联系您" value={phone} onChange={e=>setPhone(e.target.value)}/>
      </div>

      <button className={styles.submitBtn} onClick={handleSubmit}>📤 提交上报</button>
      <div style={{height:32}}/>
    </div>
  );
};

export default ReportFormPage;
