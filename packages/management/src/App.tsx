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
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif",
        },
      }}
    >
      <AppRouter />
    </ConfigProvider>
  );
}
