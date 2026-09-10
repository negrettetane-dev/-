# 智途云枢 · 市民端消息通知设置持久化（后端调整方案）

> 对应前端现状（已合并至 main 的市民端设置页 + 通知中心）：市民端「我的 → 设置 → 消息通知」开关
> 已接入本地持久化（localStorage，按用户作用域），切换时调用下列接口做云端同步；
> 接口不可用时静默降级为仅本地保存。

## 一、现状与目标

| 项 | 现状 | 目标 |
|---|---|---|
| 设置存储 | 仅前端 localStorage，换设备/清缓存即丢失 | 后端按用户持久化，多设备一致 |
| 设置作用域 | 旧版公共 key，所有账号共用一份 | 按 user_id 隔离，切换账号不串号 |
| 通知生效 | 设置不参与任何通知分发逻辑 | 通知分发前按类别开关过滤 |

前端字段（4 个布尔开关，`true`=开启推送），后端需一一对应：

| 字段 | 前端文案 | 含义 | 默认值 |
|---|---|---|---|
| carbon | 碳积分推送 | 积分获取、扣减、兑换及奖励到账提醒 | true |
| weather | 天气预警提醒 | 影响出行的恶劣天气和气象预警 | true |
| event | 事件进度通知 | 市民上报事件的受理、状态变化与办结结果 | true |
| system | 系统消息 | 密码修改、邮箱绑定等账号安全通知 | true |

> 字段演进说明：旧版本前端曾使用 `congestion` / `control` / `workorder` 三个类别，
> 现已合并为「碳积分 `carbon`」「事件 `event`」，仅保留 `weather` / `system` 语义不变。
> 若后端已有旧字段，请按下表做兼容映射（旧值仅在首次迁移时读取）：
>
> | 旧字段 | 新字段 |
> |---|---|
> | congestion（拥堵预警） | carbon |
> | control（交通管制） | carbon |
> | workorder（工单进度） | event |
>
> 前端本地存储已做该兼容（旧 `congestion`/`workorder` 值会回填到 `carbon`/`event`），后端可按新字段一次性重建。

## 二、接口设计

前端调用路径固定为 `/api/notification-settings`（axios baseURL 已是 `/api`，故代码中写 `/notification-settings`）。

### GET /api/notification-settings

需 Bearer Token。返回：

```json
{
  "code": 0,
  "data": { "carbon": true, "weather": true, "event": true, "system": true },
  "message": "ok",
  "timestamp": 1789012345678
}
```

- 用户从未设置过 → 返回全部默认值（上表），并落库一份默认记录；
- 未登录（无 Token）→ 返回 `code=401`，前端降级为仅本地保存。

### PUT /api/notification-settings

前端在**每次开关切换时**调用（无独立「保存」按钮），请求体即上表结构：

```json
{ "carbon": true, "weather": true, "event": false, "system": true }
```

要求：

1. 需 Bearer Token，按 Token 解析 user_id，**不信任请求体中的任何身份字段**；
2. 4 个字段均为可选，缺省字段保持原值不变（整体覆盖亦可，前端始终发送全量字段）；
3. 未知字段忽略；值非布尔 → 返回 `code=400`；
4. 成功返回 `{ code: 0, data: { ...全量设置 } }`；
5. 幂等：重复提交相同值直接返回成功。

### 合并建议（可选，减少首屏请求）

`POST /api/auth/login`、`GET /api/user/profile` 可增加 `notificationSettings` 字段；
`packages/citizen/src/components/NotificationBell/NotificationBell.tsx` 目前单独 GET 一次该接口，若登录响应已带设置可省掉这次请求。此项非必需。

## 三、数据模型

新增表 `user_notification_settings`：

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | varchar(64) PK | 用户 ID |
| carbon | tinyint(1) | 碳积分推送，默认 1 |
| weather | tinyint(1) | 天气预警，默认 1 |
| event | tinyint(1) | 事件进度，默认 1 |
| system | tinyint(1) | 系统消息，默认 1 |
| updated_at | datetime | 最近更新时间 |

- 使用单行 upsert（`INSERT ... ON DUPLICATE KEY UPDATE`）；
- 注册用户时按默认值初始化一行；
- 该表读取频率高（每次通知分发前），建议加进程内缓存（TTL 30~60s）或 Redis 缓存，PUT 后失效。

## 四、与通知分发的联动

所有给市民的站内/短信/推送通知在落库或外发前，必须先查该用户的类别开关：

```
通知(type=carbon)   → 检查 user_notification_settings.carbon   （含积分到账、兑换结果）
通知(type=weather)  → 检查 weather
通知(type=event)    → 检查 event                                （含事件状态变更、平台反馈下发）
通知(type=system)   → 检查 system                               （含密码/邮箱变更等安全通知）
```

开关关闭时：**跳过通知**，但业务主数据（如事件状态、平台反馈）不受影响照常更新。
这与 `backend-incident-status-feedback.md` 中「管理端保存状态时向市民推送事件进度通知」的流程衔接：
事件状态通知的类别为 `event`，落通知记录前先判断该用户 `event` 开关。

## 五、前端行为说明（后端联调参考）

1. 进入设置页：先用 localStorage 中的用户作用域数据立即渲染（刷新不丢）；随后异步 GET 拉取云端设置，成功后以云端为准覆盖本地。
2. 切换开关：立即写 localStorage，随后 PUT 同步云端；页面提示「已保存 / 已保存到当前设备，联网后将同步」。
3. 未登录：只走本地持久化，不调用接口（接口会返回 401）。
4. 退出登录：本地用户作用域设置被清理（含 `notification_settings:{userId}` 前缀 key），重新登录后以云端为准。

## 六、验收清单

- [ ] GET 返回当前用户全量设置，未设置用户返回默认值
- [ ] PUT 按 Token 用户落库，A 用户设置不影响 B 用户
- [ ] 未登录访问返回 401，前端不报错崩溃
- [ ] 非法值（非布尔）返回 400；未知字段被忽略
- [ ] 关闭 `event` 后，管理端更新事件状态不再给该市民产生通知记录
- [ ] 重新开启后恢复通知
- [ ] 多端登录同一账号，任一端修改后其他端拉取到一致设置
