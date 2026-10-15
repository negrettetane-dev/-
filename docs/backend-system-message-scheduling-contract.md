# 管理端系统消息与定时发送后端调整文档

> 对应前端页面：`packages/management/src/pages/content/ContentManagementPage.tsx`
> 对应前端服务：`packages/management/src/services/contentService.ts`
> 管理端 axios `baseURL = /api/admin`，因此本文接口写出的完整路径均以 `/api/admin` 开头。
> 响应统一使用 `{ code, message, data, timestamp }`，`code === 0` 表示成功。

## 1. 目标与边界

管理端「内容管理」当前改为真实接口驱动，功能对象是**面向用户端通知中心的系统消息**，不是交通资讯列表，也不是浏览器本地草稿。

必须支持：

1. 新建系统消息并保存为草稿；
2. 编辑草稿或定时消息；
3. 立即发布；
4. 保存定时发送任务，到达时间后由服务端自动发布；
5. 删除草稿；
6. 发布成功后，用户端通过通知按钮从 `/api/notifications` 看到系统消息；
7. 服务重启、管理端页面关闭后，定时任务仍然有效；
8. 同一消息只允许产生一次发布结果和一次用户通知投递。

前端不使用 `localStorage` 作为资讯数据源，也不使用浏览器 `setTimeout` 承担定时任务。定时发送必须由后端持久化并执行。

## 2. 状态机

消息状态只有以下三种：

| 状态 | 含义 | 可编辑 | 可删除 | 可转移 |
|---|---|---:|---:|---|
| `draft` | 草稿，尚未对用户可见 | 是 | 是 | `published` / `scheduled` |
| `scheduled` | 已保存定时任务，等待服务端到点发布 | 是 | 否（建议另做取消接口） | `draft` / `published` |
| `published` | 已完成发布并生成用户通知 | 否，建议只读 | 否 | 无 |

状态转移必须由后端校验，不能接受任意字符串或绕过状态机的直接更新。

定时消息到达 `scheduledAt` 后，后端在事务中完成：

1. 校验消息仍为 `scheduled`；
2. 将消息更新为 `published`，写入 `published_at`；
3. 创建一次消息投递批次；
4. 为目标用户创建 `system` 通知；
5. 提交事务后由 outbox/队列完成大批量投递；
6. 记录成功、失败和重试结果。

## 3. 管理端接口

### 3.1 查询消息

`GET /api/admin/content/news`

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `status` | string | 否 | `draft`、`scheduled`、`published` |
| `page` | number | 否 | 默认 1 |
| `pageSize` | number | 否 | 默认 20，服务端限制最大值 |

