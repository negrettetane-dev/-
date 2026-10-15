# 智途云枢市民端 AI 出行与结算后端调整契约

## 1. 文档目的

本文对应分支 `codex/ai-assistant-shell` 的市民端更新，定义后端需要补齐的接口、数据模型、状态约束与验收标准。目标是让前端的多模式比较、关怀偏好、无障碍状态、导航完成结算、AI 助手多轮对话、事件 AI 识别和图片上传从“演示壳子”切换为可信业务结果。

本文只描述市民端 `1.1` 至 `1.7` 所需服务。管理端事件分派、合并、处理后图片等属于后续 `1.8` 之后范围，不在本次实现边界内。

## 2. 通用约定

### 2.1 认证与响应

- 市民端 API 前缀为 `/api`，除公开路线地理检索外均需 Bearer Token。
- 成功响应统一为 `{ "code": 0, "message": "ok", "data": {}, "traceId": "..." }`。
- 失败响应统一为 `{ "code": "BUSINESS_CODE", "message": "中文可读错误", "traceId": "..." }`。
- 所有写接口支持 `Idempotency-Key`。重复请求必须返回第一次成功的业务结果，不得重复建行程、发积分、建工单或保存重复消息。
- 所有事实数据必须提供 `source`、`updatedAt` 和 `dataNature`：`realtime`、`historical`、`estimated`、`demo`、`unknown`。
- `demo` 仅允许比赛演示账号或显式演示开关返回；生产接口不得把演示数据标成实时数据。

### 2.2 时间、单位与坐标

- 时间使用 ISO-8601 UTC 字符串；前端自行展示为中文本地时间。
- 距离单位为米 `meters`，时长单位为秒 `seconds`，金额单位为元 `amount`，碳排放单位为千克二氧化碳当量 `kgCO2e`。
- 市民端地图坐标使用 GCJ-02，字段统一为 `lng`、`lat`；返回中必须标明 `coordinateSystem: "GCJ02"`。

## 3. 用户关怀偏好

### 3.1 业务目标

个人中心“关怀模式”下新增的偏好会作为无障碍路线与小枢推荐的默认条件。前端目前仅按用户在本机保存，后端上线后必须以服务端数据为准。

支持值：`elderly`、`wheelchair`、`visual`、`hearing`、`stroller`。

### 3.2 数据表

`user_mobility_preferences`

| 字段 | 说明 |
| --- | --- |
| `user_id` | 主键兼外键，用户唯一 |
| `care_preferences` | JSON 数组，关怀偏好枚举 |
| `updated_at` | 最后更新时间 |
| `version` | 乐观锁版本 |

### 3.3 接口

`GET /api/users/me/mobility-preferences`

返回：

```json
{
  "carePreferences": ["elderly", "wheelchair"],
  "updatedAt": "2026-09-21T12:00:00Z",
  "version": 3
}
```

`PUT /api/users/me/mobility-preferences`

```json
{
  "carePreferences": ["elderly", "wheelchair"],
  "version": 3
}
```

- 拒绝未知枚举和重复值。
- 版本冲突返回 `409 PREFERENCE_VERSION_CONFLICT`，并返回最新服务端值。
- 前端登录后拉取，切换时写入；离线本地值只能作为暂存，不能覆盖较新的服务端版本。

## 4. 多模式路线比较与无障碍状态

### 4.1 路线请求与候选方案

前端需要一次获得驾车、公交地铁、骑行、步行候选，并在同一字段集比较。浏览器不应承担最终多目标排序和核心决策。

`POST /api/routes/compare`

```json
{
  "origin": { "name": "当前位置", "lng": 116.397, "lat": 39.908, "coordinateSystem": "GCJ02" },
  "destination": { "name": "北京南站", "lng": 116.379, "lat": 39.865, "coordinateSystem": "GCJ02" },
  "departureAt": "2026-09-21T10:00:00Z",
  "modes": ["drive", "transit", "bike", "walk"],
  "carePreferences": ["elderly", "wheelchair"],
  "requestSource": "citizen_web"
}
```

每个候选必须返回以下统一字段：

```json
{
  "requestId": "rr_123",
  "algorithmVersion": "route-score-v1",
  "candidates": [
    {
      "id": "candidate_1",
      "mode": "transit",
      "recommended": true,
      "durationSeconds": 2280,
      "distanceMeters": 12600,
      "walkingDistanceMeters": 520,
      "transferCount": 1,
      "costAmount": 4,
      "congestionRisk": "low",
      "estimatedCarbonKgCO2e": 0.42,
      "accessibility": {
        "score": 95,
        "passable": true,
        "facilityStatusSummary": { "verified": 3, "unknown": 1, "obstacle": 0 },
        "warnings": ["B 站换乘电梯状态暂无法确认"]
      },
      "score": 92,
      "scoreBreakdown": { "time": 31, "cost": 18, "carbon": 19, "accessibility": 24 },
      "recommendationReason": "晚高峰驾车拥堵风险较高，地铁时间更稳定。",
      "segments": [],
      "source": "amap",
      "updatedAt": "2026-09-21T10:00:00Z",
      "dataNature": "realtime"
    }
  ]
}
```

