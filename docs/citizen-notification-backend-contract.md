# 市民端消息通知后端调整说明

## 1. 调整目标

市民端头像旁的通知中心只保留四类消息，并与“个人中心 → 消息设置”逐项对应：

| 类型 | `type` | 触发来源 | 默认跳转 |
|---|---|---|---|
| 碳积分推送 | `carbon` | 绿色出行到账、事件奖励、积分扣减、权益兑换 | `/carbon/points-detail` 或 `/carbon/redemptions` |
| 天气预警提醒 | `weather` | 气象预警发布、升级、解除 | 天气详情（可选） |
| 事件进度通知 | `event` | 当前用户提交的事件状态改变 | `/report/detail/{eventId}` |
| 系统消息 | `system` | 密码修改成功、邮箱绑定/修改成功 | `/profile/account` |

移除“拥堵预警推送”和“交通管制通知”。原“工单进度通知”统一改为“事件进度通知”，业务接口可暂时保留 `work_orders` 表名，但用户可见文案和通知类型必须使用“事件”。

前端过渡兼容旧数据：`points` 映射为 `carbon`，`workorder` 映射为 `event`；后端新数据不得继续写旧类型。

## 2. 数据模型

### 2.1 用户通知设置表

```sql
create table user_notification_preferences (
  user_id varchar(64) primary key,
  carbon_enabled boolean not null default true,
  weather_enabled boolean not null default true,
  event_enabled boolean not null default true,
  system_enabled boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_notification_preferences_user foreign key (user_id) references users(id)
);
```

首次查询没有记录时返回四项 `true`，可懒创建。`version` 用于并发更新。系统消息关闭只影响站内通知中心；密码安全提醒如通过短信/邮件发送，不受此开关限制。

### 2.2 通知表

```sql
create table user_notifications (
  id varchar(64) primary key,
  user_id varchar(64) not null,
  type varchar(20) not null,
  title varchar(120) not null,
  content varchar(500) not null,
  related_type varchar(30),
  related_id varchar(64),
  action_path varchar(255),
  payload jsonb not null default '{}'::jsonb,
  dedupe_key varchar(180) not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  deleted_at timestamptz,
  constraint ck_user_notifications_type check (type in ('carbon', 'weather', 'event', 'system')),
  constraint uq_user_notifications_dedupe unique (dedupe_key),
  constraint fk_user_notifications_user foreign key (user_id) references users(id)
);

create index idx_user_notifications_user_created on user_notifications(user_id, created_at desc) where deleted_at is null;
create index idx_user_notifications_user_unread on user_notifications(user_id, read_at, created_at desc) where deleted_at is null;
create index idx_user_notifications_related on user_notifications(related_type, related_id);
```

字段约定：`related_type` 使用 `point_transaction`、`redemption`、`reported_event`、`weather_alert` 或 `account_security`；`related_id` 保存业务主键；`action_path` 只能是服务端白名单路径；`payload` 只能保存非敏感展示快照；`dedupe_key` 必须是稳定业务幂等键。

### 2.3 事件表补充字段

如当前使用 `work_orders` 表，至少保证以下字段存在：

```sql
alter table work_orders
  add column reporter_user_id varchar(64),
  add column status_version integer not null default 1,
  add column last_status_changed_at timestamptz;

create index idx_work_orders_reporter_user on work_orders(reporter_user_id, created_at desc);
```

`reporter_user_id` 必须稳定指向提交事件的用户，不能通过昵称、手机号或描述模糊匹配。

建议状态：`pending` 待受理、`received` 已受理、`processing` 处理中、`completed` 已完成、`rejected` 未受理、`closed` 已关闭。首次提交成功页已经反馈时可不重复发送 `pending` 通知，其余真实状态变化发送通知。

### 2.4 可靠投递 outbox

```sql
create table notification_outbox (
  id varchar(64) primary key,
  aggregate_type varchar(40) not null,
  aggregate_id varchar(64) not null,
  event_type varchar(80) not null,
  payload jsonb not null,
  status varchar(20) not null default 'pending',
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  last_error varchar(500),
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index idx_notification_outbox_pending on notification_outbox(status, next_retry_at, created_at);
```

