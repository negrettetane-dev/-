# 无障碍设施站点接口修复说明

## 1. 当前问题

市民端无障碍路线和 AI 出行助手已经请求以下接口获取真实站点设施数据：

```http
GET /api/accessibility/stations
```

当前浏览器实际请求结果：

```text
GET http://192.168.245.1:3000/api/accessibility/stations 500 Internal Server Error
```

市民端的 Vite 开发服务器将 `/api` 代理到后端。因此该 `500` 是后端接口或其数据库查询抛出的内部异常，不是前端未调用、跨域或前端字段解析错误。

前端在接口失败时会明确显示“后端数据未成功加载，待确认”，不会把演示数据伪装成真实无障碍状态。

## 2. 影响范围

接口返回 `500` 时，以下真实设施能力无法展示或参与推荐：

- 地铁/公交站是否有电梯。
- 出入口是否只有楼梯。
- 是否有坡道、轮椅可通行入口。
- 无障碍卫生间。
- 设施状态：`verified`、`unknown`、`obstacle`。
- 对轮椅、老人、婴儿车用户的无障碍路线排序。

以下路线指标不依赖该接口，仍由高德真实路线结果提供：

- 预计用时。
- 总距离。
- 步行距离。
- 换乘次数。
- 公交/地铁预计费用。

## 3. 接口要求

### 3.1 访问范围

接口用于市民端路线规划，必须允许**未登录和普通市民登录态**读取。

- 不应要求管理员角色。
- 鉴权失败应返回 `401` 或 `403`，不能转换为 `500`。
- 无数据时返回 `200` 和空列表，不能返回 `500`。

### 3.2 路由

```http
GET /api/accessibility/stations?page=1&pageSize=200
```

前端目前支持不带分页参数的读取；后端可以使用默认分页。建议默认最多返回 `200` 条，确保一次可覆盖当前路线途经站点。

### 3.3 成功响应

所有成功响应都使用项目统一信封：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "stationId": "bj_wangfujing",
        "stationName": "王府井",
        "lng": 116.410,
        "lat": 39.914,
        "accessibleRestroom": true,
        "source": "backend",
        "entrances": [
          {
            "id": "entrance_wfj_a",
            "name": "A口",
            "elevator": true,
            "ramp": true,
            "stairsOnly": false,
            "wheelchairAccessible": true,
            "status": "verified"
          },
          {
            "id": "entrance_wfj_c",
            "name": "C口",
            "elevator": false,
            "ramp": false,
            "stairsOnly": true,
            "wheelchairAccessible": false,
            "status": "obstacle"
          }
        ]
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 200
  },
  "timestamp": 1790070000000
}
```

也可以让 `data` 直接为数组：

```json
{
  "code": 0,
  "message": "ok",
  "data": []
}
```

市民端已兼容 `data` 直接数组、`data.list`、`data.items`，并兼容下划线字段：`station_name`、`accessible_restroom`、`stairs_only`、`wheelchair_accessible`。

### 3.4 字段约束

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `stationId` | string | 是 | 站点唯一标识。可兼容后端 `id`。 |
| `stationName` | string | 是 | 用于和高德路线返回的站名匹配。请使用正式站名，例如“王府井”“北京西站”。 |
| `lng` / `lat` | number | 建议 | GCJ-02 坐标，用于地图设施标记；缺失不应导致接口失败。 |
| `accessibleRestroom` | boolean | 是 | 站内是否有无障碍卫生间。 |
| `entrances` | array | 是 | 即使没有入口数据也应返回 `[]`。 |
| `entrances[].name` | string | 是 | 出入口名称，例如“A口”。 |
| `entrances[].elevator` | boolean | 是 | 是否有电梯。 |
| `entrances[].ramp` | boolean | 是 | 是否有坡道。 |
| `entrances[].stairsOnly` | boolean | 是 | 是否仅能走楼梯；轮椅硬障碍。 |
| `entrances[].wheelchairAccessible` | boolean | 是 | 该入口是否轮椅可通行。 |
| `entrances[].status` | enum | 是 | 只能是 `verified`、`unknown`、`obstacle`。 |
| `source` | string | 建议 | 返回 `backend`，表示后台维护的真实设施数据。 |

`status` 语义：

| 值 | 市民端文案 | 含义 |
| --- | --- | --- |
| `verified` | 已确认可用 | 最近有效核验显示设施可用。 |
| `unknown` | 状态未知 | 未覆盖、过期或无法确认；不能当作可用。 |
| `obstacle` | 当前障碍 | 故障、关闭或存在硬性通行障碍。 |

## 4. 后端排查清单

请优先查看这次 `GET /api/accessibility/stations` 对应的后端异常堆栈。常见导致 `500` 的位置如下。

### 4.1 路由或鉴权中间件

- 市民端路由是否已注册为 `/api/accessibility/stations`。
- 是否误复用了管理端的管理员鉴权。
- 鉴权对象不存在时，是否发生了类似 `user.role` 的空对象访问。
- 普通用户或游客访问时，必须安全返回公开设施列表。

### 4.2 数据库迁移

确认站点表、入口表及外键迁移已在当前运行环境执行。

建议的最小字段：

```text
accessibility_stations
  id / station_id
  station_name
  lng
  lat
  accessible_restroom
  source

