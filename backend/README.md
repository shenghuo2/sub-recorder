# Sub Recorder Backend

订阅制服务 & 虚拟服务记账后端，Rust + SQLite 单文件部署。

## 运行

```bash
cd backend
cargo run
```

默认端口 `3456`，数据库文件 `sub_recorder.db`（自动创建）。

环境变量：
- `PORT` - 端口号（默认 3456）
- `DATABASE_PATH` - 数据库路径（默认 sub_recorder.db）
- `RUST_LOG` - 日志级别（默认 info）

## API 概览

所有响应格式：`{ "success": bool, "data": ..., "error": "..." }`

### 订阅 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/subscriptions` | 列出所有订阅（按下次账单日排序） |
| POST | `/api/subscriptions` | 创建订阅 |
| GET | `/api/subscriptions/{id}` | 获取订阅详情（含账单记录 + 有效价格） |
| PUT | `/api/subscriptions/{id}` | 更新订阅 |
| DELETE | `/api/subscriptions/{id}` | 删除订阅 |

#### 创建订阅示例

```json
{
  "name": "SuperGrok",
  "price": 700,
  "currency": "INR",
  "billing_cycle": "month_1",
  "billing_date": "2025-02-08",
  "is_one_time": false,
  "color": -12632250,
  "notes": "印度区低价"
}
```

`billing_cycle` 可选值：`daily`, `weekly`, `month_1`, `month_2`, `month_3`, `month_6`, `year_1`, `year_2`, `year_3`

### 暂停 / 恢复

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/subscriptions/{id}/suspend` | 暂停订阅 |
| POST | `/api/subscriptions/{id}/resume` | 恢复订阅 |

暂停：已付账单保留，从指定日期起不再计算新账单。

```json
{ "suspend_from": "2025-06-01" }
```

恢复：指定新的续费起始日期。

```json
{ "resume_from": "2025-09-01" }
```

### 账单记录

用于记录每个计费周期的实际付款（覆盖默认价格）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/subscriptions/{id}/billing-records` | 列出某订阅的所有账单记录 |
| POST | `/api/subscriptions/{id}/billing-records` | 添加账单记录 |
| PUT | `/api/billing-records/{id}` | 更新账单记录 |
| DELETE | `/api/billing-records/{id}` | 删除账单记录 |

```json
{
  "period_start": "2025-03-08",
  "period_end": "2025-04-08",
  "amount": 500,
  "currency": "INR",
  "notes": "活动优惠价"
}
```

- `amount` 和 `currency` 不填则自动使用订阅的默认值
- 获取订阅详情时会自动计算当前周期的 `effective_price`

### Icon

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | `/api/subscriptions/{id}/icon` | 上传 icon（base64） |
| GET | `/api/subscriptions/{id}/icon` | 获取 icon（返回 PNG 二进制） |

```json
{ "icon": "iVBORw0KGgo..." }
```

### 分类

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 列出所有分类 |
| POST | `/api/categories` | 创建分类 |
| DELETE | `/api/categories/{id}` | 删除分类 |
