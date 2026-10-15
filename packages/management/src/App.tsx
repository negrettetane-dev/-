import { useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from './router';
import { setupMockHandlers } from './mocks/handlers';

export default function App() {
  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_MOCK !== 'true') return;
    return setupMockHandlers();
  }, []);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#00e5ef',
          colorInfo: '#00e5ef',
          colorSuccess: '#39f7c4',
          colorWarning: '#ffe45c',
          colorError: '#ff4ca8',
          colorBgBase: '#0a0a0f',
          colorTextBase: '#f5fbff',
          borderRadius: 4,
          fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Microsoft YaHei', monospace",
        },
      }}
    >
      <AppRouter />
    </ConfigProvider>
  );
}
