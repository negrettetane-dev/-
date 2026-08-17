# 市民端账号资料接口与数据库调整说明

## 1. 目标与适用范围

本文定义市民端“个人信息”和“账号管理”页面需要的后端能力，用于保证用户修改后重新进入个人信息页、刷新浏览器、重新登录或更换设备时，仍能读取到同一份资料。

本次范围仅包括：

- 修改预设头像；
- 修改昵称；
- 修改登录密码；
- 绑定或修改邮箱。

不包含手机号修改、实名认证、账号冻结、账号注销、头像图片上传，也不允许客户端在请求体中指定用户 ID。

## 2. 与当前前端的统一约定

### 2.1 鉴权与响应包装

除注册、登录外，所有接口均使用 Bearer JWT 鉴权：

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

前端 `apiClient` 只将 `code === 0` 视为成功，因此所有接口必须使用下列统一结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

业务失败时，HTTP 状态码与 `code` 均应反映失败原因；前端会直接展示 `message`。以下文档中的响应均省略了 HTTP 头。

### 2.2 用户资料对象

`GET /api/user/profile`、资料更新接口以及登录成功接口，应返回以下完整资料对象。字段名必须与前端 `User` 类型一致。

```json
{
  "id": "123",
  "username": "zhangsan",
  "phone": "13800138000",
  "email": "zhangsan@example.com",
  "nickname": "小张",
  "avatar": "avatar-coral",
  "realName": null,
  "role": "user",
  "isVerified": false,
  "carbonCredits": 120
}
```

要求：

- `nickname`、`avatar`、`email` 必须反映数据库最新值，不能返回登录时缓存的旧值；
- `avatar` 缺失或为空时，服务端返回默认值 `avatar-coral`；
- 没有绑定邮箱时返回 `null` 或空字符串，推荐返回 `null`；
- 不返回 `password`、密码哈希、验证码、会话密钥等敏感字段；
- `phone` 是否脱敏由现有项目统一决定；当前前端会自行脱敏，因此返回原始手机号可保持兼容。

## 3. 查询当前用户资料

```http
GET /api/user/profile
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "123",
    "username": "zhangsan",
    "phone": "13800138000",
    "email": "zhangsan@example.com",
    "nickname": "小张",
    "avatar": "avatar-orange",
    "realName": null,
    "role": "user",
    "isVerified": false,
    "carbonCredits": 120
  }
}
```

这是个人信息页进入时调用的接口。后端必须从 JWT 中取得当前用户 ID 并查询数据库，不能以本地缓存或请求参数决定用户。

## 4. 修改昵称和头像

### 4.1 接口

```http
PATCH /api/user/profile
```

请求体至少包含 `nickname` 或 `avatar` 之一；两个字段可同时提交，接口应在同一事务中完成更新。

```json
{
  "nickname": "小张",
  "avatar": "avatar-mint"
}
```

成功响应返回更新后的完整用户资料：

```json
{
  "code": 0,
  "message": "资料已保存",
  "data": {
    "id": "123",
    "username": "zhangsan",
    "phone": "13800138000",
    "email": "zhangsan@example.com",
    "nickname": "小张",
    "avatar": "avatar-mint",
    "realName": null,
    "role": "user",
    "isVerified": false,
    "carbonCredits": 120
  }
}
```

### 4.2 字段校验

| 字段 | 必填 | 校验规则 | 说明 |
| --- | --- | --- | --- |
| `nickname` | 否 | 去除首尾空白后长度为 1～15 个字符 | 当前前端限制为最多 15 个字符；不得只含空白字符。 |
| `avatar` | 否 | 仅允许白名单值 | 不接收图片 URL、Base64 或上传文件。 |

头像白名单：`avatar-coral`、`avatar-orange`、`avatar-pink`、`avatar-mint`。

参数不合法示例：

```http
HTTP/1.1 400 Bad Request
```

```json
{
  "code": 40001,
  "message": "昵称长度应为 1 至 15 个字符",
  "data": null
}
```

## 5. 绑定或修改邮箱

