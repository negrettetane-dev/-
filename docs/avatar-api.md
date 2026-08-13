# 用户头像保存接口对接文档

## 1. 背景与目标

市民端个人中心已经提供 4 个预设头像。用户选择头像后，前端需要将头像标识保存到后端，以保证以下场景下仍能恢复用户选择：

- 退出后重新登录；
- 更换浏览器或设备；
- 清理浏览器缓存；
- 重新获取用户资料。

后端只需要保存预设头像的稳定字符串 ID，不需要接收或存储图片文件。

## 2. 头像字段定义

字段名：`avatar`

字段类型：字符串

允许值：

| avatar ID | 前端含义 | 当前排序 |
| --- | --- | ---: |
| `avatar-coral` | 温柔 | 1 |
| `avatar-orange` | 安静 | 2 |
| `avatar-pink` | 活泼 | 3 |
| `avatar-mint` | 元气 | 4 |

请保存字符串 ID，不要保存数字序号。前端将来可能调整头像顺序，字符串 ID 可以避免用户头像随排序发生变化。

推荐默认值：

```text
avatar-coral
```

## 3. 更新头像接口

### 3.1 基本信息

```http
PATCH /api/user/profile
Authorization: Bearer <JWT>
Content-Type: application/json
```

该接口更新当前登录用户的资料。本次只要求支持更新 `avatar` 字段。

### 3.2 请求体

```json
{
  "avatar": "avatar-orange"
}
```

### 3.3 成功响应

推荐返回更新后的用户资料：

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "id": "123",
  "username": "user01",
  "phone": "13800138000",
  "email": "user01@example.com",
  "nickname": "智途用户",
  "avatar": "avatar-orange",
  "isVerified": true,
  "carbonCredits": 120
}
```

如果项目统一使用响应包装，也可以返回：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "avatar": "avatar-orange"
  }
}
```

请与项目现有接口的响应格式保持一致，前端最终只依赖更新后的 `avatar` 值。

### 3.4 参数校验失败

当 `avatar` 不在允许值列表中时：

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json
```

```json
{
  "code": 400,
  "message": "不支持的头像标识",
  "field": "avatar"
}
```

后端必须使用白名单校验，不应直接保存任意字符串。

### 3.5 未登录或令牌失效

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json
```

```json
{
  "code": 401,
  "message": "登录状态已失效，请重新登录"
}
```

### 3.6 用户不存在

```http
HTTP/1.1 404 Not Found
Content-Type: application/json
```

```json
{
  "code": 404,
  "message": "用户不存在"
}
```

### 3.7 服务端保存失败

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json
```

```json
{
  "code": 500,
  "message": "头像保存失败，请稍后重试"
}
```

## 4. 获取用户资料接口调整

现有用户资料接口需要返回 `avatar`：

```http
GET /api/user/profile
Authorization: Bearer <JWT>
```

响应示例：

```json
{
  "id": "123",
  "username": "user01",
  "phone": "13800138000",
  "email": "user01@example.com",
  "nickname": "智途用户",
  "avatar": "avatar-orange",
  "isVerified": true,
  "carbonCredits": 120
}
```

兼容要求：

- 新用户没有主动选择头像时，返回 `avatar-coral`；
- 历史用户数据库中 `avatar` 为空时，也建议转换为 `avatar-coral`；
- 不建议返回 `undefined`；JSON 中不存在 `undefined` 类型；
- 如果暂时无法补齐历史数据，可以返回 `null`，前端会使用默认头像。

## 5. 登录和注册接口调整

如果登录、注册接口会返回完整用户资料，也请包含 `avatar` 字段：

```json
{
  "token": "<JWT>",
  "id": "123",
  "username": "user01",
  "avatar": "avatar-coral"
}
```

这样前端登录成功后可以立即显示正确头像，无需等待额外的资料请求。

## 6. 数据库变更建议

以 MySQL 为例：

```sql
ALTER TABLE users
ADD COLUMN avatar VARCHAR(32) NOT NULL DEFAULT 'avatar-coral'
COMMENT '预设头像标识';
```

如果实际用户表名不是 `users`，请替换为项目中的真实表名。

历史数据补齐：

```sql
UPDATE users
SET avatar = 'avatar-coral'
WHERE avatar IS NULL OR avatar = '';
```

如果数据库支持 `CHECK` 约束，可以增加：

```sql
ALTER TABLE users
ADD CONSTRAINT chk_users_avatar
CHECK (avatar IN (
  'avatar-coral',
  'avatar-orange',
  'avatar-pink',
  'avatar-mint'
));
```

即使数据库增加了约束，业务层仍需执行同样的白名单校验，并返回可读的参数错误。

## 7. 后端处理流程

```text
接收 PATCH /api/user/profile
  → 校验 JWT 并获取当前用户 ID
  → 读取 avatar 字段
  → 校验 avatar 是否属于允许值
  → 更新当前用户的 avatar
  → 返回更新后的 avatar 或完整用户资料
```

安全要求：

- 用户 ID 必须从登录凭证中获取，不允许通过请求体指定其他用户；
- 只允许保存文档列出的 4 个头像 ID；
- 使用参数化 SQL 或 ORM 更新，避免字符串拼接；
- 更新失败时不得返回成功状态；
- 不需要接收 Base64、图片 URL 或图片上传文件。

## 8. 前端调用预期

用户选择头像后的前端流程：

```text
用户点击当前头像
  → 展开头像选择栏
  → 用户选择一个预设头像
  → 调用 PATCH /api/user/profile
  → 保存成功后更新前端用户状态
  → 收起头像选择栏
```

如果接口返回失败，前端会保留或恢复原头像，并提示用户重试。因此后端需要使用准确的 HTTP 状态码和明确的错误信息。

## 9. cURL 联调示例

保存头像：

```bash
curl -X PATCH "http://localhost:8080/api/user/profile" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"avatar":"avatar-orange"}'
```

查询资料：

```bash
curl "http://localhost:8080/api/user/profile" \
  -H "Authorization: Bearer <JWT>"
```

请根据后端实际端口和统一 API 前缀调整 URL。

## 10. 验收标准

后端完成后应满足：

1. 登录用户可以将头像更新为任意一个合法头像 ID；
2. 非法头像 ID 返回 `400`，数据库内容不发生变化；
3. 未登录请求返回 `401`；
4. 更新成功后，`GET /api/user/profile` 返回最新头像 ID；
5. 用户退出并重新登录后，登录响应或资料接口仍返回此前选择的头像；
6. 用户更换浏览器或设备登录后，仍能显示此前选择的头像；
7. 历史用户和新用户在未选择头像时返回默认值 `avatar-coral`；
8. 用户只能修改自己的头像，不能通过构造请求修改其他用户。

## 11. 前后端最终约定摘要

```text
字段：avatar
类型：string
默认值：avatar-coral
更新接口：PATCH /api/user/profile
查询接口：GET /api/user/profile
合法值：avatar-coral | avatar-orange | avatar-pink | avatar-mint
鉴权：Bearer JWT
```
