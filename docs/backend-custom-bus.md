# 定制公交后端接口对接文档

## 1. 背景与问题

市民端定制公交目前出现「前端显示可预约 → 点击预约 → 班次不存在」：

- 页面能展示「今天/明天/后天」的班次，但这些日期班次是**前端根据固定线路模板动态生成**的虚拟实例，后端数据库里没有对应记录。
- 用户预约时前端提交的班次标识，后端查不到，于是返回「班次不存在」。

**根因：班次模板、某天实际班次实例、预约记录三层数据没有分离。**

本次前端已重构为「只消费后端接口，不伪造班次」。后端需要补齐定制公交的数据与接口，前端即可端到端打通（前端代码已就绪，后端实现后零改动）。

## 2. 核心概念：三层数据

```
┌─────────────────────────────────────────────┐
│ ① 班次模板（长期存在，管理员维护）             │
│    天通苑 → 国贸CBD  工作日 07:00-08:15 ¥12    │
│    总座位 30                                  │
├─────────────────────────────────────────────┤
│ ② 班次实例（某一天的具体班车，预约的真实对象）  │
│    #1001  2026-08-17  剩余 7 座               │
│    #1002  2026-08-18  剩余 16 座              │
│    #1003  2026-08-19  剩余 20 座              │
├─────────────────────────────────────────────┤
│ ③ 预约记录（用户 + 班次实例）                  │
│    预约 #5001  张市民 → #1003  2026-08-19  1人│
└─────────────────────────────────────────────┘
```

- **模板**：长期定义「哪天发车、到哪、多少钱、多少座」，不绑定具体日期。
- **实例**：预约时提交的唯一对象，独立 ID、独立余座、独立状态。
- **预约**：必须绑定具体实例（含日期），不能只记「用户预约了天通苑→国贸CBD」。

## 3. 接口契约（前端已按此实现）

前端 baseURL 为 `/api`。以下契约在 `packages/shared/src/types/customBus.ts` 定义，两端编译期共享。

### 3.1 按日期查班次实例（市民端 · GET · 无需登录）

```
GET /api/custom-bus/schedules?date=2026-08-19
```

响应 `CustomBusSchedule[]`：

```json
[
  {
    "id": "cb-002-2026-08-19",
    "templateId": "cb-002",
    "scheduleId": "cb-002-0700",
    "from": "天通苑",
    "to": "国贸 CBD",
    "boardingPointId": "stop-tty",
    "date": "2026-08-19",
    "departTime": "07:00",
    "arriveTime": "08:15",
    "price": 12,
    "totalSeats": 30,
    "bookedSeats": 23,
    "remainingSeats": 7,
    "type": "早高峰通勤",
    "status": "AVAILABLE",
    "cutoffAt": 1755367200000
  }
]
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `id` | **班次实例 ID**（预约提交此 ID，不能是模板 ID） |
| `scheduleId` | 稳定标识「模板 + 发车时间」（如 `cb-002-0700`），不随日期变化 |
| `remainingSeats` | `totalSeats - bookedSeats`，后端维护 |
| `status` | **后端计算**，前端只展示：`NOT_OPEN / AVAILABLE / CLOSING / FULL / CLOSED / DEPARTED` |
| `cutoffAt` | 预约截止时间戳（发车前 N 分钟），用于「即将截止」倒计时 |

状态含义：

| 状态 | 含义 |
| --- | --- |
| `NOT_OPEN` | 尚未开放预约（超出开放周期，建议 7 天） |
| `AVAILABLE` | 可预约 |
| `CLOSING` | 即将截止（距截止 ≤ 30 分钟） |
| `FULL` | 已满（剩余 0） |
| `CLOSED` | 已停止预约（过了截止，未发车） |
| `DEPARTED` | 已发车 |

**生成策略（建议方案 A）**：系统每天自动为「今天 + 未来 7 天」生成实际班次实例；发车前 30 分钟停止预约（`CUTOFF_MINUTES = 30`，可配置）。用户选择某日期直接读该日实例。

### 3.2 创建预约（市民端 · POST · 需登录）

```
POST /api/custom-bus/reservations
Authorization: Bearer <token>
body: { "scheduleInstanceId": "cb-002-2026-08-19", "passengerCount": 1 }
```

- 必须提交**班次实例 ID**（不是模板 ID / 线路 ID / 前端临时 ID）。
- 事务原子：**检查余座 → 创建预约 → bookedSeats + 1**，中途不能被其他预约插进来（防并发超卖）。
- 校验顺序：实例存在 → 尚未截止 → 尚未发车 → 余座充足。
- 成功返回 `CustomBusReservation`（含 `reservationNo`，前端据此展示成功页）：

```json
{
  "id": "cbr_xxx",
  "reservationNo": "CB202608191234",
  "scheduleInstanceId": "cb-002-2026-08-19",
  "templateId": "cb-002",
  "routeName": "天通苑 → 国贸 CBD",
  "scheduleId": "cb-002-0700",
  "date": "2026-08-19",
  "departureTime": "07:00",
  "boardingPoint": "天通苑",
  "destination": "国贸 CBD",
  "price": 12,
  "passengerCount": 1,
  "status": "pending",
  "createdAt": 1755367200000
}
```

错误码（前端 `customBusReservationService` 已映射）：

| HTTP | code | 前端提示 |
| --- | --- | --- |
| 401 | TOKEN_EXPIRED | 登录状态已过期，请重新登录 |
| 404 | SCHEDULE_NOT_FOUND | 该班次已不存在 |
| 409 | DUPLICATE_RESERVATION | 你已预约该班次，请勿重复预约 |
| 410 | SCHEDULE_EXPIRED | 该班次已停止预约 |
| 400 | SCHEDULE_SOLD_OUT | 该班次刚刚已满，请选择其他班次 |
| 503 | RESERVATION_UNAVAILABLE | 预约服务暂不可用 |
| 501 | — | 预约服务暂未接入 |

### 3.3 我的预约列表（市民端 · GET · 需登录）

```
GET /api/custom-bus/reservations
```

返回 `CustomBusReservation[]`。前端「我的预约」页与预约成功刷新校验依赖此接口。

### 3.4 取消预约（市民端 · POST · 需登录，建议实现）

```
POST /api/custom-bus/reservations/{id}/cancel
```

- 校验：该预约属于当前用户、状态为 `pending`。
- 成功：`status = cancelled`，**bookedSeats - 1（余座 +1）**。

## 4. 数据结构建议（SQL）

```sql
-- ① 班次模板（长期）
custom_bus_templates (
  template_id      VARCHAR PK,   -- cb-001
  from_stop        VARCHAR,
  to_stop          VARCHAR,
  boarding_point_id VARCHAR,
  depart_time      TIME,          -- 07:00
  arrive_time      TIME,          -- 08:15
  price            INT,
  total_seats      INT,
  type             VARCHAR,       -- 早高峰通勤
  open_days        INT DEFAULT 7  -- 开放周期（天）
)

