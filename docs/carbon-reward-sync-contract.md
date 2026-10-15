# 碳积分商品、库存与兑换接口契约

本文档用于市民端、管理端与后端联调。目标是让管理端维护的商品配置成为唯一数据源：管理端新增、修改、上下架或调整库存后，市民端读取到同一份数据；市民兑换成功后，后端原子扣减积分和库存，管理端再次查询可看到最新库存。

## 1. 范围与原则

- 商品主数据只以服务端数据库为准，前端 `localStorage` 只能作为离线演示降级，不能作为生产数据源。
- 管理端负责商品配置；市民端只读取可兑换商品并发起兑换；后端负责权限、积分、库存、兑换记录和事务。
- 前端不自行扣库存、不自行扣积分、不根据本地计算判断兑换成功。
- 所有时间使用 ISO 8601 UTC 字符串，例如 `2026-09-10T08:30:00Z`。
- 金额/积分/库存均使用非负整数；积分扣减必须记录流水，禁止直接覆盖余额而不留审计记录。

## 2. 统一响应格式

成功：

```json
{ "code": 0, "message": "ok", "data": {}, "requestId": "req_..." }
```

失败：

```json
{ "code": "REWARD_OUT_OF_STOCK", "message": "商品库存不足", "data": { "rewardId": "rw1" }, "requestId": "req_..." }
```

建议 HTTP 状态：`400` 参数错误，`401` 未登录，`403` 无权限，`404` 不存在，`409` 并发/状态冲突，`422` 业务校验失败，`500` 服务端错误。

## 3. 数据模型

### 3.1 商品 `CarbonReward`

```ts
interface CarbonReward {
  id: string;                 // 服务端生成，客户端不可自定义覆盖已有 ID
  name: string;               // 1-80 字符
  description: string;        // 0-500 字符
  cost: number;               // 兑换所需积分，整数 >= 0
  stock: number;              // 当前可兑换库存，整数 >= 0
  enabled: boolean;           // 是否上架
  version: number;            // 乐观锁版本，每次修改 +1
  updatedAt: string;
  updatedBy?: string;
}
```

### 3.2 兑换记录 `Redemption`

```ts
interface Redemption {
  id: string;
  userId: string;
  rewardId: string;
  rewardNameSnapshot: string;
  pointsCostSnapshot: number;
  status: 'unused' | 'used' | 'expired' | 'cancelled';
  redeemedAt: string;
  usedAt?: string;
  expiresAt?: string;
  idempotencyKey: string;
}
```

商品名称和积分成本必须在兑换时保存快照，避免管理员后续修改商品后历史记录展示错误。

## 4. 管理端接口

### 4.1 查询商品列表

`GET /api/admin/carbon/rewards`

权限：管理员角色。支持 `enabled`、`keyword`、`page`、`pageSize` 查询参数。返回全部商品，包括下架和库存为 0 的商品。

