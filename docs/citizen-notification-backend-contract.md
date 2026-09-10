# 市民通知：后端改造与接口契约

## 目标

当管理端处理市民上报工单或调整/发放积分后，系统向对应市民账号创建通知；市民端登录后在头像旁的通知铃铛中查看未读提醒。

前端入口已完成：`packages/citizen/src/components/NotificationBell/NotificationBell.tsx`。生产环境的通知创建、归属和已读状态必须由后端负责，不能依赖浏览器 `localStorage`。

## 数据模型

建议新增 `user_notifications` 表：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID/雪花 ID | 通知主键 |
| `user_id` | UUID/字符串 | 接收通知的市民账号，必填 |
| `type` | enum | `workorder`、`points`、`system` |
| `title` | varchar(120) | 通知标题 |
| `content` | varchar(500) | 通知正文，避免放敏感信息 |
| `work_order_id` | nullable | 工单通知关联工单 |
| `point_transaction_id` | nullable | 积分通知关联积分流水 |
| `dedupe_key` | varchar(160) unique | 幂等键 |
| `read_at` | nullable datetime | 未读为 null |
| `created_at` | datetime | 创建时间 |

工单必须有稳定的 `reporter_user_id`；不能仅凭昵称、手机号模糊匹配用户。积分流水必须有 `user_id`，并与通知建立关联。

## 市民端接口

### `GET /api/notifications`

需要市民 JWT。只返回当前登录用户自己的通知。

请求参数：

```text
page=1&page_size=20&unread_only=false
```

响应：

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "n_123",
        "type": "workorder",
        "title": "你的上报已有处理结果",
        "content": "工单 BJ20260910001 已办结。",
        "createdAt": "2026-09-10T09:30:00Z",
        "read": false,
        "workOrderId": "wo_123"
      }
    ],
    "unreadCount": 1,
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

前端当前读取 `data`；后端可先返回数组以兼容当前实现，建议尽快统一为上述分页结构并同步前端类型。

### `POST /api/notifications/read`

需要市民 JWT。只允许标记当前用户自己的通知。

```json
{ "ids": ["n_123", "n_456"] }
```

要求：重复调用幂等；不存在或不属于当前用户的 ID 不得泄露信息，统一按成功处理或返回明确业务码。

## 管理端接口

### `PUT /api/admin/workorders/{id}`

请求：

```json
{ "status": "completed", "note": "已完成路面修复" }
```

后端必须在同一事务中完成：校验状态流转 → 更新工单 → 写处理日志 → 根据 `reporter_user_id` 写通知。状态未变化时不得重复创建通知。

推荐幂等键：`workorder:{workOrderId}:status:{newStatus}:{version}`。通知正文应包含工单号、状态中文名和处理备注（如有）。

### `POST /api/admin/notifications`

当前前端在工单更新成功后调用此接口作为兼容层：

```json
{
  "event": "workorder.status_updated",
  "workOrderId": "wo_123",
  "status": "completed"
}
```

生产后端应优先把通知创建内聚到工单更新事务中；若保留此接口，必须由服务端重新查询工单和当前操作人，禁止信任请求体中的 `userId`，并使用幂等键防止重复通知。状态更新成功但通知接口暂不可用时，应进入可靠消息队列或 outbox 重试，不能静默丢失。

### `POST /api/admin/users/{userId}/points/adjust`

请求：

```json
{ "amount": 20, "reason": "有效事件上报奖励", "requestId": "req_..." }
```

后端必须在同一事务中完成：校验管理员权限 → 写积分流水 → 更新余额 → 写积分通知。`amount > 0` 通知标题建议为“积分已到账”；`amount < 0` 建议为“积分变动提醒”。`requestId` 必须唯一，重试不得重复加分或重复通知。

## 权限与安全

- 市民查询和已读接口只能访问自己的 `user_id` 数据。
- 管理员创建通知只能通过受保护的管理端权限；审计记录需包含操作者、原因和关联业务单号。
- 通知内容做长度限制和 HTML 转义，不允许把内部备注、手机号等敏感信息原样暴露。
- 删除/清理通知建议软删除或按保留策略归档，不影响审计流水。

## 验收标准

1. 管理员将工单状态从 `processing` 改为 `completed`，对应市民刷新通知中心可看到 1 条未读处理结果。
2. 重复提交相同状态或网络重试，不产生重复通知。
3. 管理员向用户发放 20 积分，余额、积分流水、通知三者一致；重复请求不重复加分。
4. 用户 A 无法通过分页、ID 或篡改参数读取用户 B 的通知。
5. 通知创建暂时失败时，工单/积分业务通过 outbox 或队列最终补发，监控可发现失败。
6. `GET /api/notifications` 返回空列表时，市民端显示“暂无新通知”，不影响首页和登录流程。

## 当前前端状态与限制

- 市民端已接入 `GET /api/notifications`，并提供铃铛、未读角标、通知列表和空状态。
- 管理端工单更新后会调用 `POST /api/admin/notifications` 兼容接口；旧后端未实现该接口时不会阻断工单状态更新。
- 当前演示环境的积分调整会写入本地通知数据；这只是本地联调兜底，不能替代生产后端事务和消息可靠投递。
- 尚未实现市民端“标记已读”按钮；后端接口准备好后可继续接入单条/批量已读。
