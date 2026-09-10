# 智途云枢 · 事件状态更新与平台反馈下发（后端调整方案）

> 对应前端改动：管理端「事件详情」状态中文化 + 保存状态按钮移至平台反馈下方，点击后**一次性提交状态与平台反馈**。
> 后端需将两者一并落库，并同步更新市民端工单状态、向市民推送通知。
> 前端分支：`feature/incidents-status-i18n-feedback`

## 一、现状与目标

| 项 | 现状 | 目标 |
|---|---|---|
| 状态/严重程度 | 后端返回英文枚举，管理端直接展示英文 | 前端已本地映射为中文（待审核/处理中/已完成，**「已关闭」已从可选项中移除**），**后端枚举值保持英文不变** |
| 平台反馈 | `PUT /api/incidents/:id` 只更新 status，`platformFeedback` 被忽略 | 同时保存 `platformFeedback` |
| 市民端可见性 | 市民端工单状态/反馈不随管理端更新 | 状态与反馈同步到 `/events/mine`、`/report/detail/:id` |
| 市民通知 | 无 | 状态变更时向市民推送一条「工单进度」通知 |

## 二、接口调整

### PUT /api/admin/incidents/:id（管理端保存状态）

前端请求体：

```json
{
  "status": "processing",
  "platformFeedback": "已派维修队伍，预计 2 小时内恢复通行，请绕行辅道。",
  "notifyCitizen": true
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | `pending` / `processing` / `resolved`（`closed` 为历史值，管理端已不再提供该选项，后端可保留枚举以兼容旧数据，或同步下线） | 是 | 状态枚举保持英文，前端负责中文展示 |
| platformFeedback | string（≤500 字） | 否 | 平台反馈，市民端可见 |
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

### 处理流程（建议在同一事务/幂等流程内）

1. 校验 `status` 合法性与事件存在性，非法返回 `code=400`。
2. 更新事件表字段：
   - `status`、`platform_feedback`
   - `status_updated_at`（本次状态变更时间）
   - `status_updated_by`（操作的管理员 ID，从 Bearer Token 解析）
3. **追加处理进度日志**（供市民端 `processLogs` 时间线展示）：
   - `{ time, action: "状态变更为「处理中」", operator: "管理员", detail: platformFeedback }`
4. `notifyCitizen=true` 时：
   - 查询事件的 `reported_by`（市民 user_id）；
   - 读取该市民的**通知设置**中 `workorder` 开关（见 `backend-notification-settings.md`）；
   - 开关开启 → 写入一条通知记录（见下文通知表）；关闭 → 跳过推送（状态仍会同步）。
5. `platformFeedback` 为空且状态为 `resolved`/`closed` 时建议兜底文案：「您上报的事件已办结，感谢您的参与。」

## 三、数据模型调整

### 1. 事件表（incidents / events）新增字段

| 字段 | 类型 | 说明 |
|---|---|---|
| platform_feedback | varchar(500) | 平台反馈文本，NULL 表示尚无反馈 |
| status_updated_at | datetime | 最近一次状态变更时间 |
| status_updated_by | varchar(64) | 最近操作管理员 ID |
| feedback_updated_at | datetime | 最近一次反馈更新时间（可与 status_updated_at 合并） |

### 2. 新增市民通知表（citizen_notifications）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigint PK | 通知 ID |
| user_id | varchar(64) | 接收市民 ID（索引） |
| incident_id | varchar(64) | 关联事件 ID（索引） |
| type | varchar(32) | 通知类型：`workorder`（本方案）；预留 `congestion` / `weather` / `control` / `system` |
| title | varchar(128) | 通知标题，如「上报事件进度更新」 |
| content | varchar(500) | 通知正文：状态中文描述 + 平台反馈 |
| is_read | tinyint(1) | 已读标记，默认 0 |
| created_at | datetime | 创建时间 |

通知内容生成示例：

```text
title:   您上报的「路面坑洼」进度更新
content: 状态已变更为「处理中」。平台反馈：已派维修队伍，预计 2 小时内恢复通行。
```

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

- [ ] `PUT /api/admin/incidents/:id` 接受并保存 `platformFeedback`（≤500 字，超长返回 400）
- [ ] 状态枚举不改动（前端映射中文），非法枚举返回 400
- [ ] `notifyCitizen=false` 时不写通知记录，但状态/反馈仍同步
- [ ] 市民关闭「工单进度通知」时不产生通知记录，但工单状态照常更新
- [ ] `/events/mine`、`/report/detail/:id` 返回 `platformFeedback` 与最新 `status`
- [ ] 重复保存相同状态幂等，不重复产生通知（建议以 `status + feedback` 均未变化时跳过通知）
- [ ] 管理端操作人从 Token 解析，不信任请求体传入的身份字段
