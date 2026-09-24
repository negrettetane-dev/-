# 智途云枢 · 事件状态更新与平台反馈下发（后端调整方案）

> 对应前端改动：管理端「事件详情」状态中文化 + 保存状态按钮移至平台反馈下方，点击后**一次性提交状态与平台反馈**。
> 后端需将两者一并落库，并同步更新市民端工单状态、向市民推送通知。
>
> ⚠️ 命名与数据模型以 `docs/citizen-notification-backend-contract.md` 为准（该文档已定义通知表、
> 事件表补充字段与可靠投递 outbox）。本文档只描述**管理端保存状态/反馈**这一个入口的具体契约，
> 通知类型统一为 `event`，不再使用旧称 `workorder`。

## 一、现状与目标

| 项 | 现状 | 目标 |
|---|---|---|
| 状态/严重程度 | 后端返回英文枚举，管理端直接展示英文 | 前端已本地映射为中文（待审核/已受理/处理中/已完成，**「已关闭」已从可选项中移除**），**后端枚举值保持英文不变** |
| 平台反馈 | `PUT /api/admin/incidents/:id` 只更新 status，`platformFeedback` 被忽略 | 同时保存 `platformFeedback` |
| 市民端可见性 | 市民端工单状态/反馈不随管理端更新 | 状态与反馈同步到 `/events/mine`、`/report/detail/:id` |
| 市民通知 | 无 | 状态变更时向市民推送一条 `event` 类别通知 |

## 二、接口调整

### PUT /api/admin/incidents/:id（管理端当前实际调用）

> 管理端 axios baseURL 为 `/api/admin`，前端代码中写作 `PUT /incidents/:id`，故实际路径为 `/api/admin/incidents/:id`。

前端请求体：

