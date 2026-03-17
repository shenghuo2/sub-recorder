use rusqlite::{Connection, params};
use std::sync::Mutex;
use chrono::NaiveDate;

use crate::models::*;

pub struct AppState {
    pub db: Mutex<Connection>,
}

pub fn init_db(conn: &Connection) {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color INTEGER,
            icon BLOB,
            icon_mime_type TEXT DEFAULT 'image/png',
            fa_icon TEXT
        );

        CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'CNY',
            billing_cycle TEXT NOT NULL DEFAULT 'month_1',
            billing_date TEXT NOT NULL,
            next_bill_date TEXT,
            end_date TEXT,
            is_one_time INTEGER NOT NULL DEFAULT 0,
            is_suspended INTEGER NOT NULL DEFAULT 0,
            suspended_at TEXT,
            suspended_until TEXT,
            color INTEGER,
            icon BLOB,
            icon_mime_type TEXT DEFAULT 'image/png',
            should_be_tinted INTEGER NOT NULL DEFAULT 0,
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            notes TEXT,
            link TEXT,
            is_reminder_enabled INTEGER NOT NULL DEFAULT 1,
            reminder_type TEXT DEFAULT 'one_day',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS billing_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            notes TEXT,
            paid_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_billing_records_sub_id ON billing_records(subscription_id);
        CREATE INDEX IF NOT EXISTS idx_billing_records_period ON billing_records(period_start, period_end);
    ").expect("Failed to initialize database");

    // Migration: add should_be_tinted column if not exists
    let _ = conn.execute_batch("ALTER TABLE subscriptions ADD COLUMN should_be_tinted INTEGER NOT NULL DEFAULT 0;");

    // Migration: add icon columns to categories if not exists
    let _ = conn.execute_batch("ALTER TABLE categories ADD COLUMN icon BLOB;");
    let _ = conn.execute_batch("ALTER TABLE categories ADD COLUMN icon_mime_type TEXT DEFAULT 'image/png';");
    let _ = conn.execute_batch("ALTER TABLE categories ADD COLUMN fa_icon TEXT;");

    // Seed built-in categories (id 0-30) if they don't exist
    seed_default_categories(conn);
}

// ========== 分类 ==========

pub fn create_category(conn: &Connection, input: &CreateCategory) -> rusqlite::Result<Category> {
    let icon_blob: Option<Vec<u8>> = input.icon.as_ref().map(|s| {
        use base64::Engine;
        let cleaned: String = s.chars().filter(|c| !c.is_whitespace()).collect();
        base64::engine::general_purpose::STANDARD.decode(&cleaned).unwrap_or_default()
    });
    let mime = input.icon.as_ref().map(|_| {
        input.icon_mime_type.as_deref().unwrap_or("image/png").to_string()
    });

    if let Some(explicit_id) = input.id {
        conn.execute(
            "INSERT OR REPLACE INTO categories (id, name, color, icon, icon_mime_type, fa_icon) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![explicit_id, input.name, input.color, icon_blob, mime, input.fa_icon],
        )?;
        Ok(Category { id: explicit_id, name: input.name.clone(), color: input.color, icon: input.icon.clone(), icon_mime_type: input.icon_mime_type.clone(), fa_icon: input.fa_icon.clone() })
    } else {
        conn.execute(
            "INSERT INTO categories (name, color, icon, icon_mime_type, fa_icon) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![input.name, input.color, icon_blob, mime, input.fa_icon],
        )?;
        let id = conn.last_insert_rowid();
        Ok(Category { id, name: input.name.clone(), color: input.color, icon: input.icon.clone(), icon_mime_type: input.icon_mime_type.clone(), fa_icon: input.fa_icon.clone() })
    }
}