业务事务同时写业务表、通知表和 outbox；后台任务负责 WebSocket/SSE/短信/邮件投递，失败指数退避重试并告警。

## 3. 市民端接口

所有接口都从 JWT 获取当前 `user_id`，不能接受前端传入的其他用户 ID。

### 3.1 设置

`GET /api/notification-settings`

```json
{ "code": 0, "data": { "carbon": true, "weather": true, "event": true, "system": true } }
```

`PUT /api/notification-settings`

请求必须提交完整布尔对象：

```json
{ "carbon": true, "weather": false, "event": true, "system": true }
```

字段缺失或类型错误返回 `400 INVALID_NOTIFICATION_PREFERENCES`，不能把缺失字段静默写成 `false`；响应返回服务端最终保存值。

### 3.2 通知列表

`GET /api/notifications?page=1&pageSize=20&unreadOnly=false&type=carbon,event,system`

```json
{
  "code": 0,
  "data": {
    "list": [{
      "id": "ntf_01", "type": "event", "title": "你提交的事件已受理",
      "content": "事件 ZT20260910001 已由交通中心受理。",
      "createdAt": "2026-09-10T10:30:00+08:00", "read": false,
      "relatedId": "evt_01", "actionPath": "/report/detail/evt_01"
    }],
    "unreadCount": 1, "page": 1, "pageSize": 20, "total": 1
  }
}
```

默认按 `created_at desc`；只返回当前用户、未软删除且未过期数据；`unreadCount` 按当前设置过滤后的可见数据计算。过渡期可以返回数组，但应尽快统一分页结构。

### 3.3 标记已读

`POST /api/notifications/read`

```json
{ "ids": ["ntf_01", "ntf_02"] }
```

只更新当前用户通知，重复调用幂等；不属于当前用户的 ID 不得泄露存在性。成功返回 `{ "code": 0, "data": { "success": true } }`。

## 4. 通知触发事务

### 4.1 碳积分

绿色出行结算、有效事件奖励、管理员积分调整、权益兑换扣分、积分回退都可创建 `carbon` 通知。必须保证积分余额、积分流水、业务记录、通知一致：

```text
锁定积分账户 → 校验幂等键 → 更新余额 → 写 point_transactions
→ 检查 carbon_enabled 并写通知 → 写 outbox → 提交事务
```

幂等键建议：`carbon:trip:{tripId}:settled`、`carbon:event:{eventId}:reward:{ruleVersion}`、`carbon:redemption:{redemptionId}:deducted`、`carbon:adjust:{requestId}`。正文包含原因、变化数量和变化后余额，不包含内部备注。

### 4.2 天气预警

仅发送正式预警的首次发布、等级升级和解除；普通天气预报不创建通知。轮询刷新不得重复创建。

幂等键：`weather:{provider}:{alertId}:{version}`。`payload` 可保存预警级别、区域、生效时间、结束时间。拥堵和交通管制不得写入通知中心。

### 4.3 事件进度

管理端现有接口可暂时保留：`PUT /api/admin/workorders/{id}`，请求示例：

```json
{ "status": "processing", "note": "养护人员已到达现场", "version": 3 }
```

事务顺序：校验管理员权限和版本 → 校验合法状态流转 → 比较前后状态 → 更新事件及版本 → 写处理日志 → 根据 `reporter_user_id` 和 `event_enabled` 写 `event` 通知 → 写 outbox → 提交。相同状态重试不得创建通知；并发旧版本返回 `409 EVENT_VERSION_CONFLICT`。

通知标题示例：

- `received`：你提交的事件已受理
- `processing`：你提交的事件正在处理
- `completed`：你提交的事件已完成
- `rejected`：你提交的事件未受理（正文包含用户可见原因）

当前管理端前端兼容调用：`POST /api/admin/notifications`：

```json
{ "event": "event.status_updated", "eventId": "evt_01", "status": "processing", "note": "养护人员已到达现场" }
```

服务端不得信任请求中的用户 ID、标题或正文，必须重新查询事件和提交人，并使用相同幂等键去重。最终应将通知创建内聚到状态更新事务后废弃该兼容调用。