```json
{
  "version": 8,
  "status": "processing",
  "platformFeedback": "已派维修队伍，预计 2 小时内恢复通行，请绕行辅道。",
  "department": "城市道路设施维护部门",
  "estimatedProcessTime": "预计 2 小时内完成处置",
  "retainedAfterImageIds": ["media_existing_1"],
  "retainedLegacyAfterImages": [],
  "afterImageUploadIds": ["up_new_1"],
  "notifyCitizen": true
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | `pending` / `received` / `processing` / `resolved`（`closed` 为历史值，管理端已不再提供该选项，后端可保留枚举以兼容旧数据，或同步下线） | 是 | 状态机按 `pending → received → processing → resolved` 推进；前端负责中文展示 |
| version | number | 建议必填 | 乐观锁版本；过期返回 HTTP 409 + `INCIDENT_VERSION_CONFLICT` |
| platformFeedback | string（≤500 字） | 否 | 平台反馈，市民端可见 |
| department | string | 否 | 受理部门 |
| estimatedProcessTime | string | 否 | 预计处理时间 |
| retainedAfterImageIds | string[] | 是 | 本次保存后继续保留的既有处理后媒体 ID，按显示顺序传入 |
| retainedLegacyAfterImages | string[] | 迁移期可选 | 尚未迁移为媒体记录的历史相对 URL；只允许后端已存在于该事件的 URL，不得信任任意外部 URL |
| afterImageUploadIds | string[] | 是 | 本次新增并已暂存上传的处理后图片 ID |
| notifyCitizen | boolean | 否，默认 true | 是否向上报市民推送通知 |

响应（前端已按此结构消费，`code=0` 即成功）：

```json
{
  "code": 0,
  "data": {
    "id": "INC-20260910-001",
    "status": "processing",
    "platformFeedback": "已派维修队伍，预计 2 小时内恢复通行，请绕行辅道。",
    "notifyCitizen": true,
    "notifiedAt": 1789012345678
  },
  "message": "ok",
  "timestamp": 1789012345678
}
```

### 管理员上传处理后图片

`POST /api/admin/uploads`，使用管理员 Bearer Token，`multipart/form-data` 字段：

| 字段 | 必填 | 说明 |
|---|---:|---|
| file | 是 | 单张 JPG、PNG 或 WebP，最大 10MB |
| purpose | 是 | 固定 `incident_after_image` |
| incidentId | 是 | 即将绑定的事件 ID |

成功返回暂存媒体（尚未与事件正式绑定）：

```json
{
  "code": 0,
  "data": {
    "uploadId": "up_01J...",
    "url": "/uploads/incidents/staged/up_01J.webp",
    "thumbnailUrl": "/uploads/incidents/staged/up_01J_thumb.webp",
    "filename": "repair.webp",
    "mimeType": "image/webp",
    "sizeBytes": 428531,
    "status": "uploaded",
    "expiresAt": "2026-09-25T12:00:00Z"
  },
  "message": "ok"
}
```

后端要求：

- 校验管理员身份、事件存在及事件更新权限；不得接受请求体传入的管理员身份。
- 校验 MIME、文件魔数及可解码性，拒绝 SVG 等主动内容；限制像素数，清理 EXIF（尤其 GPS）。
- 使用随机文件名和安全路径，单事件最终最多 6 张处理后图片。
- 暂存记录绑定管理员、事件和 `purpose`，未绑定文件建议 24 小时后清理。
- 返回 `/uploads/...` 可访问相对 URL，并设置正确 Content-Type 与 `X-Content-Type-Options: nosniff`。

### GET /api/admin/incidents/:id 图片字段

管理端详情增加权威媒体列表和乐观锁版本：

```json
{
  "version": 8,
  "afterImageMedia": [
    {
      "mediaId": "media_01J...",
      "url": "/uploads/incidents/INC-001/final.webp",
      "thumbnailUrl": "/uploads/incidents/INC-001/final_thumb.webp",
      "filename": "final.webp",
      "mimeType": "image/webp",
      "sizeBytes": 428531
    }
  ],
  "afterImages": ["/uploads/incidents/INC-001/final.webp"]
}
```

`afterImageMedia` 供管理端编辑并作为权威数据；`afterImages` 是给旧管理端和市民端的兼容 URL 数组。

### 图片关联事务规则

`PUT /api/admin/incidents/:id` 必须在同一事务内：

1. 校验 `version` 和状态转换；
2. 校验保留的媒体均属于当前事件；
3. 校验新增上传未过期、`status=uploaded`、用途及事件匹配、未绑定其他事件；
4. 按 `retainedAfterImageIds` 后接 `afterImageUploadIds` 的顺序生成最终图片集合，合计不超过 6 张；
5. 更新事件状态、部门、预计时间和反馈；
6. 更新图片关联及顺序、递增版本；
7. 追加处理日志并按规则写通知/outbox；
8. 一次 commit，任一步失败全部回滚。

空图片数组表示清空；被移除媒体的物理文件应在事务提交后异步清理。历史 URL 只允许保留服务器已知属于该事件的地址，不允许写入任意外部 URL。

建议错误码：`ADMIN_AUTH_REQUIRED`（401）、`INCIDENT_UPDATE_FORBIDDEN`（403）、`INCIDENT_NOT_FOUND`（404）、`UPLOAD_NOT_FOUND_OR_EXPIRED`（404/410）、`INCIDENT_VERSION_CONFLICT`（409）、`UPLOAD_ALREADY_ATTACHED`（409）、`IMAGE_TOO_LARGE`（413）、`UNSUPPORTED_IMAGE_TYPE`（415）、`TOO_MANY_AFTER_IMAGES`（422）、`UPLOAD_RATE_LIMITED`（429）。失败统一返回 `{ code, message, traceId }`。


### 处理流程（建议在同一事务/幂等流程内）

1. 校验 `version`、`status` 合法性、管理员权限与事件存在性；非法返回结构化业务错误。
2. 更新事件表字段：
   - `status`、`platform_feedback`
   - `status_updated_at`（本次状态变更时间）
   - `status_updated_by`（操作的管理员 ID，从 Bearer Token 解析）
3. **追加处理进度日志**（供市民端 `processLogs` 时间线展示）：
   - `{ time, action: "状态变更为「处理中」", operator: "管理员", detail: platformFeedback }`
4. `notifyCitizen=true` 时：
   - 查询事件的 `reporter_user_id`（市民 user_id，字段定义见 contract 文档 2.3）；
   - 读取该市民的**通知设置**中 `event` 开关（`GET/PUT /api/notification-settings`）；
   - 开关开启 → 写入一条 `type='event'` 通知记录（表结构见 contract 文档 2.2）；关闭 → 跳过推送（状态仍会同步）；
   - 相同状态重复提交应命中幂等键，不重复产生通知。
5. `platformFeedback` 为空且状态为 `resolved` 时建议兜底文案：「您上报的事件已办结，感谢您的参与。」

## 三、数据模型调整

### 1. 事件表（incidents / work_orders）

除 contract 文档 2.3 要求的 `reporter_user_id` / `status_version` / `last_status_changed_at` 外，本方案另需：

| 字段 | 类型 | 说明 |
|---|---|---|
| platform_feedback | varchar(500) | 平台反馈文本，NULL 表示尚无反馈 |
| status_updated_at | datetime | 最近一次状态变更时间（可与 contract 的 `last_status_changed_at` 合并） |
| status_updated_by | varchar(64) | 最近操作管理员 ID |
| feedback_updated_at | datetime | 最近一次反馈更新时间（可与 status_updated_at 合并） |

### 2. 市民通知表

**不再新增 `citizen_notifications`**，统一使用 contract 文档 2.2 定义的通知表，本方案的写入记录形如：

| 列 | 取值示例 |
|---|---|
| user_id | 事件 `reporter_user_id` |
| type | `event` |
| related_id | 事件 ID（如 `INC-20260910-001`） |
| title | 您上报的「路面坑洼」进度更新 |
| content | 状态已变更为「处理中」。平台反馈：已派维修队伍，预计 2 小时内恢复通行。 |
| is_read | 0 |

（事件 `title` 字段当前存的是分类值如 `pothole`，生成文案时映射为中文分类名。）

## 四、市民端查询接口调整

### GET /api/events/mine（我的上报列表）

每条记录增加：

| 字段 | 类型 | 说明 |
|---|---|---|
| platformFeedback | string | 平台反馈（可空） |
| statusUpdatedAt | number | 最近状态变更时间戳（毫秒） |

### GET /api/report/detail/:id（工单详情）

- `processLogs` 追加状态变更记录（action 用中文，前端时间线直接渲染）；
- `platformFeedback` 字段随管理端保存实时返回（前端已支持渲染该字段）。

### 新增 GET /api/notifications?unreadOnly=&page=&pageSize=

市民端消息通知列表：

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "N1001",
        "type": "workorder",
        "title": "您上报的「路面坑洼」进度更新",
        "content": "状态已变更为「处理中」。平台反馈：已派维修队伍……",
        "incidentId": "INC-20260910-001",
        "isRead": false,
        "createdAt": 1789012345678
      }
    ],
    "unreadCount": 3,
    "total": 12, "page": 1, "pageSize": 10
  },
  "message": "ok",
  "timestamp": 1789012345678
}
```