邮箱是可用于找回账号的身份凭据，不能仅根据邮箱格式直接修改。采用“发送验证码 + 确认绑定”两步流程。

### 5.1 发送邮箱验证码

```http
POST /api/user/email-verification-code
```

```json
{
  "email": "zhangsan@example.com",
  "scene": "bind_email"
}
```

校验与处理要求：

- 校验邮箱格式，并将邮箱规范化为小写、去除首尾空白；
- 已被其他账号绑定时返回冲突，不发送验证码；
- 同一用户、同一场景的发送频率建议为 60 秒一次，单日次数应有限制；
- 验证码至少为 6 位随机数，服务端只存哈希；有效期建议 10 分钟；
- 验证码须绑定当前用户、目标邮箱与 `bind_email` 场景，成功或达到失败次数上限后立即失效。

成功响应：

```json
{
  "code": 0,
  "message": "验证码已发送",
  "data": {
    "expiresIn": 600,
    "retryAfter": 60
  }
}
```

### 5.2 确认绑定邮箱

```http
POST /api/user/email
```

```json
{
  "email": "zhangsan@example.com",
  "code": "123456"
}
```

服务端验证通过后，更新当前用户邮箱并返回完整资料对象：

```json
{
  "code": 0,
  "message": "邮箱已绑定",
  "data": {
    "id": "123",
    "username": "zhangsan",
    "phone": "13800138000",
    "email": "zhangsan@example.com",
    "nickname": "小张",
    "avatar": "avatar-mint",
    "realName": null,
    "role": "user",
    "isVerified": false,
    "carbonCredits": 120
  }
}
```

邮箱已被其他账号使用时：

```http
HTTP/1.1 409 Conflict
```

```json
{
  "code": 40901,
  "message": "该邮箱已被其他账号绑定",
  "data": null
}
```

验证码错误、过期或场景不匹配时返回 `400`，不可透露验证码具体内容。

## 6. 修改登录密码

```http
POST /api/user/password
```

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password",
  "confirmPassword": "new-password"
}
```

字段校验：

| 字段 | 校验规则 |
| --- | --- |
| `currentPassword` | 必填；必须与当前密码哈希校验通过。 |
| `newPassword` | 必填；当前前端限制为至少 6 位，后端不得低于此门槛。建议同时要求至少包含两类字符（字母、数字、符号）。 |
| `confirmPassword` | 必填；必须与 `newPassword` 完全一致。 |

处理顺序：

1. 从 JWT 解析当前用户；
2. 校验请求字段与新旧密码；
3. 使用密码哈希算法验证 `currentPassword`；
4. 使用 Argon2id、bcrypt 或项目既有的安全哈希算法生成新哈希；
5. 在事务中更新密码哈希与 `password_changed_at`；
6. 废止该用户除当前请求会话外的所有登录会话和刷新令牌；
7. 返回成功。若当前 JWT 无法标记为当前会话，则废止全部会话，并让用户重新登录。

成功响应：

```json
{
  "code": 0,
  "message": "密码修改成功，请重新登录",
  "data": {
    "reauthRequired": true
  }
}
```

当前密码错误时应返回统一错误，避免暴露账户细节：

```http
HTTP/1.1 400 Bad Request
```

```json
{
  "code": 40003,
  "message": "当前密码不正确",
  "data": null
}
```

密码接口不得返回用户资料、密码哈希或任何令牌。

## 7. 通用错误约定

| HTTP 状态 | `code` 示例 | 使用场景 |
| --- | ---: | --- |
| `400` | `40001` | 参数格式、昵称、头像、验证码或密码校验失败。 |
| `401` | `40101` | 未携带、无效或过期的 JWT。 |
| `404` | `40401` | JWT 对应用户不存在。 |
| `409` | `40901` | 邮箱已被其他用户绑定。 |
| `429` | `42901` | 邮箱验证码发送过于频繁。 |
| `500` | `50001` | 非预期服务端或持久化错误。 |

未登录示例：

```json
{
  "code": 40101,
  "message": "登录状态已失效，请重新登录",
  "data": null
}
```

## 8. 数据库调整建议

以下以 MySQL 的 `users` 表为例；实施前请把表名、主键名和字符集替换为实际项目定义。新增字段应先在测试环境执行迁移并备份生产数据。

```sql
ALTER TABLE users
  ADD COLUMN avatar VARCHAR(32) NOT NULL DEFAULT 'avatar-coral' COMMENT '预设头像标识',
  ADD COLUMN nickname VARCHAR(15) NOT NULL DEFAULT '' COMMENT '展示昵称',
  ADD COLUMN email VARCHAR(254) NULL COMMENT '已验证邮箱',
  ADD COLUMN password_changed_at DATETIME NULL COMMENT '最近一次密码修改时间';

