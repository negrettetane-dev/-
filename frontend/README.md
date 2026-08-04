# 智途云枢前端

面向北京、厦门、福州的多城市智慧交通控制中心 Vue 3 前端。支持后端仿真接口和离线 Mock 两种演示模式。

## 运行

```powershell
npm.cmd install
npm.cmd run dev
```

访问 `http://localhost:3000`。将 `.env.development` 中 `VITE_USE_MOCK` 改为 `false` 可连接 FastAPI 后端。

地图当前使用本地经纬度仿真模式。申请高德 Web 端 JS API Key 后填写 `VITE_AMAP_KEY` 和 `VITE_AMAP_SECURITY_CODE`，后续版本可接入真实底图。