规则：

- 候选不可用时仍返回该模式的 `availability: "unavailable"` 与中文 `reason`，不要静默省略。
- 无障碍硬障碍（例如轮椅模式下只有楼梯）必须返回 `passable: false`，且不得作为推荐方案。
- `estimatedCarbonKgCO2e` 必须标记为估算值并携带 `carbonFactorVersion`。
- 选择方案使用 `POST /api/routes/{requestId}/select`，后端保存所选候选快照，供导航和结算追溯。

### 4.2 无障碍设施三态

设施状态枚举固定为：

| 状态 | 前端文案 | 含义 |
| --- | --- | --- |
| `verified` | 已确认可用 | 最近有效核验结果可用 |
| `unknown` | 状态未知 | 未覆盖、过期或无法确认，不能当作可用 |
| `obstacle` | 当前障碍 | 故障、关闭或存在硬性通行障碍 |

`GET /api/accessibility/stations` 和路线候选中的每个设施均返回 `status`、`updatedAt`、`source`、`validUntil`。设施状态变为 `obstacle` 后，相关正在导航会话应得到通知或在下次刷新时提示重新规划。

## 5. 行程完成、碳结算与积分流水

### 5.1 状态机

行程状态：`in_progress -> completed | cancelled`。

结算状态：`calculating -> settled | failed`。完成行程不等于已结算；前端在 `calculating` 状态只能展示估算结果，并且不能写“积分已到账”。

### 5.2 接口

保留并完善：

- `POST /api/trips`
- `POST /api/trips/{id}/complete`
- `GET /api/trips/{id}`
- `GET /api/trips/{id}/settlement`
- `GET /api/points/transactions?page=1&pageSize=20`
- `POST /api/routes/{requestId}/feedback`

`GET /api/trips/{id}/settlement` 返回：

```json
{
  "tripId": "trip_123",
  "settlementStatus": "settled",
  "actualDistanceMeters": 12100,
  "actualDurationSeconds": 2390,
  "estimatedCarbonKgCO2e": 0.42,
  "driveBaselineCarbonKgCO2e": 2.32,
  "carbonReducedKgCO2e": 1.9,
  "carbonFactorVersion": "2026-q3",
  "carbonFactorSource": "平台碳核算规则",
  "earnedPoints": 18,
  "pointTransactionId": "pt_123",
  "dataNature": "estimated",
  "updatedAt": "2026-09-21T10:40:00Z"
}
```

规则：

- 完成接口以 `trip_id` 为幂等键；重复调用不可重复发放积分。
- 轨迹异常、行程取消、缺少必要证据等情况进入 `failed`，并返回可读失败原因。
- 积分发放、碳结算记录、行程完成状态必须在同一数据库事务内完成；通知采用 outbox 异步发送。
- 积分流水接口必须按当前用户过滤，禁止跨用户查询。

### 5.3 路线反馈

前端可多选：`recommendation_accurate`、`time_inaccurate`、`walking_too_long`、`accessibility_incorrect`、`good_experience`。

```json
POST /api/routes/{requestId}/feedback
{
  "tripId": "trip_123",
  "labels": ["recommendation_accurate", "good_experience"],
  "comment": ""
}
```

同一用户、同一路线请求仅允许更新自己的反馈，不能创建无限重复记录。

## 6. AI 助手多轮会话与业务工具

### 6.1 当前前端行为

前端已生成稳定的 `conversationId`，并在开放式 AI 请求中传递最近 12 条消息。当前兼容请求为：

```json
POST /api/ai/chat
{
  "conversationId": "uuid",
  "messages": [
    { "role": "user", "content": "我带老人去医院，少走路" },
    { "role": "assistant", "content": "..." }
  ]
}
```

后端应先兼容该字段；正式实现后迁移到以下接口，旧 `/api/ai/chat` 至少保留一版兼容层。

### 6.2 正式接口

- `POST /api/assistant/conversations`
- `POST /api/assistant/conversations/{id}/messages`
- `GET /api/assistant/conversations/{id}`
- `DELETE /api/assistant/conversations/{id}`
- `POST /api/assistant/messages/{id}/feedback`

