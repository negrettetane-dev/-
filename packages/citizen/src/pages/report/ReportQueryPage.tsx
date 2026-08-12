import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Report.module.css';
import { apiGet } from '../../services/apiClient';

const ReportQueryPage: React.FC = () => {
  const navigate = useNavigate();
  const [orderNo, setOrderNo] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [searched, setSearched] = useState(false);

  const handleQuery = async () => {
    setSearched(true);
    if (!orderNo.trim()) return;
    try {
      setResult(await apiGet('/report/query', { workOrderNo: orderNo.trim() }));
    } catch {
      setResult(null);
    }
  };

  return (
    <div className={styles.formPage}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
        <span onClick={()=>navigate(-1)} style={{cursor:'pointer',fontSize:20}}>←</span>
        <span style={{fontSize:18,fontWeight:700}}>免登录查询</span>
      </div>

      <div className={styles.formSection}>
        <div style={{fontSize:14,color:'var(--text-secondary)',marginBottom:12}}>输入工单编号即可查询进度，无需登录</div>
        <input
          style={{width:'100%',padding:12,border:'1px solid var(--border-color)',borderRadius:8,fontSize:15}}
          placeholder="请输入工单编号，如 ZT20260805001"
          value={orderNo}
          onChange={e=>setOrderNo(e.target.value)}
        />
        <button style={{width:'100%',padding:12,marginTop:10,background:'var(--primary)',color:'#fff',border:'none',borderRadius:8,fontSize:15,cursor:'pointer'}} onClick={handleQuery}>
          🔍 查询
        </button>
      </div>

      {searched && (
        <div className={styles.formSection}>
          {result ? (
            <div>
              <div style={{fontSize:14,fontWeight:600}}>查询结果</div>
              <div style={{fontSize:13,color:'var(--text-secondary)',marginTop:8}}>
                {(result as {workOrderNo?:string}).workOrderNo} - 状态：{(result as {status?:string}).status}
              </div>
            </div>
          ) : (
            <div style={{textAlign:'center',color:'var(--text-hint)',padding:20}}>未查询到对应工单，请检查编号</div>
          )}
        </div>
      )}
      <div style={{height:16}}/>
    </div>
  );
};

export default ReportQueryPage;
