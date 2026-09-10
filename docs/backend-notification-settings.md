# 市民端消息设置持久化 · 前端实现补充（后端联调参考）

> ⚠️ **本文档不是接口契约的唯一来源。** 市民端通知接口与数据模型的**权威定义**见
> `docs/citizen-notification-backend-contract.md`（含 `GET/PUT /api/notification-settings`、
> 通知表、outbox、验收标准）。若两者表述不一致，**以该文档为准**。
>
> 本文档只补充前端侧的实现细节与联调注意点，便于后端确认接口行为是否被前端正确消费。

## 一、契约对照（前端实际调用）

| 项 | 前端实际值 | 来源 |
|---|---|---|
| 设置读取 | `GET /api/notification-settings` | `packages/citizen/src/pages/profile/SettingsPage.tsx`、`components/NotificationBell/NotificationBell.tsx` |
| 设置写入 | `PUT /api/notification-settings`，请求体为 4 个布尔字段全量提交 | 同上 |
| 字段 | `carbon` / `weather` / `event` / `system` | `stores/persistence.ts` 的 `NotificationSettings` |
| 默认值 | 四项均为 `true` | 同上 |
| 未登录行为 | 前端只写本地，不调接口；若接口返回 401 前端静默兜底到本地数据 | 同上 |

后端返回体需为统一包装：`{ code: 0, data: {...}, message, timestamp }`（前端 `apiGet/apiPut` 会取 `data`）。

## 二、前端实现要点（影响后端预期的行为）

1. **本地优先渲染**：进入设置页先用 localStorage 数据渲染，再异步 GET 云端设置，成功后以云端覆盖本地。因此云端返回的字段必须是全量的，否则会被前端用本地默认值补齐。
2. **切换即保存，无独立保存按钮**：每次点击开关立即 PUT 全量设置。后端需接受高频、重复请求（幂等）。
3. **静默降级**：PUT 失败（接口未实现 / 网络异常 / 401）时前端仅本地保存，提示「已保存到当前设备，联网后将同步」，不阻塞交互、不弹错误。后端联调阶段可放心先返回 404/501。
4. **用户作用域隔离**：localStorage 使用 `notification_settings:{userId}` 前缀；**退出登录会按前缀清理**（`clearPersonalData`），避免换账号后读到上一个账号的开关状态。
5. **旧数据兼容**：本地旧 key（`congestion` → `carbon`，`workorder` → `event`）在首次读取时回填到新字段，后端不需要兼容旧字段。
6. **通知分发联动**：通知中心（`NotificationBell`）与设置页共用同一份设置，因此**后端必须在写通知记录前判断对应用户的类别开关**，否则会出现「设置里关闭了但通知中心仍有该消息」的不一致。

## 三、联调验收（前端视角）

- [ ] 未登录：进入设置页可正常切换开关并刷新保留（不报错、不发请求）
- [ ] 已登录首次进入：GET 返回默认值，界面四项全开
- [ ] 切换任一项后刷新页面，开关状态保持（本地持久化生效）
- [ ] 多端登录同一账号：A 端修改后刷新 B 端，读到一致设置
- [ ] 后端关闭 `event` 开关后，管理端更新事件状态不产生新通知（通知中心不新增）
- [ ] 退出登录再登录其他账号，设置互不串号
