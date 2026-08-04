# 智途云枢与 FMap 融合说明

## 融合原则

- 主框架保持 Vue 3 + FastAPI，不复制 FMap 的 Android Java/XML、旧版 SDK、密钥和图片资源。
- 现有交通总览、地图、预测、路径、预警、沙盘和 3D 页面与 API 契约保持不变。
- FMap 的地图工具能力被重新实现为 `/mobility` 出行服务工作台，并复用智途云枢的城市、路况和路径数据。

## 功能映射

| FMap 能力 | 智途云枢实现 |
| --- | --- |
| 地图、定位、2D/3D、路况 | `MobilityView.vue` + `TrafficMap.vue` |
| 搜索、附近、POI 详情 | `/api/mobility/search`、`/nearby` 与地图详情面板 |
| 路线、打车、分享 | 路径页深链、动态估价、Clipboard/高德位置 URI |
| 天气 | `/api/mobility/weather` |
| 常用、收藏、离线地图 | 城市 POI 快捷入口与浏览器持久化 |
| 组队 | 本地组队口令与成员状态 |
| 运动记录 | 计时、里程估算与本地记录 |
| 短信登录 | FastAPI 演示验证码申请/校验 |
| 语音、扫码 | 浏览器 SpeechRecognition / BarcodeDetector，提供兼容性降级 |
| 市民路线、风险监控、通勤预约 | `/api/citizen/*` 完整后端接口 |

## 数据说明

当前交通、天气、POI、估价和短信均为可复现仿真数据，接口会返回 `data_mode=simulation`。高德 Web Key 配置后使用真实底图；未配置时使用本地仿真地图。
