import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from './router';
import { setupMockHandlers } from './mocks/handlers';

if (import.meta.env.VITE_ENABLE_MOCK === 'true') {
  setupMockHandlers();
}

export default function App() {

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