### 4.4 系统消息

密码接口：`PUT /api/user/password`，请求 `{ "currentPassword": "旧密码", "newPassword": "新密码" }`。成功时验证旧密码、校验密码策略、使用 Argon2id/bcrypt 重哈希、使其他会话失效、写安全审计，并在 `system_enabled=true` 时创建“登录密码修改成功”通知。不得在通知中写入密码。错误码建议：`INVALID_CURRENT_PASSWORD`、`WEAK_PASSWORD`、`PASSWORD_REUSED`、`TOO_MANY_ATTEMPTS`。

邮箱建议使用确认流程：

1. `POST /api/user/email/change-code`：向新邮箱发送验证码，返回 `changeRequestId` 和有效期。
2. `PUT /api/user/email`：提交 `{ changeRequestId, code }` 完成绑定或修改。
3. 成功后唯一性校验、更新邮箱、写安全审计，并创建系统消息。

首次无旧邮箱时标题“邮箱绑定成功”，已有邮箱时标题“邮箱修改成功”；正文只展示脱敏邮箱。幂等键：`system:email_changed:{securityAuditId}`。

前端当前兼容 `PATCH /api/user/profile` 的邮箱提交。后端若暂时保留，必须执行验证码确认、邮箱唯一性校验，并只在最终修改成功后发通知。

## 5. 实时与安全

基础方案是通知中心打开时拉取，页面重新获得焦点时刷新。推荐 SSE/WebSocket 只推送 `{ "event": "notification.created", "notificationId": "ntf_01" }`，客户端收到后重新请求列表；断线降级为 30～60 秒轮询。

- 市民端只能读取和标记自己的通知。
- 管理员事件操作记录操作者、角色、旧状态、新状态、用户可见备注、内部备注和时间。
- 密码/邮箱变更写 `account_security_audits`，记录设备、IP、操作和结果，不记录密码或验证码。
- 标题正文服务端模板化、限长、HTML 转义，前端按纯文本渲染。
- 通知建议 180 天后归档，使用软删除，不影响业务流水和安全审计。

## 6. 旧数据迁移

```sql
update user_notifications set type = 'carbon' where type = 'points';
update user_notifications set type = 'event' where type = 'workorder';
```

设置迁移：旧 `workorder_enabled` → `event_enabled`；`carbon_enabled` 无旧值时默认 `true`；旧 `control_enabled` 停止读取；天气和系统无旧值时默认 `true`。迁移前备份，迁移后检查类型约束、重复幂等键和无 `reporter_user_id` 的事件；无法确定用户归属的历史事件不得补发通知。

## 7. 验收标准

1. 设置页只显示碳积分、天气、事件进度、系统消息四项，关闭后刷新仍保持关闭。
2. 完成绿色出行、兑换权益分别只产生一次碳积分通知，积分余额和流水一致。
3. 事件从待受理到已受理、处理中、已完成的每次真实状态变化产生一条事件通知；相同状态重试不重复。
4. 用户 A 的事件只通知 A，用户 B 无法读取或标记 A 的通知。
5. 密码错误不改密码、不产生系统成功通知；密码修改成功产生一条系统通知。
6. 邮箱首次绑定和后续修改文案不同，验证码错误或邮箱重复不产生成功通知。
7. 点击未读通知后写入 `read_at`，刷新后保持已读。
8. outbox 投递失败可重试、可告警，最终到达不重复。
9. 数据库不再新增 `points`、`workorder`、拥堵预警或交通管制通知。

## 8. 当前前端对接清单

- `GET/PUT /api/notification-settings`
- `GET /api/notifications`
- `POST /api/notifications/read`
- `PATCH /api/user/profile`（邮箱兼容入口）
- `PUT /api/user/password`
- 管理端兼容：`POST /api/admin/notifications`，事件名 `event.status_updated`
- 新通知类型：`carbon`、`weather`、`event`、`system`

本地 Mock 已覆盖设置保存、通知列表、单条已读、绿色出行积分通知、兑换通知、密码修改通知和邮箱绑定/修改通知。生产环境必须由后端负责事务、幂等、用户归属、可靠投递和安全审计。