pub fn list_categories(conn: &Connection) -> rusqlite::Result<Vec<Category>> {
    let mut stmt = conn.prepare("SELECT id, name, color, icon, icon_mime_type, fa_icon FROM categories ORDER BY id")?;
    let rows = stmt.query_map([], |row| {
        let icon_blob: Option<Vec<u8>> = row.get(3)?;
        let icon = icon_blob.map(|b| {
            use base64::Engine;
            base64::engine::general_purpose::STANDARD.encode(&b)
        });
        Ok(Category {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            icon,
            icon_mime_type: row.get(4)?,
            fa_icon: row.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn get_category(conn: &Connection, id: i64) -> rusqlite::Result<Option<Category>> {
    let mut stmt = conn.prepare("SELECT id, name, color, icon, icon_mime_type, fa_icon FROM categories WHERE id = ?1")?;
    let mut rows = stmt.query_map(params![id], |row| {
        let icon_blob: Option<Vec<u8>> = row.get(3)?;
        let icon = icon_blob.map(|b| {
            use base64::Engine;
            base64::engine::general_purpose::STANDARD.encode(&b)
        });
        Ok(Category {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            icon,
            icon_mime_type: row.get(4)?,
            fa_icon: row.get(5)?,
        })
    })?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

pub fn update_category(conn: &Connection, id: i64, input: &UpdateCategory) -> rusqlite::Result<Option<Category>> {
    let existing = match get_category(conn, id)? {
        Some(c) => c,
        None => return Ok(None),
    };

    let name = input.name.as_deref().unwrap_or(&existing.name);
    let color = if input.color.is_some() { input.color } else { existing.color };
    let fa_icon = if input.fa_icon.is_some() { input.fa_icon.clone() } else { existing.fa_icon };

    if let Some(icon_b64) = &input.icon {
        let icon_blob: Vec<u8> = {
            use base64::Engine;
            let cleaned: String = icon_b64.chars().filter(|c| !c.is_whitespace()).collect();
            base64::engine::general_purpose::STANDARD.decode(&cleaned).unwrap_or_default()
        };
        let mime = input.icon_mime_type.as_deref().unwrap_or("image/png");
        conn.execute(
            "UPDATE categories SET name=?1, color=?2, icon=?3, icon_mime_type=?4, fa_icon=?5 WHERE id=?6",
            params![name, color, icon_blob, mime, fa_icon, id],
        )?;
    } else {
        conn.execute(
            "UPDATE categories SET name=?1, color=?2, fa_icon=?3 WHERE id=?4",
            params![name, color, fa_icon, id],
        )?;
    }

    get_category(conn, id)
}

pub fn delete_category(conn: &Connection, id: i64) -> rusqlite::Result<bool> {
    let affected = conn.execute("DELETE FROM categories WHERE id = ?1", params![id])?;
    Ok(affected > 0)
}

fn seed_default_categories(conn: &Connection) {
    // Check if categories already seeded
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM categories", [], |row| row.get(0)).unwrap_or(0);
    if count > 0 {
        return;
    }

    // Built-in categories compatible with the old project (ids 1-30)
    // The old project uses numeric IDs where some map to known categories.
    // (id, name, fa_icon)
    let defaults: &[(i64, &str, &str)] = &[
        (1, "保险", "fa-shield-halved"),
        (2, "普通在线消费", "fa-cart-shopping"),
        (3, "云存储", "fa-cloud"),
        (4, "设计工具", "fa-palette"),
        (5, "教育", "fa-graduation-cap"),
        (6, "娱乐", "fa-masks-theater"),
        (7, "金融", "fa-landmark"),
        (8, "食品饮料", "fa-utensils"),
        (9, "游戏", "fa-gamepad"),
        (10, "健康", "fa-heart-pulse"),
        (11, "生活方式", "fa-house"),
        (12, "杂志和报纸", "fa-newspaper"),
        (13, "音乐", "fa-music"),
        (14, "新闻", "fa-rss"),
        (15, "摄影", "fa-camera"),
        (16, "生产力工具", "fa-rocket"),
        (17, "安全", "fa-lock"),
        (18, "购物", "fa-bag-shopping"),
        (19, "社交", "fa-users"),
        (20, "流媒体", "fa-tv"),
        (21, "运动", "fa-dumbbell"),
        (22, "电话", "fa-phone"),
        (23, "交通", "fa-car"),
        (24, "旅行", "fa-plane"),
        (25, "实用工具", "fa-wrench"),
        (26, "VPN/代理", "fa-globe"),
        (27, "天气", "fa-cloud-sun"),
        (28, "网络服务", "fa-server"),
        (29, "开发工具", "fa-code"),
        (30, "办公软件", "fa-briefcase"),
    ];

    for (id, name, fa_icon) in defaults {
        let _ = conn.execute(
            "INSERT OR IGNORE INTO categories (id, name, fa_icon) VALUES (?1, ?2, ?3)",
            params![id, name, fa_icon],
        );
    }
}

// ========== 订阅 ==========

fn row_to_subscription(row: &rusqlite::Row) -> rusqlite::Result<Subscription> {
    let icon_blob: Option<Vec<u8>> = row.get(13)?;
    let icon = icon_blob.map(|b| {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.encode(&b)
    });
    Ok(Subscription {
        id: row.get(0)?,
        name: row.get(1)?,
        price: row.get(2)?,
        currency: row.get(3)?,
        billing_cycle: row.get(4)?,
        billing_date: parse_date(&row.get::<_, String>(5)?),
        next_bill_date: row.get::<_, Option<String>>(6)?.map(|s| parse_date(&s)),
        end_date: row.get::<_, Option<String>>(7)?.map(|s| parse_date(&s)),
        is_one_time: row.get::<_, i32>(8)? != 0,
        is_suspended: row.get::<_, i32>(9)? != 0,
        suspended_at: row.get::<_, Option<String>>(10)?.map(|s| parse_date(&s)),
        suspended_until: row.get::<_, Option<String>>(11)?.map(|s| parse_date(&s)),
        color: row.get(12)?,
        icon,
        icon_mime_type: row.get(14)?,
        should_be_tinted: row.get::<_, i32>(15)? != 0,
        category_id: row.get(16)?,
        notes: row.get(17)?,
        link: row.get(18)?,
        is_reminder_enabled: row.get::<_, i32>(19)? != 0,
        reminder_type: row.get(20)?,
        created_at: row.get(21)?,
        updated_at: row.get(22)?,
    })
}

const SUB_COLUMNS: &str = "id, name, price, currency, billing_cycle, billing_date, \
    next_bill_date, end_date, is_one_time, is_suspended, suspended_at, suspended_until, \
    color, icon, icon_mime_type, should_be_tinted, category_id, notes, link, is_reminder_enabled, reminder_type, \
    created_at, updated_at";

pub fn create_subscription(conn: &Connection, input: &CreateSubscription) -> rusqlite::Result<Subscription> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let cycle = BillingCycle::from_str(&input.billing_cycle)
        .unwrap_or(BillingCycle::Month1);
    let next_bill = if input.is_one_time {
        None
    } else {
        Some(cycle.next_date(input.billing_date))
    };

    let icon_blob: Option<Vec<u8>> = input.icon.as_ref().map(|s| {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.decode(s).unwrap_or_default()
    });

    let mime_type = input.icon.as_ref().map(|_| {
        input.icon_mime_type.as_deref().unwrap_or("image/png").to_string()
    });

    conn.execute(
        "INSERT INTO subscriptions (id, name, price, currency, billing_cycle, billing_date, \
         next_bill_date, end_date, is_one_time, is_suspended, color, icon, icon_mime_type, should_be_tinted, category_id, \
         notes, link, is_reminder_enabled, reminder_type, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,0,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?19)",
        params![
            id,
            input.name,
            input.price,
            input.currency,
            input.billing_cycle,
            input.billing_date.to_string(),
            next_bill.map(|d| d.to_string()),
            input.end_date.map(|d| d.to_string()),
            input.is_one_time as i32,
            input.color,
            icon_blob,
            mime_type,
            input.should_be_tinted.unwrap_or(false) as i32,
            input.category_id,
            input.notes,
            input.link,
            input.is_reminder_enabled.unwrap_or(true) as i32,
            input.reminder_type,
            now,
        ],
    )?;

    get_subscription(conn, &id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

pub fn get_subscription(conn: &Connection, id: &str) -> rusqlite::Result<Option<Subscription>> {
    let sql = format!("SELECT {} FROM subscriptions WHERE id = ?1", SUB_COLUMNS);
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query_map(params![id], row_to_subscription)?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

pub fn list_subscriptions(conn: &Connection) -> rusqlite::Result<Vec<SubscriptionWithEffective>> {
    let sql = format!("SELECT {} FROM subscriptions ORDER BY next_bill_date ASC NULLS LAST, name ASC", SUB_COLUMNS);
    let mut stmt = conn.prepare(&sql)?;
    let subs: Vec<Subscription> = stmt.query_map([], row_to_subscription)?.collect::<Result<Vec<_>, _>>()?;

    let today = chrono::Local::now().date_naive();
    // 批量查询所有当前周期的账单记录
    let mut br_stmt = conn.prepare(
        "SELECT subscription_id, amount, currency FROM billing_records \
         WHERE period_start <= ?1 AND period_end > ?1"
    )?;
    let effective_map: std::collections::HashMap<String, (f64, String)> = br_stmt
        .query_map(params![today.to_string()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?, row.get::<_, String>(2)?))
        })?
        .filter_map(|r| r.ok())
        .map(|(id, amount, currency)| (id, (amount, currency)))
        .collect();

    let result = subs.into_iter().map(|s| {
        let (ep, ec) = effective_map.get(&s.id)
            .map(|(a, c)| (*a, c.clone()))
            .unwrap_or_else(|| (s.price, s.currency.clone()));
        SubscriptionWithEffective {
            subscription: s,
            effective_price: ep,
            effective_currency: ec,
        }
    }).collect();

    Ok(result)
}

pub fn update_subscription(conn: &Connection, id: &str, input: &UpdateSubscription) -> rusqlite::Result<Option<Subscription>> {
    let existing = match get_subscription(conn, id)? {
        Some(s) => s,
        None => return Ok(None),
    };

    let name = input.name.as_deref().unwrap_or(&existing.name);
    let price = input.price.unwrap_or(existing.price);
    let currency = input.currency.as_deref().unwrap_or(&existing.currency);
    let billing_cycle = input.billing_cycle.as_deref().unwrap_or(&existing.billing_cycle);
    let billing_date = input.billing_date.unwrap_or(existing.billing_date);
    let end_date = if input.end_date.is_some() { input.end_date } else { existing.end_date };
    let is_one_time = input.is_one_time.unwrap_or(existing.is_one_time);
    let color = if input.color.is_some() { input.color } else { existing.color };
    let category_id = if input.category_id.is_some() { input.category_id } else { existing.category_id };
    let should_be_tinted = input.should_be_tinted.unwrap_or(existing.should_be_tinted);
    let notes = if input.notes.is_some() { input.notes.clone() } else { existing.notes };
    let link = if input.link.is_some() { input.link.clone() } else { existing.link };
    let is_reminder_enabled = input.is_reminder_enabled.unwrap_or(existing.is_reminder_enabled);
    let reminder_type = if input.reminder_type.is_some() { input.reminder_type.clone() } else { existing.reminder_type };

    // 重新计算 next_bill_date
    let cycle = BillingCycle::from_str(billing_cycle).unwrap_or(BillingCycle::Month1);
    let next_bill = if is_one_time || existing.is_suspended {
        existing.next_bill_date
    } else {
        Some(recalc_next_bill_date(billing_date, &cycle))
    };

    let icon_blob: Option<Vec<u8>> = input.icon.as_ref().map(|s| {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.decode(s).unwrap_or_default()
    });

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    if let Some(blob) = &icon_blob {
        conn.execute(
            "UPDATE subscriptions SET name=?1, price=?2, currency=?3, billing_cycle=?4, \
             billing_date=?5, next_bill_date=?6, end_date=?7, is_one_time=?8, color=?9, \
             icon=?10, should_be_tinted=?11, category_id=?12, notes=?13, link=?14, is_reminder_enabled=?15, \
             reminder_type=?16, updated_at=?17 WHERE id=?18",
            params![
                name, price, currency, billing_cycle,
                billing_date.to_string(),
                next_bill.map(|d| d.to_string()),
                end_date.map(|d| d.to_string()),
                is_one_time as i32,
                color, blob, should_be_tinted as i32, category_id, notes, link,
                is_reminder_enabled as i32, reminder_type, now, id
            ],
        )?;
    } else {
        conn.execute(
            "UPDATE subscriptions SET name=?1, price=?2, currency=?3, billing_cycle=?4, \
             billing_date=?5, next_bill_date=?6, end_date=?7, is_one_time=?8, color=?9, \
             should_be_tinted=?10, category_id=?11, notes=?12, link=?13, is_reminder_enabled=?14, \
             reminder_type=?15, updated_at=?16 WHERE id=?17",
            params![
                name, price, currency, billing_cycle,
                billing_date.to_string(),
                next_bill.map(|d| d.to_string()),
                end_date.map(|d| d.to_string()),
                is_one_time as i32,
                color, should_be_tinted as i32, category_id, notes, link,
                is_reminder_enabled as i32, reminder_type, now, id
            ],
        )?;
    }

    get_subscription(conn, id)
}

pub fn delete_subscription(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    let affected = conn.execute("DELETE FROM subscriptions WHERE id = ?1", params![id])?;
    Ok(affected > 0)
}

// ========== 暂停/恢复 ==========

pub fn suspend_subscription(conn: &Connection, id: &str, req: &SuspendRequest) -> rusqlite::Result<Option<Subscription>> {
    let existing = match get_subscription(conn, id)? {
        Some(s) => s,
        None => return Ok(None),
    };
    if existing.is_suspended {
        return Ok(Some(existing));
    }

    let today = chrono::Local::now().date_naive();
    let suspend_from = req.suspend_from.unwrap_or(today);

    // suspended_until = 当前周期的结束日期（即已付费的最后日期）
    // 如果有 next_bill_date，那就是已经付到 next_bill_date 前一天
    let suspended_until = existing.next_bill_date.unwrap_or(suspend_from);

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE subscriptions SET is_suspended=1, suspended_at=?1, suspended_until=?2, \
         next_bill_date=NULL, updated_at=?3 WHERE id=?4",
        params![suspend_from.to_string(), suspended_until.to_string(), now, id],
    )?;

    get_subscription(conn, id)
}

pub fn resume_subscription(conn: &Connection, id: &str, req: &ResumeRequest) -> rusqlite::Result<Option<Subscription>> {
    let existing = match get_subscription(conn, id)? {
        Some(s) => s,
        None => return Ok(None),
    };
    if !existing.is_suspended {
        return Ok(Some(existing));
    }

    let today = chrono::Local::now().date_naive();
    let resume_from = req.resume_from.unwrap_or(today);

    let cycle = BillingCycle::from_str(&existing.billing_cycle).unwrap_or(BillingCycle::Month1);
    let next_bill = cycle.next_date(resume_from);

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE subscriptions SET is_suspended=0, suspended_at=NULL, suspended_until=NULL, \
         billing_date=?1, next_bill_date=?2, updated_at=?3 WHERE id=?4",
        params![resume_from.to_string(), next_bill.to_string(), now, id],
    )?;

    get_subscription(conn, id)
}

// ========== 账单记录 ==========

pub fn create_billing_record(conn: &Connection, sub_id: &str, input: &CreateBillingRecord) -> rusqlite::Result<Option<BillingRecord>> {
    let sub = match get_subscription(conn, sub_id)? {
        Some(s) => s,
        None => return Ok(None),
    };

    let amount = input.amount.unwrap_or(sub.price);
    let currency = input.currency.as_deref().unwrap_or(&sub.currency);

    conn.execute(
        "INSERT INTO billing_records (subscription_id, period_start, period_end, amount, currency, notes, paid_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![
            sub_id,
            input.period_start.to_string(),
            input.period_end.to_string(),
            amount,
            currency,
            input.notes,
            input.paid_at.map(|d| d.to_string()),
        ],
    )?;
    let id = conn.last_insert_rowid();
    get_billing_record(conn, id)
}

pub fn get_billing_record(conn: &Connection, id: i64) -> rusqlite::Result<Option<BillingRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, subscription_id, period_start, period_end, amount, currency, notes, paid_at, created_at \
         FROM billing_records WHERE id = ?1"
    )?;
    let mut rows = stmt.query_map(params![id], row_to_billing_record)?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

pub fn list_billing_records(conn: &Connection, sub_id: &str) -> rusqlite::Result<Vec<BillingRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, subscription_id, period_start, period_end, amount, currency, notes, paid_at, created_at \
         FROM billing_records WHERE subscription_id = ?1 ORDER BY period_start DESC"
    )?;
    let rows = stmt.query_map(params![sub_id], row_to_billing_record)?;
    rows.collect()
}

