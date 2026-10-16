import { useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from './router';
import { setupMockHandlers } from './mocks/handlers';
import { setupScrollReveal } from '@zhitu/shared';

export default function App() {
  useEffect(() => setupScrollReveal('.ant-table-tbody > tr[data-row-key], .ant-list-items > li, .content-page ul > li, .intersection-card'), []);
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
          fontFamily: "'FangZheng XiaoBiaoSong', 'Microsoft YaHei', sans-serif",
        },
      }}
    >
      <AppRouter />
    </ConfigProvider>
  );
}