响应：

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "msg_01J...",
        "title": "系统维护通知",
        "category": "系统公告",
        "summary": "今晚进行系统维护",
        "content": "今晚 23:00 至 24:00 进行系统维护。",
        "status": "scheduled",
        "scheduledAt": "2026-09-25T15:00:00.000Z",
        "publishedAt": null,
        "createdAt": "2026-09-23T08:00:00.000Z",
        "updatedAt": "2026-09-23T08:10:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "message": "ok",
  "timestamp": 1780000000000
}
```

无数据时返回 `list: []`，不要返回 `null`。

### 3.2 新建消息

`POST /api/admin/content/news`

请求体：

```json
{
  "title": "系统维护通知",
  "category": "系统公告",
  "summary": "今晚进行系统维护",
  "content": "今晚 23:00 至 24:00 进行系统维护。",
  "status": "scheduled",
  "scheduledAt": "2026-09-25T15:00:00.000Z"
}
```

字段规则：

| 字段 | 必填 | 规则 |
|---|---:|---|
| `title` | 是 | 去除首尾空白后 1–120 字符 |
| `category` | 是 | `系统公告`、`出行提醒`、`服务通知`、`活动通知`，或由后端配置表维护 |
| `summary` | 否 | 最长 300 字符 |
| `content` | 是 | 去除首尾空白后不能为空，长度上限由后端配置 |
| `status` | 是 | 仅允许 `draft`、`published`、`scheduled` |
| `scheduledAt` | 条件必填 | `status=scheduled` 时必须是未来时间；其他状态必须为 `null` |

`status=published` 时，接口必须在同一业务事务内完成发布和投递任务创建后再返回成功；不能只写一条“已发布”记录而不创建通知。

### 3.3 更新消息

`PUT /api/admin/content/news/:id`

请求体与新建相同。后端必须根据当前状态限制更新：

- `draft`：允许修改内容并转为 `published` 或 `scheduled`；
- `scheduled`：允许修改正文和发送时间；修改时间必须重新校验未来时间，并安全更新调度任务；
- `published`：返回业务错误 `CONTENT_ALREADY_PUBLISHED`，不允许覆盖已发布内容。

### 3.4 删除草稿

`DELETE /api/admin/content/news/:id`

仅允许删除 `draft`。删除 `scheduled` 或 `published` 返回 `CONTENT_NOT_DELETABLE`，避免已排队或已发送消息产生审计断裂。

成功响应：

```json
{ "code": 0, "data": { "success": true }, "message": "草稿已删除" }
```

建议另提供取消定时接口：

`POST /api/admin/content/news/:id/cancel-schedule`

仅允许 `scheduled -> draft`，并取消尚未执行的调度任务。

## 4. 用户端通知接口

现有用户端通知按钮读取 `/api/notifications`。系统消息发布后，必须进入该接口返回结果，而不是只在管理端显示“已发布”。

通知字段至少包括：

```json
{
  "id": "ntf_01J...",
  "type": "system",
  "title": "系统维护通知",
  "content": "今晚 23:00 至 24:00 进行系统维护。",
  "relatedId": "msg_01J...",
  "read": false,
  "createdAt": 1780000000000
}
```

`relatedId` 指向 `content_messages.id`，便于客户端点击通知后查看消息详情或后续扩展详情跳转。通知内容必须按纯文本安全输出；若以后支持富文本，服务端必须做白名单清洗，不能直接信任管理端 HTML。

通知接收人范围需要明确配置。默认建议为发布时所有状态正常、允许接收系统消息的用户；如果产品要求按城市、用户组或订阅范围推送，必须将筛选条件保存到消息快照或投递批次，不能在发送过程中使用会变化的临时条件导致结果不一致。

## 5. 推荐数据模型

### 5.1 消息表

```sql
CREATE TABLE content_messages (
  id VARCHAR(64) NOT NULL,
  title VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL,
  summary VARCHAR(300) NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  scheduled_at DATETIME(3) NULL,
  published_at DATETIME(3) NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX idx_content_messages_status_time (status, scheduled_at),
  CONSTRAINT ck_content_messages_status CHECK (status IN ('draft','scheduled','published'))
);
```

### 5.2 调度任务表

可以复用现有任务系统；没有现成任务系统时新增：

```sql
CREATE TABLE content_publish_jobs (
  id VARCHAR(64) NOT NULL,
  message_id VARCHAR(64) NOT NULL,
  run_at DATETIME(3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  locked_at DATETIME(3) NULL,
  last_error VARCHAR(1000) NULL,
  executed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_content_publish_job_message (message_id),
  INDEX idx_content_publish_jobs_due (status, run_at)
);
```

### 5.3 通知投递表与 outbox

通知必须具备业务唯一键，推荐：`system_message:{messageId}:{userId}`。

```sql
CREATE TABLE user_notifications (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(120) NOT NULL,
  content VARCHAR(2000) NOT NULL,
  related_id VARCHAR(64) NULL,
  dedupe_key VARCHAR(220) NOT NULL,
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_notifications_dedupe (dedupe_key),
  INDEX idx_user_notifications_user_time (user_id, created_at DESC)
);
```

大规模用户投递建议使用 outbox：发布事务写入 `notification_outbox`，后台 worker 批量创建 `user_notifications`；worker 必须支持重试、退避和死信记录。小规模同步写入也必须有唯一键兜底，不能依赖“代码只执行一次”的假设。

## 6. 定时调度要求（不可省略）

定时发送不是前端提示，也不是浏览器定时器。后端必须：

1. 将 `scheduledAt` 和任务状态持久化到数据库；
2. 使用可靠 worker、队列消费者或数据库抢占式轮询执行；
3. 多实例部署时使用行锁、租约或等价机制，确保同一任务只有一个执行者；
4. 执行前再次检查消息状态仍为 `scheduled`；
5. 状态更新和投递批次创建具备幂等性；
6. 失败自动重试，并记录 `attempts`、`last_error`；
7. 服务重启后能扫描并恢复未执行任务；
8. 处理过期任务：系统恢复后立即执行仍有效的任务，或按产品规则标记失败，不能静默丢弃；
9. 明确时区。接口传 ISO 8601 时间，数据库统一 UTC，展示时按用户/系统时区转换；
10. 监控待执行、执行失败、死信和通知投递延迟。

推荐抢占逻辑：事务内选取 `status='pending' AND run_at <= now()` 的任务，使用 `SELECT ... FOR UPDATE SKIP LOCKED`（或当前数据库等价机制）标记 `running`，提交后执行发布；发布完成再标记 `succeeded`。异常则增加次数并回到 `pending` 或进入 `dead`。

## 7. 并发、幂等与权限

- 管理接口必须校验管理员 Token，并校验内容管理权限；
- 创建接口支持 `Idempotency-Key`，重复请求返回第一次创建结果；
- 更新使用 `version` 或 `updatedAt` 乐观锁，防止两个管理员覆盖彼此修改；
- 发布操作使用唯一业务键 `content_publish:{messageId}`；
- 用户通知使用唯一键 `system_message:{messageId}:{userId}`；
- 删除草稿使用幂等 DELETE；已删除再次删除返回成功或明确的资源不存在错误，前端均不得误删其他记录；
- 日志记录管理员、IP、操作类型、消息 ID、旧状态、新状态和失败原因；
- 标题、摘要、正文按长度和内容策略校验，输出时防止 XSS。

## 8. 错误码建议

| 错误码 | 含义 |
|---|---|
| `CONTENT_NOT_FOUND` | 消息不存在 |
| `CONTENT_INVALID_STATUS` | 状态非法 |
| `CONTENT_SCHEDULE_REQUIRED` | 定时状态缺少发送时间 |
| `CONTENT_SCHEDULE_IN_PAST` | 定时发送时间已过去 |
| `CONTENT_ALREADY_PUBLISHED` | 已发布消息不可覆盖 |
| `CONTENT_NOT_DELETABLE` | 只有草稿可删除 |
| `CONTENT_VERSION_CONFLICT` | 内容已被其他管理员修改 |
| `CONTENT_PUBLISH_FAILED` | 发布或通知批次创建失败 |
| `CONTENT_PERMISSION_DENIED` | 无内容管理权限 |

## 9. 验收标准

- [ ] 管理端首次打开从 `GET /api/admin/content/news` 加载，浏览器清空 localStorage 后仍可正常显示后端数据。
- [ ] 新建草稿后刷新页面，草稿仍存在；删除后刷新页面不再出现。
- [ ] 立即发布后，消息状态为 `published`，并能在用户端通知按钮中看到一条 `type=system` 通知。
- [ ] 新建定时消息后，管理端显示 `scheduled` 和准确的 `scheduledAt`。
- [ ] 关闭管理端页面、重启 API 服务后，到达时间仍能自动发布。
- [ ] 定时任务只执行一次；重复 worker、重试或网络抖动不会产生重复通知。
- [ ] 定时消息修改时间后，旧任务不会再次执行；取消后不再发布。
- [ ] 过去时间、非法状态、无权限、版本冲突均返回明确错误码。
- [ ] 用户通知按用户隔离，已读状态不影响其他用户。
- [ ] 可查询任务失败、重试、死信和投递延迟，便于运营排障。

## 10. 联调约定

前端接入后以接口返回的状态为准，不在前端模拟发布、模拟定时器或用 localStorage 补数据。后端完成以上持久化调度和通知投递后，前端的“定时发送”即代表真实已创建定时任务；不再显示“等待后端调度”之类的降级文案。