pub fn update_billing_record(conn: &Connection, id: i64, input: &UpdateBillingRecord) -> rusqlite::Result<Option<BillingRecord>> {
    let existing = match get_billing_record(conn, id)? {
        Some(r) => r,
        None => return Ok(None),
    };

    let period_start = input.period_start.unwrap_or(existing.period_start);
    let period_end = input.period_end.unwrap_or(existing.period_end);
    let amount = input.amount.unwrap_or(existing.amount);
    let currency = input.currency.as_deref().unwrap_or(&existing.currency);
    let notes = if input.notes.is_some() { input.notes.clone() } else { existing.notes };
    let paid_at = if input.paid_at.is_some() { input.paid_at } else { existing.paid_at };

    conn.execute(
        "UPDATE billing_records SET period_start=?1, period_end=?2, amount=?3, currency=?4, notes=?5, paid_at=?6 WHERE id=?7",
        params![
            period_start.to_string(),
            period_end.to_string(),
            amount,
            currency,
            notes,
            paid_at.map(|d| d.to_string()),
            id,
        ],
    )?;

    get_billing_record(conn, id)
}

pub fn delete_billing_record(conn: &Connection, id: i64) -> rusqlite::Result<bool> {
    let affected = conn.execute("DELETE FROM billing_records WHERE id = ?1", params![id])?;
    Ok(affected > 0)
}