```json
{
  "code": 0,
  "data": {
    "items": [{ "id": "rw1", "name": "公交9折优惠券", "description": "...", "cost": 200, "stock": 998, "enabled": true, "version": 4, "updatedAt": "2026-09-10T08:30:00Z" }],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### 4.2 新增商品

`POST /api/admin/carbon/rewards`

请求：`{ name, description, cost, stock, enabled }`。服务端生成 `id/version/updatedAt`，返回完整商品。

### 4.3 修改商品

`PUT /api/admin/carbon/rewards/:id`

请求：`{ name, description, cost, stock, enabled, version }`。必须校验 `version`，版本不一致返回 `409 REWARD_VERSION_CONFLICT`，防止两个管理员互相覆盖。

### 4.4 上下架

`PATCH /api/admin/carbon/rewards/:id/status`，请求 `{ enabled, version }`。下架不删除历史兑换记录；下架后市民端不可新兑换。

### 4.5 调整库存

`POST /api/admin/carbon/rewards/:id/stock-adjustments`，请求 `{ delta, reason, version }`。

- `delta` 可正可负，但调整后库存不得小于 0。
- 必须写入库存流水：操作人、调整前、调整量、调整后、原因、时间。
- 不建议管理端直接覆盖 `stock`，避免覆盖兑换过程中产生的扣减。

### 4.6 管理端兑换/库存流水

- `GET /api/admin/carbon/rewards/:id/inventory-logs`
- `GET /api/admin/carbon/redemptions?status=&rewardId=&page=&pageSize=`

用于核对“管理调整”和“市民兑换”两类库存变化。

## 5. 市民端接口

### 5.1 查询可兑换商品

`GET /api/rewards`

无需登录可返回公共商品列表；如果产品要求登录后兑换，兑换按钮点击时必须再次校验登录。只返回 `enabled=true && stock>0` 的商品；建议返回 `stock` 和 `updatedAt`，前端展示“库存紧张”仅作提示。

### 5.2 原子兑换

`POST /api/rewards/redeem`

请求头：`Authorization: Bearer <token>`、`Idempotency-Key: <客户端生成的唯一 UUID>`。

请求体：`{ rewardId: "rw1" }`。

后端事务顺序：

1. 校验 Token 和幂等键；相同幂等键已成功时返回原结果，不重复扣减。
2. `SELECT ... FOR UPDATE` 锁定商品行。
3. 校验商品存在、已上架、库存大于 0。
4. 锁定积分账户并校验余额大于等于商品成本。
5. 扣减积分余额、库存减 1。
6. 创建兑换记录和积分流水（负数）。
7. 提交事务并返回结果；任何一步失败全部回滚。

成功返回：

```json
{ "code": 0, "data": { "success": true, "redemptionId": "rd1", "rewardId": "rw1", "rewardName": "公交9折优惠券", "pointsCost": 200, "remainingPoints": 800, "stock": 998, "redeemedAt": "2026-09-10T08:30:00Z" } }
```

失败业务码：`REWARD_NOT_FOUND`、`REWARD_OFFLINE`、`REWARD_OUT_OF_STOCK`、`INSUFFICIENT_POINTS`、`DUPLICATE_REDEMPTION`、`IDEMPOTENCY_CONFLICT`。

### 5.3 查询我的兑换记录

`GET /api/redemptions?status=unused|used|expired`

只能返回当前用户记录，默认按 `redeemedAt DESC` 返回。前端最多展示两条摘要，详情页再分页加载全部记录。

### 5.4 使用兑换权益

`POST /api/redemptions/:id/use`

只能由记录所属用户调用。仅允许 `unused -> used`，服务端写入 `usedAt`；重复调用返回 `409 REDEMPTION_ALREADY_USED`，不能重复产生副作用。

## 6. 数据库与事务建议

- `carbon_rewards`：商品、库存、上下架、`version`、更新时间。
- `carbon_inventory_logs`：`reward_id、change_type(admin_adjust|redeem|rollback)、before_stock、delta、after_stock、operator_id、reference_id、reason、created_at`。
- `point_accounts`：用户积分余额，按用户行锁定。
- `point_transactions`：签到、绿色出行、兑换扣减等不可变流水。
- `redemptions`：兑换快照、状态、幂等键和使用时间。
- `idempotency_records`：用户、幂等键、请求摘要、响应快照、过期时间；建议保留至少 24 小时。

兑换事务必须保证：积分扣减成功 ⇔ 库存扣减成功 ⇔ 兑换记录创建成功。不能先调用一个服务成功后再异步补偿另一个服务而对前端返回成功。

## 7. 同步策略

- 管理端保存后以接口返回值刷新本地列表，不依赖本地缓存作为成功依据。
- 市民端进入页面、兑换成功、兑换失败收到库存冲突时重新请求 `/api/rewards`。
- 管理端建议每 30 秒轮询；更优方案是后端发布 `carbon.reward.updated`，前端收到事件后重新拉取列表。
- Redis/HTTP 缓存必须短 TTL，并在商品保存或兑换成功后主动失效；不能让市民端长期看到旧库存。
- 后端返回 `ETag`/`Last-Modified` 时，前端可使用条件请求降低流量，但不能牺牲库存实时性。

## 8. 验收标准

1. 管理端新增商品并保存后，市民端刷新即可看到同名、同积分、同库存商品。
2. 管理端下架商品后，市民端不再展示且接口不能兑换。
3. 管理端把库存从 10 调整为 3，市民端查询返回 3。
4. 市民成功兑换 1 次后，积分减少对应成本、库存减少 1、生成 1 条 `unused` 记录，管理端查询库存同步减少。
5. 两个用户同时兑换最后 1 件库存时，只允许 1 个成功，另一个收到 `409 REWARD_OUT_OF_STOCK`，不能出现负库存。
6. 网络重试使用相同 `Idempotency-Key` 时只产生 1 次扣分、1 次扣库存、1 条兑换记录。
7. 重复点击“去使用”只能成功一次，记录最终为 `used`。
8. 管理员并发编辑同一商品时，旧版本保存返回 `409`，不能覆盖新版本。
9. 商品名称/成本修改后，历史兑换记录仍展示兑换时快照。
