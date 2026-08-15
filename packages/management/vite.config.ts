import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 用 loadEnv 读取 .env（process.env 不会自动注入 .env 文件变量）
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    optimizeDeps: {
      include: ['@amap/amap-jsapi-loader'],
    },
    server: {
      port: 3001,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'https://frp-six.com:32356',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
