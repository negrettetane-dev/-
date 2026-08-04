# 智途云枢 API 契约

基础地址：`http://localhost:8000`，默认城市参数：`city=beijing`。

## 接口

| 功能 | 方法 | 路径 | 主要返回结构 |
| --- | --- | --- | --- |
| 城市配置 | GET | `/api/cities` | `{ items: City[] }` |
| 交通汇总 | GET | `/api/traffic/summary?city=beijing` | `Summary` |
| 路段状态 | GET | `/api/traffic/segments?city=beijing` | `{ items: Segment[] }` |
| 交通事件 | GET | `/api/traffic/events?city=beijing` | `{ items: Event[] }` |
| 拥堵趋势 | GET | `/api/traffic/trend?city=beijing` | `{ items: TrendPoint[] }` |
| 拥堵预测 | GET | `/api/prediction/congestion?city=beijing&horizon_minutes=60` | `Prediction` |
| 路径推荐 | GET | `/api/route/recommend?city=beijing&origin=beijing_station&destination=national_stadium` | `RouteResult` |
| 活跃预警 | GET | `/api/warning/active?city=beijing` | `{ items: Warning[] }` |
| What-If 沙盘推演 | POST | `/api/simulation/what-if` | `{ code: 200, data: SimulationResult }` |

城市列表返回中心点、缩放级别、行政区、治理场景和路线 POI。当前支持 `beijing`、`xiamen`、`fuzhou`。

## What-If 沙盘推演

功能：模拟积水或事故后的路网连锁反应，输出受影响路段、拥堵扩散趋势、速度变化和处置 SOP。当前使用按城市配置的轻量道路拓扑，后续可替换为 OSMnx、NetworkX 或真实路网图。

请求示例：

```json
{
  "city": "beijing",
  "event_type": "waterlog",
  "target_segment": "东长安街",
  "water_depth_cm": 30
}
```

`event_type` 支持 `waterlog` 和 `accident`；`water_depth_cm` 范围为 0-200，仅积水场景使用。未知城市或路段返回 HTTP 404。

所有交通接口返回 `data_mode=simulation`，用于明确当前数据属性。

## 市民出行与 FMap 融合接口

| 功能 | 方法 | 路径 |
| --- | --- | --- |
| 市民首页摘要 | GET | `/api/citizen/home-summary?city=beijing` |
| 市民智能避险路线 | POST | `/api/citizen/route/smart-plan` |
| 行程风险监控 | GET | `/api/citizen/trip/monitor?route_id=...` |
| 通勤线路 / 预约 | GET / POST | `/api/citizen/commute/lines`、`/api/citizen/commute/bus-booking` |
| 地点搜索 | GET | `/api/mobility/search?city=beijing&q=北京站` |
| 附近服务 | GET | `/api/mobility/nearby?city=beijing&lng=116.397&lat=39.933&category=parking` |
| 天气详情 | GET | `/api/mobility/weather?city=beijing` |
| 打车估价 | GET | `/api/mobility/taxi-estimate?...` |
| 演示短信登录 | POST | `/api/mobility/auth/request-code`、`/api/mobility/auth/verify-code` |

短信接口仅用于本地演示，会明确返回 `demo_code`，不连接真实短信平台。收藏、运动记录和离线城市包由浏览器本地存储持久化。