fn row_to_billing_record(row: &rusqlite::Row) -> rusqlite::Result<BillingRecord> {
    Ok(BillingRecord {
        id: row.get(0)?,
        subscription_id: row.get(1)?,
        period_start: parse_date(&row.get::<_, String>(2)?),
        period_end: parse_date(&row.get::<_, String>(3)?),
        amount: row.get(4)?,
        currency: row.get(5)?,
        notes: row.get(6)?,
        paid_at: row.get::<_, Option<String>>(7)?.map(|s| parse_date(&s)),
        created_at: row.get(8)?,
    })
}

// ========== 订阅详情（含有效价格） ==========

pub fn get_subscription_detail(conn: &Connection, id: &str) -> rusqlite::Result<Option<SubscriptionDetail>> {
    let sub = match get_subscription(conn, id)? {
        Some(s) => s,
        None => return Ok(None),
    };

    let records = list_billing_records(conn, id)?;

    let today = chrono::Local::now().date_naive();
    let current_record = records.iter().find(|r| r.period_start <= today && r.period_end > today);

    let (effective_price, effective_currency) = match current_record {
        Some(r) => (r.amount, r.currency.clone()),
        None => (sub.price, sub.currency.clone()),
    };

    Ok(Some(SubscriptionDetail {
        subscription: sub,
        billing_records: records,
        effective_price,
        effective_currency,
    }))
}