CREATE UNIQUE INDEX uk_users_email ON users (email);
```

历史数据处理：

```sql
UPDATE users
SET avatar = 'avatar-coral'
WHERE avatar IS NULL OR avatar = '';

UPDATE users
SET nickname = username
WHERE nickname IS NULL OR TRIM(nickname) = '';
```

验证码建议独立存储，示例表：

```sql
CREATE TABLE user_verification_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  target VARCHAR(254) NOT NULL,
  scene VARCHAR(32) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_verification_user_scene (user_id, scene, created_at),
  INDEX idx_verification_expiry (expires_at)
);
```

实现注意：

- `users.email` 允许多个 `NULL`；已绑定的非空邮箱必须唯一；
- 数据库唯一索引是并发保护，业务层仍需在发送验证码和确认绑定阶段返回清晰错误；
- 如数据库版本支持 `CHECK`，可为 `avatar` 添加四个合法 ID 的约束；无论是否有约束，业务层均必须使用白名单；
- 密码仅保存不可逆哈希，严禁保存明文或可逆加密结果；
- 若项目已存在用户会话/刷新令牌表，应为其增加撤销标记或 `password_changed_at` 比较逻辑，确保改密后旧会话无效。

## 9. 前端对接要求

现有前端已读取 `GET /api/user/profile`，资料更新成功后必须使用接口返回的 `data` 更新本地用户状态，不能只改 `localStorage`。否则进入个人信息页时，远端旧资料会覆盖本地临时值。

前端应按下列方式对接：

| 页面操作 | 调用接口 | 成功后的前端动作 |
| --- | --- | --- |
| 选择头像 | `PATCH /api/user/profile`，提交 `avatar` | 用返回资料更新 `authStore`，再收起头像面板。 |
| 保存昵称 | `PATCH /api/user/profile`，提交 `nickname` | 用返回资料更新 `authStore`，关闭弹窗。 |
| 绑定邮箱 | 先调用验证码接口，再调用 `POST /api/user/email` | 用返回资料更新 `authStore`，关闭弹窗。 |
| 修改密码 | `POST /api/user/password` | 清理本地 Token 和用户信息，跳转登录页。 |

当前邮箱弹窗没有“邮箱验证码”输入框，当前密码页尚未调用修改密码接口；后端完成后，前端需要补齐这两处请求与失败提示，才能形成完整业务闭环。

## 10. 验收标准

1. 合法昵称和头像更新成功后，立即查询 `GET /api/user/profile` 返回新值；刷新浏览器、退出重新登录后仍为新值。
2. 非法昵称、空昵称、超过 15 个字符的昵称和非法头像 ID 均返回 `400`，数据库不变。
3. 头像只能保存本文列出的 4 个 ID，默认值为 `avatar-coral`。
4. 未验证邮箱不能写入 `users.email`；验证码过期、错误、被消费或场景不符时不得更新邮箱。
5. 两个用户不能绑定同一邮箱；并发确认时仅一个请求成功。
6. 修改密码前必须验证当前密码；成功后旧登录会话不可继续访问受保护接口。
7. 所有资料写操作都仅影响 JWT 对应的当前用户，构造请求体不能修改其他用户资料。
8. 全部成功和失败响应均符合 `{ "code", "message", "data" }` 结构，成功 `code` 必须为 `0`。
