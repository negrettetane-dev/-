import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  optimizeDeps: {
    include: ['@amap/amap-jsapi-loader'],
  },
  server: {
    port: 3000,
    // 监听所有地址（含 IPv4 127.0.0.1 与 IPv6 ::1），避免只绑定 ::1 导致 127.0.0.1 打不开
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'https://frp-six.com:32356',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