accessibility_entrances
  id
  station_id
  name
  elevator
  ramp
  stairs_only
  wheelchair_accessible
  status
```

需要确认：

- 生产/联调库中是否实际存在这些表。
- 表字段是否与 ORM 实体名一致。
- `status` 是否允许 `verified`、`unknown`、`obstacle` 三个值。
- 入口表关联的 `station_id` 是否有空值或无对应站点的脏数据。

### 4.3 ORM 关联查询

最容易出现 `500` 的代码通常是“查询站点并包含 entrances 关联”。请检查：

- 关联名称是否确实为 `entrances`。
- 外键名是否确实为 `stationId` / `station_id`。
- 查询返回为空时，不要访问 `station.entrances.map(...)` 前假定 `entrances` 存在；统一按空数组处理。
- `accessibleRestroom`、`stairsOnly`、`wheelchairAccessible` 等空值应序列化为 `false` 或明确的业务值，不要让序列化抛错。
- 经度纬度为 `NULL` 时应允许返回 `null`，不要用 `Number(null)` 后触发数据库或 DTO 校验异常。

### 4.4 分页 DTO 与响应包装

管理端现有代码按 `data.list` 读取分页结果。请确认后端没有把分页对象重复嵌套成：

```json
{ "code": 0, "data": { "data": { "list": [] } } }
```

正确形式是：

```json
{ "code": 0, "data": { "list": [] } }
```

接口无记录时的正确返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": { "list": [], "total": 0, "page": 1, "pageSize": 200 }
}
```

## 5. 推荐实现伪代码

以下为逻辑要求，不限定框架：

```ts
async function listAccessibilityStations(request) {
  const page = clampPositiveInt(request.query.page, 1);
  const pageSize = clampPositiveInt(request.query.pageSize, 200, 200);

  const [stations, total] = await stationRepository.findAndCount({
    include: ['entrances'],
    order: [['stationName', 'ASC']],
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });

  return ok({
    list: stations.map(station => ({
      stationId: station.id,
      stationName: station.stationName,
      lng: station.lng ?? null,
      lat: station.lat ?? null,
      accessibleRestroom: Boolean(station.accessibleRestroom),
      source: 'backend',
      entrances: (station.entrances || []).map(entrance => ({
        id: entrance.id,
        name: entrance.name,
        elevator: Boolean(entrance.elevator),
        ramp: Boolean(entrance.ramp),
        stairsOnly: Boolean(entrance.stairsOnly),
        wheelchairAccessible: Boolean(entrance.wheelchairAccessible),
        status: entrance.status || 'unknown',
      })),
    })),
    total,
    page,
    pageSize,
  });
}
```

## 6. 验收步骤

### 6.1 接口验收

1. 以未登录或普通市民 Token 请求：

   ```bash
   curl -i "<后端地址>/api/accessibility/stations?page=1&pageSize=200"
   ```

2. 响应必须为 `HTTP 200`，且 JSON `code` 必须为 `0`。
3. 至少返回一个具有入口数据的测试站点。
4. 返回中至少覆盖：
   - 一个 `verified` 入口；
   - 一个 `unknown` 入口；
   - 一个 `obstacle` 或 `stairsOnly: true` 入口；
   - 一个 `accessibleRestroom: true` 的站点。
5. 清空数据库后仍必须返回 `200 + 空 list`，不能返回 `500`。

### 6.2 市民端验收

1. 重启市民端开发服务器并刷新页面。
2. 在浏览器 Network 面板确认：

   ```text
   /api/accessibility/stations → 200
   ```

3. 输入含“轮椅”“老人”或“无障碍出行”的 AI 出行请求并确认生成方案。
4. “无障碍风险检查”卡片应显示：
   - “后端设施数据”；
   - 电梯覆盖站点；
   - 楼梯风险入口；
   - 无障碍卫生间；
   - 设施待确认站点；
   - 真实步行距离和换乘次数。
5. 若某个路线经过的站点未由后端维护，该站点应计入“设施待确认站点”，不得显示为可用。

## 7. 前端当前兼容能力

前端已完成以下处理，后端修复到 `200` 后不需要额外改市民端：

- 应用启动时拉取设施接口。
- AI 无障碍方案生成时再次拉取，避免首次失败后一直使用失败状态。
- 支持 `data` 数组、`data.list`、`data.items`。
- 支持驼峰和下划线字段命名。
- 站点缺少坐标时仍使用其电梯、楼梯、卫生间数据进行路线评估；仅跳过地图 Marker。
- 前端不会永久缓存失败请求。
- 接口失败或站点未覆盖时严格显示“状态未知/待确认”。

## 8. 交付结论

本次阻塞点是后端 `GET /api/accessibility/stations` 返回 `500`。请先修复该接口到 `HTTP 200 + code: 0`，再由市民端验证真实设施结果。不要通过前端固定数据、Mock 或将 `unknown` 强制改为 `verified` 绕过问题。
