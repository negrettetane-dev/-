# 碳积分商品同步接口契约

管理端维护商品名称、说明、积分成本、库存和上下架状态；市民端读取同一后端数据。兑换必须由后端原子校验积分与库存，成功后库存减少 1。

## 接口

- `GET /api/carbon/rewards`：管理端商品列表，返回 `code: 0, data: CarbonReward[]`，字段包含 `id/name/description/cost/stock/enabled/updatedAt`。
- `PUT /api/carbon/rewards`：管理端保存，请求 `{ rewards: [{ id, name, description, cost, stock, enabled }] }`，服务端校验名称、成本和库存，并返回保存后的完整列表。
- `GET /api/rewards`：市民端只返回 `enabled=true` 且 `stock>0` 的商品。
- `POST /api/rewards/redeem`：请求 `{ rewardId }`。服务端事务锁定商品库存，校验上架、库存和积分，成功后同时扣积分、库存减 1、创建兑换记录，失败全部回滚，返回 `{ rewardName, pointsCost, remainingPoints, stock }`。
- `POST /api/redemptions/:id/use`：仅允许当前用户将 `unused` 兑换记录转为 `used`，重复核销返回业务错误。

## 一致性要求

- 管理端保存成功、市民端进入页面或兑换成功后都重新请求商品列表。
- 管理端建议 30 秒轮询或使用 WebSocket/SSE 事件 `carbon.reward.updated` 后重新拉取。
- 库存竞争返回 `409`，前端提示“库存刚刚发生变化，请刷新后重试”。
- 兑换使用 `Idempotency-Key` 防重复扣库存，所有接口鉴权并记录管理员审计日志。
- 建议表：`carbon_rewards`、`point_accounts`、`redemptions`、`point_transactions`、`carbon_inventory_logs`。