-- ② 班次实例（某天）
custom_bus_schedules (
  id               BIGINT PK,     -- 实例 ID（前端预约提交）
  template_id      VARCHAR,
  date             DATE,
  depart_time      TIME,
  total_seats      INT,
  booked_seats     INT DEFAULT 0,
  status           VARCHAR,       -- AVAILABLE/CLOSED/...
  cutoff_at        DATETIME,      -- 发车前 30 分钟
  UNIQUE (template_id, date)
)

-- ③ 预约记录
custom_bus_reservations (
  id               BIGINT PK,
  reservation_no   VARCHAR UNIQUE,
  user_id          VARCHAR,
  schedule_instance_id BIGINT,
  passenger_count  INT,
  price            INT,
  status           VARCHAR,       -- pending/cancelled/expired
  created_at       DATETIME
)
```

`booked_seats` 在创建/取消预约时**原子更新**（`UPDATE ... SET booked_seats = booked_seats + 1 WHERE ... AND booked_seats < total_seats`），从数据库层面防超卖。

## 5. 前端需要的演示模板数据（seed）

当前前端 mock 使用的 6 条线路模板（后端建库时可作为种子数据）：

| templateId | from | to | depart | arrive | price | baseSeats | type |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| cb-001 | 回龙观 | 中关村 | 07:30 | 08:30 | 8 | 12 | 早高峰通勤 |
| cb-002 | 天通苑 | 国贸 CBD | 07:00 | 08:15 | 12 | 5 | 早高峰通勤 |
| cb-003 | 通州北苑 | 建国门 | 07:15 | 08:10 | 10 | 18 | 早高峰通勤 |
| cb-004 | 中关村 | 回龙观 | 18:00 | 18:55 | 8 | 20 | 晚高峰通勤 |
| cb-005 | 国贸 CBD | 天通苑 | 18:30 | 19:40 | 12 | 3 | 晚高峰通勤 |
| cb-006 | 亦庄 | 西二旗 | 07:45 | 09:00 | 15 | 8 | 跨区通勤 |

## 6. 验证路径

1. `GET /api/custom-bus/schedules?date=2026-08-19` → 返回真实班次实例
2. 市民端选日期 → 展示后端返回的班次/余座/状态（不再「班次不存在」）
3. 登录 → 选班次 → 预约 → `booked_seats+1` → 刷新余座变化
4. 我的预约显示刚预约的记录
5. 取消预约 → 余座 +1

## 7. 备注

- 前端在 mock 环境（`VITE_ENABLE_MOCK=true`）已能演示完整流程；真实后端实现后前端零改动。
- 「发车前 30 分钟截止」「开放 7 天」当前是前端可配置常量（`CUTOFF_MINUTES` / `OPEN_WINDOW_DAYS`），后端实现后建议由服务端下发，前端不再自行推断。