### 新增 POST /api/notifications/read

请求体：`{ "ids": ["N1001"] }`（`ids` 为空数组时标记全部已读）。

## 五、推送通道（可选增强）

通知记录落库后，如有推送条件可额外触发：

1. **WebSocket / SSE**：管理端保存成功后服务端向在线市民端推送 `{ type: 'notification', payload }`；
2. **短信 / APP Push**：`workorder` 开关同时控制站内与短信渠道；短信内容截断前 70 字并附工单号。

无推送基础设施时，一期仅做落库 + 列表轮询（市民端工单详情页已有 15 秒轮询，天然兼容）。

## 六、兼容性与验收清单

- [ ] `PUT /api/incidents/:id` 接受并保存 `platformFeedback`（≤500 字，超长返回 400）
- [ ] 状态枚举不改动（前端映射中文），非法枚举返回 400
- [ ] `notifyCitizen=false` 时不写通知记录，但状态/反馈仍同步
- [ ] 市民关闭「事件进度通知（`event`）」时不产生通知记录，但事件状态照常更新
- [ ] `/events/mine`、`/report/detail/:id` 返回 `platformFeedback` 与最新 `status`
- [ ] 重复保存相同状态幂等，不重复产生通知（建议以 `status + feedback` 均未变化时跳过通知）
- [ ] 管理端操作人从 Token 解析，不信任请求体传入的身份字段
