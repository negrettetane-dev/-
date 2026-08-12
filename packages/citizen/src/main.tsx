import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/variables.css';
import './styles/global.css';
import './styles/tailwind.css';

// 高德地图 JS API 安全密钥配置（必须在 AMapLoader.load 之前执行）
const amapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
if (amapSecurityCode) {
  (window as unknown as { _AMapSecurityConfig?: { securityJsCode: string } })._AMapSecurityConfig = {
    securityJsCode: amapSecurityCode,
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
