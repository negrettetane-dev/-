import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReportPage from '../report/ReportPage';

const MyReportsPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{height:'100%',overflow:'hidden'}}>
      <div style={{padding:12,display:'flex',alignItems:'center',gap:12}}>
        <span onClick={()=>navigate(-1)} style={{cursor:'pointer',fontSize:20}}>←</span>
        <span style={{fontSize:18,fontWeight:700}}>我的上报</span>
      </div>
      <div style={{flex:1,overflow:'hidden'}}>
        <ReportPage />
      </div>
    </div>
  );
};

export default MyReportsPage;
