# 智途云枢 · 市民端消息通知设置持久化（后端调整方案）

> 对应前端改动：市民端「设置 → 消息通知」开关已接入本地持久化（localStorage，按用户作用域），
> 切换时会调用下列接口做云端同步；接口不可用时静默降级为仅本地保存。
> 前端分支：`feature/incidents-status-i18n-feedback`

## 一、现状与目标

| 项 | 现状 | 目标 |
|---|---|---|
| 设置存储 | 仅前端 localStorage，换设备/清缓存即丢失 | 后端按用户持久化，多设备一致 |
| 设置作用域 | 旧版公共 key，所有账号共用一份 | 按 user_id 隔离，切换账号不串号 |
| 通知生效 | 设置不参与任何通知分发逻辑 | 通知分发前按类别开关过滤 |

前端字段与后端需一一对应（布尔开关，`true`=开启推送）：

| 字段 | 含义 | 前端默认值 |
|---|---|---|
| congestion | 拥堵预警推送 | true |
| weather | 天气预警提醒 | true |
| control | 交通管制通知 | true |
| workorder | 工单进度通知（事件状态变更通知） | true |
| system | 系统消息 | false |

## 二、接口设计

### GET /api/users/me/notification-settings

需 Bearer Token。返回：

```json
{
  "code": 0,
  "data": {
    "congestion": true,
    "weather": true,
    "control": false,
    "workorder": true,
    "system": false
  },
  "message": "ok",
  "timestamp": 1789012345678
}
```

- 用户从未设置过 → 返回全部默认值（上表），同时落库一份默认记录。

### PUT /api/users/me/notification-settings

前端在**每次开关切换时**调用（无独立「保存」按钮），请求体即上表结构：

```json
{ "congestion": true, "weather": true, "control": false, "workorder": true, "system": false }
```

要求：

1. 需 Bearer Token，按 Token 解析 user_id，**不信任请求体中的任何身份字段**；
2. 5 个字段均为可选，缺省字段保持原值不变（整体覆盖亦可，前端始终发送全量字段）；
3. 未知字段忽略；值非布尔 → 返回 `code=400`；
4. 成功返回 `{ code: 0, data: { ...全量设置 } }`；
5. 幂等：重复提交相同值直接返回成功。

### （可选）登录响应/个人资料携带设置

`POST /api/auth/login`、`GET /api/user/profile` 可增加 `notificationSettings` 字段，减少首屏一次请求。前端当前通过 GET 接口拉取，此项非必需。

## 三、数据模型

新增表 `user_notification_settings`：

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | varchar(64) PK | 用户 ID |
| congestion | tinyint(1) | 拥堵预警，默认 1 |
| weather | tinyint(1) | 天气预警，默认 1 |
| control | tinyint(1) | 交通管制，默认 1 |
| workorder | tinyint(1) | 工单进度，默认 1 |
| system | tinyint(1) | 系统消息，默认 0 |
| updated_at | datetime | 最近更新时间 |

- 使用单行 upsert（`INSERT ... ON DUPLICATE KEY UPDATE`）；
- 注册用户时按默认值初始化一行；
- 该表读取频率高（每次通知分发前），建议加进程内缓存（TTL 30~60s）或 Redis 缓存，PUT 后失效。

## 四、与通知分发的联动

所有给市民的站内/短信/推送通知在落库或外发前，必须先查该用户的类别开关：

```
通知(type=workorder)  → 检查 user_notification_settings.workorder
通知(type=congestion)  → 检查 congestion
通知(type=weather)     → 检查 weather
通知(type=control)     → 检查 control
通知(type=system)      → 检查 system
```

开关关闭时：**跳过通知**，但业务主数据（如工单状态、平台反馈）不受影响照常更新。
这与 `backend-incident-status-feedback.md` 中「管理端保存状态时向市民推送工单进度通知」的流程衔接。

## 五、前端行为说明（后端联调参考）

1. 进入设置页：先渲染 localStorage 中的用户作用域数据；已登录则异步 GET 拉取云端设置，成功后以云端为准覆盖本地。
2. 切换开关：立即写 localStorage（保证后端不可用时刷新不丢失），随后 PUT 同步云端；页面底部显示「已同步到云端 / 暂存本机」状态。
3. 未登录：只走本地持久化，不调用接口。
4. 退出登录：本地用户作用域设置被清除，重新登录后以云端为准。

## 六、验收清单

- [ ] GET 返回当前用户全量设置，未设置用户返回默认值
- [ ] PUT 按 Token 用户落库，A 用户设置不影响 B 用户
- [ ] 非法值（非布尔）返回 400；未知字段被忽略
- [ ] 关闭 `workorder` 后，管理端更新事件状态不再给该市民产生通知记录
- [ ] 重新开启后恢复通知
- [ ] 多端登录同一账号，任一端修改后其他端拉取到一致设置