消息响应必须可返回结构化卡片，而不是只返回自然语言：

```json
{
  "messageId": "am_123",
  "conversationId": "ac_123",
  "content": "我已整理本次出行条件，请确认。",
  "cards": [
    {
      "kind": "condition",
      "title": "出行条件确认",
      "rows": [],
      "source": "business_api",
      "updatedAt": "2026-09-21T10:00:00Z"
    }
  ],
  "requiresConfirmation": false
}
```

工具范围：路线比较、无障碍状态、停车、充电、积分、工单查询。AI 不得编造实时事实；工具失败时必须返回明确降级卡片和重试标记。

任何写操作（提交事件、预约公交、兑换积分、结束行程）只允许返回 `confirmation` 卡片。用户确认后，后端再执行对应工具调用，并记录确认人、会话、消息、幂等键与执行结果。

建议表：`assistant_conversations`、`assistant_messages`、`assistant_tool_calls`、`assistant_feedback`、`prompt_versions`、`model_usage`。

## 7. 事件上报：图片、AI 识别与正式提交

### 7.1 图片上传

当前前端可以选择、预览和删除图片，但明确标为“等待上传接口接入”。后端提供以下两步接口：

- `POST /api/uploads/presign`
- `POST /api/uploads/complete`

比赛简化版可提供 `POST /api/upload`，返回统一媒体对象：

```json
{
  "uploadId": "up_123",
  "url": "https://...",
  "thumbnailUrl": "https://...",
  "mimeType": "image/jpeg",
  "sizeBytes": 234567,
  "status": "uploaded"
}
```

- 后端校验 MIME、文件签名、单张大小和数量，移除 EXIF 定位隐私数据。
- 失败返回可重试错误；上传完成前不得允许媒体 ID 作为已上传文件提交。
- 上传结果只与当前用户的临时上传会话绑定，提交工单时由后端原子关联。

### 7.2 AI 分析与用户确认

`POST /api/report/analyze`

输入：`category`、`description`、`eventLocation`、`uploadIds`。

输出：

```json
{
  "assessmentId": "ia_123",
  "category": "signal_fault",
  "severity": "high",
  "location": { "address": "学院路与北三环交叉口", "lng": 116.0, "lat": 39.0 },
  "recommendedDepartment": "交通信号管理部门",
  "confidence": 0.88,
  "summary": "检测到疑似交通信号灯故障，建议优先核查。",
  "source": "ai_assessment",
  "updatedAt": "2026-09-21T10:00:00Z"
}
```

前端允许修改分类、严重程度、地点和部门。正式提交：

`POST /api/report/submit`

```json
{
  "description": "红绿灯一直不变灯",
  "eventLocation": {},
  "deviceLocation": {},
  "uploadIds": ["up_123"],
  "assessmentId": "ia_123",
  "finalAssessment": {
    "category": "signal_fault",
    "severity": "high",
    "recommendedDepartment": "交通信号管理部门"
  }
}
```

返回 `incidentId`、`workOrderNo`、`status: "pending"`、`createdAt` 和详情入口所需的最小数据。

规则：

- 分析仅是建议，用户最终修改值必须保留并与原始 AI 结果可审计地并存。
- 事件和媒体关联、状态历史首条记录必须在同一事务中写入。
- `assessmentId`、上传文件和用户身份不匹配时拒绝提交。
- 同一用户短时间内相同位置和文本应返回疑似重复提示，但不能静默吞掉用户上报。

## 8. 验收清单

### 8.1 路线与无障碍

- 同一请求四种方式均返回统一字段；不可用方式有明确原因。
- 轮椅条件下有硬障碍的路线不得被推荐或开始导航。
- 设施 `verified`、`unknown`、`obstacle` 在 API 和前端含义一致。
- 路线选择后，后端可追溯算法版本、数据来源和路线快照。

### 8.2 关怀偏好与 AI

- 登录用户切换关怀偏好，刷新、重新登录后仍能从服务端恢复。
- `conversationId` 的连续消息保留上下文；用户说“换一条少走路的”可关联上一轮路线请求。
- AI 只能从工具结果引用实时数据；工具超时必须返回降级结果。
- 所有写操作均需用户二次确认且重复确认不重复执行。

### 8.3 结算与事件

- 完成同一行程两次只生成一条结算和一条积分流水。
- `calculating`、`settled`、`failed` 状态及其中文原因正确返回。
- 结算页可通过 `tripId` 读取碳排放、驾车基准、减碳和积分结果。
- 图片上传、AI 分析、用户修改、提交工单能形成完整链路；工单返回真实编号。
- 所有用户资源均按当前 token 的用户 ID 查询和写入，越权访问返回 404 或 403。
