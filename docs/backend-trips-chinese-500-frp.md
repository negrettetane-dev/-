# 智途云枢 · POST /api/trips 中文 name/address 在 frp 生产链路稳定 500

> 供后端负责人在 **frp 生产环境**（`frp-six.com:32356`）复现，不是本地 8000。
> 前端已验证 frp 后端是新代码（序列化修复生效），但中文文本字段写入仍 500。

## 结论先行

**`POST https://frp-six.com:32356/api/trips` 只要 body 含中文文本字段（origin.name / origin.address 等）就稳定返回 HTTP 500；数字/空串正常。**

本地测试 200 不代表生产没问题——请**直接打 frp 域名**复现，不要测本地 8000。

## 精确复现步骤

1. 获取 token（任选一个已注册用户）：
```bash
TOKEN=$(curl -sk -X POST https://frp-six.com:32356/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"<用户>","password":"<密码>"}' | jq -r .data.token)
```

2. 中文 name → **500**：
```bash
curl -sk -X POST https://frp-six.com:32356/api/trips \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"clientSessionId":"t_zh_1","mode":"walk","origin":{"name":"西单"}}'
# → Internal Server Error [HTTP 500]
```

3. 数字 name → **200**（对照）：
```bash
curl -sk -X POST https://frp-six.com:32356/api/trips \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"clientSessionId":"t_num_1","mode":"walk","origin":{"name":123}}'
# → HTTP 200
```

4. 空串 name → **200**（对照）：
```bash
curl -sk -X POST https://frp-six.com:32356/api/trips \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"clientSessionId":"t_empty_1","mode":"walk","origin":{"name":""}}'
# → HTTP 200
```

## 实测矩阵（2026-08-21，frp 生产链路）

| origin.name / origin.address | 结果 |
|---|---|
| `"西单"`（中文） | ❌ 500 |
| `"西单北大街"`（中文 address） | ❌ 500 |
| `123`（数字） | ✅ 200 |
| `""`（空串） | ✅ 200 |
| 无 origin 对象 | ✅ 200 |

## 已排除的可能（后端此前排查过）

- ❌ origin/destination 可空对象 → 已安全（`body.get("origin") or {}`）
- ❌ lng/lat 为 null → 已安全
- ❌ path 嵌套数组 → 已正确
- ❌ 响应序列化缺字段 → 已修复（createdAt/clientSessionId/path 均返回，确认 frp 是新代码）
- ❌ 数据库连接/列字符集 → 后端本地查为 utf8mb4，但 **frp 生产进程的 charset 未验证**

## 最可能的根因（需后端在 frp 环境验证）

所有**中文文本字段**（name/address）都崩，指向**INSERT 中文时的编码问题**，而非单个字段逻辑。重点检查 frp 生产进程：
1. **frp 后端的数据库连接 charset** 是否确实 `utf8mb4`（本地 vs 生产环境变量/启动参数可能不同）
2. **frp 后端是否真的重启**了新代码（`reload=False` 时改 `trip_routes.py` 不会热更新，需手动重启进程）
3. INSERT 中文 name 时数据库是否报 `Incorrect string value`（这类错误常被包装成 500）

## 前端契约（无需改动）

前端 `POST /api/trips` 发送标准 UTF-8 中文 name/address：
```json
{
  "clientSessionId": "test_final_zh",
  "mode": "bike",
  "profile": "standard",
  "origin": { "name": "西单", "address": "西单北大街", "lng": 116.38, "lat": 39.91 },
  "destination": { "name": "国贸", "address": "建国门外大街", "lng": 116.46, "lat": 39.91 },
  "routeSnapshot": { "estimatedDistance": 8000, "estimatedDuration": 1800, "routeProvider": "amap" },
  "dataSource": "real"
}
```

## 修复后验证命令（前端会用它确认闭环）

```bash
# 创建（含中文 name）→ 应 200 且返回 id
curl -sk -X POST https://frp-six.com:32356/api/trips \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"clientSessionId":"verify_zh_1","mode":"bike","profile":"standard","origin":{"name":"西单","address":"西单北大街","lng":116.38,"lat":39.91},"destination":{"name":"国贸","address":"建国门外大街","lng":116.46,"lat":39.91},"routeSnapshot":{"estimatedDistance":8000,"estimatedDuration":1800,"routeProvider":"amap"},"dataSource":"real"}'

# complete → 应 200 且结算积分（earnedPoints>0）
curl -sk -X POST https://frp-six.com:32356/api/trips/<返回的id>/complete \
  -H "Authorization: Bearer $TOKEN"
```