// ========== Icon ==========

pub fn update_subscription_icon(conn: &Connection, id: &str, icon_base64: &str, mime_type: &str) -> rusqlite::Result<bool> {
    use base64::Engine;
    let blob = base64::engine::general_purpose::STANDARD.decode(icon_base64).unwrap_or_default();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let affected = conn.execute(
        "UPDATE subscriptions SET icon=?1, icon_mime_type=?2, updated_at=?3 WHERE id=?4",
        params![blob, mime_type, now, id],
    )?;
    Ok(affected > 0)
}

pub fn get_subscription_icon(conn: &Connection, id: &str) -> rusqlite::Result<Option<(Vec<u8>, String)>> {
    let mut stmt = conn.prepare("SELECT icon, icon_mime_type FROM subscriptions WHERE id = ?1")?;
    let mut rows = stmt.query_map(params![id], |row| {
        let blob: Option<Vec<u8>> = row.get(0)?;
        let mime: Option<String> = row.get(1)?;
        Ok((blob, mime))
    })?;
    match rows.next() {
        Some(Ok((Some(blob), mime))) => Ok(Some((blob, mime.unwrap_or_else(|| "image/png".to_string())))),
        _ => Ok(None),
    }
}

// ========== 辅助函数 ==========

fn parse_date(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap_or_default()
}

fn recalc_next_bill_date(billing_date: NaiveDate, cycle: &BillingCycle) -> NaiveDate {
    let today = chrono::Local::now().date_naive();
    let mut next = billing_date;
    while next <= today {
        next = cycle.next_date(next);
    }
    next
}
