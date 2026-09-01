# 智途云枢 · 长途客运购票记录 后端接口文档

> 对应前端已实现功能：长途客运「确认购票信息」时创建购票记录，并与「我的预约」合并展示。
> 前端已按「后端优先 + 本地降级」实现——后端未接入时降级 localStorage 并标注 demo，接入后前端零改动。

## 数据模型

```sql
-- 长途客运购票记录（用户 + 班次 + 日期）
long_distance_purchase
- id                  -- 记录 ID（后端生成）
- purchase_no         -- 购票记录号（用户可见，如 LDXXXXX）
- user_id             -- 用户 ID（从登录 Token 解析，不信任前端）
- schedule_id         -- 班次 ID（对应 bus_schedule.id，如 cs-wh-0830）
- provider            -- 平台标识（e2go/ctrip/qunar）
- origin_station      -- 出发站
- destination_station -- 到达站
- date                -- 出行日期 YYYY-MM-DD
- departure_time      -- 发车时间 HH:mm
- price               -- 票价（元）
- passenger_count     -- 购票人数
- status              -- pending(待支付) / paid(已购票) / cancelled(已取消) / expired(已过期)
- created_at          -- 创建时间（毫秒时间戳）
```

## 接口

### 1. 创建购票记录（登录）

```
POST /api/long-distance/purchases
```

**请求 body：**
```json
{
  "scheduleId": "cs-wh-0830",
  "date": "2026-08-20",
  "passengerCount": 1
}
```

**说明：**
- 需登录（`Authorization: Bearer <token>`），`userId` 从 Token 解析，不信任前端
- `scheduleId` 对应 `bus_schedule.id`；后端应校验班次存在、该日发车、库存充足
- 返回完整购票记录

**成功响应：**
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "ldp_xxx",
    "purchaseNo": "LDXXXXX",
    "kind": "purchase",
    "scheduleId": "cs-wh-0830",
    "routeName": "长沙汽车西站 → 武汉宏基客运站",
    "provider": "e2Go",
    "date": "2026-08-20",
    "departureTime": "08:30",
    "originStation": "长沙汽车西站",
    "destinationStation": "武汉宏基客运站",
    "price": 120,
    "passengerCount": 1,
    "status": "pending",
    "createdAt": 1787238257573
  }
}
```

**错误：**
- 401 未登录 → `{code:401, message:'请先登录'}`
- 404 班次不存在 → `{code:404, message:'班次不存在'}`

### 2. 我的购票记录列表（登录）

```
GET /api/long-distance/purchases
```

**说明：**
- 需登录，返回当前用户全部购票记录，按 `createdAt` 倒序
- 前端与「我的预约」合并展示，用 `kind: 'purchase'` 区分定制公交预约

**成功响应：**
```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "ldp_xxx",
      "purchaseNo": "LDXXXXX",
      "kind": "purchase",
      "scheduleId": "cs-wh-0830",
      "routeName": "长沙汽车西站 → 武汉宏基客运站",
      "provider": "e2Go",
      "date": "2026-08-20",
      "departureTime": "08:30",
      "originStation": "长沙汽车西站",
      "destinationStation": "武汉宏基客运站",
      "price": 120,
      "passengerCount": 1,
      "status": "pending",
      "createdAt": 1787238257573
    }
  ]
}
```

## 与既有接口的关系

| 字段 | 来源 |
|---|---|
| `scheduleId` | 来自 `GET /api/long-distance/schedules` 返回的 `id` |
| `originStation` / `destinationStation` / `departureTime` / `provider` | 同上，前端从班次信息透传 |
| `price` | 来自查询/刷新后的实时库存 `inventory.price` |

## 前端对应文件

- 契约类型：`packages/shared/src/types/customBus.ts`（`LongDistancePurchase` / `CreateLongDistancePurchaseRequest`）
- 服务层：`packages/citizen/src/services/longDistanceBusService.ts`（`createPurchase` / `getMyPurchases`，后端优先 + 本地降级）
- 页面：`packages/citizen/src/pages/services/LongDistanceBusPage.tsx`（确认购票时创建）、`packages/citizen/src/pages/profile/MyReservationsPage.tsx`（合并展示）

## 验证路径（后端就绪后）

1. 登录 → `/services/bus` 查班次 → 立即购买 → 确认购票信息 → `POST /purchases` 建记录
2. `/profile/reservations` → 定制公交(蓝) + 长途客运(紫) 两类记录合并展示
3. 刷新页面 → 购票记录仍在（后端持久化，非 localStorage）
