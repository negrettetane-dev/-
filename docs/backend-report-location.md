# 智途云枢 · 事件上报位置字段契约

> 对应前端「事件上报」位置模块：设备当前位置 与 事件发生位置 分离。
> 前端已实现并发送完整字段；后端 `/api/report/submit` 需接收并入库这些字段，否则管理端无法看到事件精确位置。

## 核心原则

1. **设备当前位置 ≠ 事件发生位置**：用户可在定位失败/位置错误/远处事件时手动选点或搜索。
2. **同时保存两者**：`eventLocation`（用户确认的事件位置）+ `deviceLocation`（设备原始定位，供审核追溯）。
3. **坐标统一 GCJ-02**（高德），前后端/地图/存储一致。

## 前端提交的完整请求体（POST /api/report/submit）

```json
{
  "category": "pothole",
  "description": "路面坑洼，约30cm深",
  "phone": "13800138000",

  "eventLocation": {
    "address": "湖南省长沙市岳麓区XX路",
    "longitude": 112.9388,
    "latitude": 28.2282,
    "locationType": "manual",
    "locationStatus": "verified",
    "accuracy": 20,
    "poiName": "XX路口",
    "districtCode": "430104",
    "city": "长沙市",
    "locatedAt": "2026-08-21T10:30:00+08:00"
  },

  "deviceLocation": {
    "longitude": 112.9412,
    "latitude": 28.2301,
    "accuracy": 65,
    "locatedAt": "2026-08-21T10:30:00+08:00"
  },

  "lng": 112.9388,
  "lat": 28.2282,
  "address": "湖南省长沙市岳麓区XX路",
  "locationType": "manual",
  "locationStatus": "verified"
}
```

## 字段说明

### eventLocation（事件发生位置，核心）

| 字段 | 类型 | 说明 |
|---|---|---|
| address | string | 详细地址 |
| longitude / latitude | number | GCJ-02 坐标 |
| locationType | `auto` / `manual` / `search` | auto=自动定位 manual=地图选点 search=搜索选点 |
| locationStatus | `verified` / `unverified` / `failed` | verified=已确认 unverified=无定位兜底 failed=定位失败 |
| accuracy | number? | 定位精度（米）；搜索/手动选点可能无 |
| poiName | string? | 搜索选点时的 POI 名称 |
| districtCode | string? | 行政区划代码（区县级） |
| city | string? | 城市名 |
| locatedAt | string | 定位/选点时间 ISO |

### deviceLocation（设备原始定位，审核追溯）

| 字段 | 类型 | 说明 |
|---|---|---|
| longitude / latitude | number | GCJ-02 坐标 |
| accuracy | number? | 精度（米） |
| locatedAt | string | 定位时间 ISO |

### 冗余顶层字段（兼容旧后端 / 便于管理端直接读）

`lng` / `lat` / `address` / `locationType` / `locationStatus`——与 `eventLocation` 对应，方便不解析嵌套对象的旧逻辑。

## 后端需确认/实现

1. **接收并入库** `eventLocation`（建议存为独立列或 JSON 列）
2. **接收并入库** `deviceLocation`
3. **管理端工单详情展示事件位置**：读 `eventLocation` 在地图上标记（GCJ-02），显示地址/定位方式/定位状态
4. 定位方式/状态字段用于审核：`unverified`/`failed` 的事件位置可标记"待核实"

## 边界情况

- **定位失败仍可提交**：前端此时只发 `locationStatus:"failed"` + 用户手动选点后的 `eventLocation`（无 deviceLocation）
- **无 eventLocation 且无 deviceLocation**（未定位也未选点）：发 `locationStatus:"failed"`，管理端标记为"位置未知"

## 前端对应文件

- 类型：`packages/citizen/src/types/reportLocation.ts`（`ReportLocation` / `DeviceLocation`）
- 页面：`packages/citizen/src/pages/report/ReportFormPage.tsx`
- 选点弹窗：`packages/citizen/src/pages/report/ReportLocationPicker.tsx`
