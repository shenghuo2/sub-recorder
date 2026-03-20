use actix_web::{web, HttpResponse};
use crate::db::{self, AppState};
use crate::models::*;

// ========== 订阅 ==========

pub async fn create_subscription(
    state: web::Data<AppState>,
    body: web::Json<CreateSubscription>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::create_subscription(&conn, &body) {
        Ok(sub) => HttpResponse::Created().json(ApiResponse::ok(sub)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn list_subscriptions(state: web::Data<AppState>) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::list_subscriptions(&conn) {
        Ok(subs) => HttpResponse::Ok().json(ApiResponse::ok(subs)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn get_subscription(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::get_subscription_detail(&conn, &id) {
        Ok(Some(detail)) => HttpResponse::Ok().json(ApiResponse::ok(detail)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()>::err("订阅不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn update_subscription(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<UpdateSubscription>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::update_subscription(&conn, &id, &body) {
        Ok(Some(sub)) => HttpResponse::Ok().json(ApiResponse::ok(sub)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()>::err("订阅不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn delete_subscription(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::delete_subscription(&conn, &id) {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::ok("已删除")),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<()>::err("订阅不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

// ========== 暂停/恢复 ==========

pub async fn suspend_subscription(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<SuspendRequest>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::suspend_subscription(&conn, &id, &body) {
        Ok(Some(sub)) => HttpResponse::Ok().json(ApiResponse::ok(sub)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()>::err("订阅不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn resume_subscription(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<ResumeRequest>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::resume_subscription(&conn, &id, &body) {
        Ok(Some(sub)) => HttpResponse::Ok().json(ApiResponse::ok(sub)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()>::err("订阅不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

// ========== Icon ==========

pub async fn upload_icon(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<UploadIcon>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    let mime = body.mime_type.as_deref().unwrap_or("image/png");
    match db::update_subscription_icon(&conn, &id, &body.icon, mime) {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::ok("图标已更新")),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<()>::err("订阅不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn upload_icon_from_url(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<UploadIconFromUrl>,
) -> HttpResponse {
    let id = path.into_inner();

    // 从 URL 下载图片
    let client = reqwest::Client::new();
    let resp = match client.get(&body.url).send().await {
        Ok(r) => r,
        Err(e) => return HttpResponse::BadRequest().json(ApiResponse::<()>::err(format!("下载失败: {}", e))),
    };

    if !resp.status().is_success() {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::err(format!("下载失败: HTTP {}", resp.status())));
    }

    // 检测 MIME type
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .to_string();

    let mime = if content_type.contains("svg") {
        "image/svg+xml"
    } else if content_type.contains("webp") {
        "image/webp"
    } else if content_type.contains("jpeg") || content_type.contains("jpg") {
        "image/jpeg"
    } else if content_type.contains("png") {
        "image/png"
    } else if content_type.contains("gif") {
        "image/gif"
    } else {
        // 根据 URL 扩展名推断
        let url_lower = body.url.to_lowercase();
        if url_lower.ends_with(".svg") { "image/svg+xml" }
        else if url_lower.ends_with(".webp") { "image/webp" }
        else if url_lower.ends_with(".jpg") || url_lower.ends_with(".jpeg") { "image/jpeg" }
        else { "image/png" }
    };

    let bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => return HttpResponse::BadRequest().json(ApiResponse::<()>::err(format!("读取数据失败: {}", e))),
    };

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    let conn = state.db.lock().unwrap();
    match db::update_subscription_icon(&conn, &id, &b64, mime) {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::ok("图标已更新")),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<()>::err("订阅不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn get_icon(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::get_subscription_icon(&conn, &id) {
        Ok(Some((blob, mime))) => HttpResponse::Ok()
            .content_type(mime)
            .body(blob),
        Ok(None) => HttpResponse::NotFound().finish(),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

// ========== 账单记录 ==========

pub async fn create_billing_record(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<CreateBillingRecord>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let sub_id = path.into_inner();
    match db::create_billing_record(&conn, &sub_id, &body) {
        Ok(Some(record)) => HttpResponse::Created().json(ApiResponse::ok(record)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()>::err("订阅不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn list_billing_records(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let sub_id = path.into_inner();
    match db::list_billing_records(&conn, &sub_id) {
        Ok(records) => HttpResponse::Ok().json(ApiResponse::ok(records)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn update_billing_record(
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<UpdateBillingRecord>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::update_billing_record(&conn, id, &body) {
        Ok(Some(record)) => HttpResponse::Ok().json(ApiResponse::ok(record)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()>::err("账单记录不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn delete_billing_record(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::delete_billing_record(&conn, id) {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::ok("已删除")),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<()>::err("账单记录不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

// ========== 分类 ==========

pub async fn create_category(
    state: web::Data<AppState>,
    body: web::Json<CreateCategory>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::create_category(&conn, &body) {
        Ok(cat) => HttpResponse::Created().json(ApiResponse::ok(cat)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn list_categories(state: web::Data<AppState>) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::list_categories(&conn) {
        Ok(cats) => HttpResponse::Ok().json(ApiResponse::ok(cats)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn update_category(
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<UpdateCategory>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::update_category(&conn, id, &body) {
        Ok(Some(cat)) => HttpResponse::Ok().json(ApiResponse::ok(cat)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()>::err("分类不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn delete_category(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::delete_category(&conn, id) {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::ok("已删除")),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<()>::err("分类不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

// ========== 场景 ==========

pub async fn create_scene(
    state: web::Data<AppState>,
    body: web::Json<CreateScene>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::create_scene(&conn, &body) {
        Ok(scene) => HttpResponse::Created().json(ApiResponse::ok(scene)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn list_scenes(state: web::Data<AppState>) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::list_scenes(&conn) {
        Ok(scenes) => HttpResponse::Ok().json(ApiResponse::ok(scenes)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn get_scene(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::get_scene_detail(&conn, &id) {
        Ok(Some(detail)) => HttpResponse::Ok().json(ApiResponse::ok(detail)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()>::err("场景不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn update_scene(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<UpdateScene>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::update_scene(&conn, &id, &body) {
        Ok(Some(scene)) => HttpResponse::Ok().json(ApiResponse::ok(scene)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()>::err("场景不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn delete_scene(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let id = path.into_inner();
    match db::delete_scene(&conn, &id) {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::ok("已删除")),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<()>::err("场景不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

// ========== 导入 ==========

pub async fn import_data(
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    let mut imported = 0;
    let mut errors: Vec<String> = Vec::new();

    // Support two formats:
    // 1. Full object: { "subscriptions": [...], "categories": [...] }
    // 2. Raw array: [ { subscription }, ... ]
    let (subscriptions, categories) = if body.is_array() {
        (body.as_array().cloned().unwrap_or_default(), vec![])
    } else if body.is_object() {
        let subs = body.get("subscriptions").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let cats = body.get("categories").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        (subs, cats)
    } else {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::err("无效的导入格式"));
    };

    // Import categories from the JSON (with icons and titles)
    for cat in &categories {
        let cat_id = match cat.get("id").and_then(|v| v.as_i64()) {
            Some(id) => id,
            None => continue,
        };
        let title = cat.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let icon_b64 = cat.get("icon").and_then(|v| v.as_str()).map(|s| s.to_string());

        // Update existing or create new
        if db::get_category(&conn, cat_id).ok().flatten().is_some() {
            // Update icon and title if category already exists
            let _ = db::update_category(&conn, cat_id, &UpdateCategory {
                name: if title.is_empty() { None } else { Some(title) },
                color: None,
                icon: icon_b64,
                icon_mime_type: Some("image/png".to_string()),
                fa_icon: None,
            });
        } else {
            let name = if title.is_empty() { format!("分类 {}", cat_id) } else { title };
            let _ = db::create_category(&conn, &CreateCategory {
                id: Some(cat_id),
                name,
                color: None,
                icon: icon_b64,
                icon_mime_type: Some("image/png".to_string()),
                fa_icon: None,
            });
        }
    }

    // Build a set of known category ids from imported categories
    let known_cat_ids: std::collections::HashSet<i64> = categories.iter()
        .filter_map(|c| c.get("id").and_then(|v| v.as_i64()))
        .collect();

    for item in &subscriptions {
        // Ensure category exists for this subscription's categoryId
        if let Some(cat_id) = item.get("categoryId").and_then(|v| v.as_i64()) {
            if cat_id > 0 && !known_cat_ids.contains(&cat_id) {
                if db::get_category(&conn, cat_id).ok().flatten().is_none() {
                    let _ = db::create_category(&conn, &CreateCategory {
                        id: Some(cat_id),
                        name: format!("未知分类 {}", cat_id),
                        color: None,
                        icon: None,
                        icon_mime_type: None,
                        fa_icon: None,
                    });
                }
            }
        }

        match import_single_subscription(&conn, item) {
            Ok(_) => imported += 1,
            Err(e) => {
                let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("unknown");
                errors.push(format!("{}: {}", title, e));
            }
        }
    }

    let msg = format!("导入成功 {} 条, 分类 {} 条", imported, categories.len());
    if errors.is_empty() {
        HttpResponse::Ok().json(ApiResponse::ok(msg))
    } else {
        HttpResponse::Ok().json(ApiResponse::ok(format!("{}, 失败 {} 条: {}", msg, errors.len(), errors.join("; "))))
    }
}

fn import_single_subscription(
    conn: &rusqlite::Connection,
    item: &serde_json::Value,
) -> Result<(), String> {
    let title = item.get("title").and_then(|v| v.as_str()).ok_or("缺少 title")?;
    let price = item.get("price").and_then(|v| v.as_f64()).ok_or("缺少 price")?;
    let currency_raw = item.get("currency").and_then(|v| v.as_str()).unwrap_or("CNY");
    // 把 RMB 映射为 CNY
    let currency = if currency_raw == "RMB" { "CNY" } else { currency_raw };

    let billing_cycle = item.get("billingCycle").and_then(|v| v.as_str()).unwrap_or("month_1");
    let is_one_time = item.get("isOneTime").and_then(|v| v.as_bool()).unwrap_or(false);
    let is_suspended = item.get("isSuspended").and_then(|v| v.as_bool()).unwrap_or(false);
    let color = item.get("color").and_then(|v| v.as_i64());
    let notes = item.get("notes").and_then(|v| v.as_str());
    let link = item.get("link").and_then(|v| v.as_str());
    let should_be_tinted = item.get("shouldBeTinted").and_then(|v| v.as_bool()).unwrap_or(false);
    let category_id = item.get("categoryId").and_then(|v| v.as_i64());
    let is_reminder_enabled = item.get("isReminderEnabled").and_then(|v| v.as_bool()).unwrap_or(true);
    let reminder_type_raw = item.get("reminderType").and_then(|v| v.as_str()).unwrap_or("ONE_DAY");
    let reminder_type = reminder_type_raw.to_lowercase();

    // 解析日期（毫秒时间戳）
    let billing_ts = item.get("billingDate").and_then(|v| v.as_i64()).unwrap_or(0);
    let billing_date = ts_to_date(billing_ts);
    let next_bill_ts = item.get("nextBillDate").and_then(|v| v.as_i64());
    let next_bill_date = next_bill_ts.map(ts_to_date);
    let end_ts = item.get("endDate").and_then(|v| v.as_i64());
    let end_date = end_ts.map(ts_to_date);

    // Icon (base64 字符串)
    let icon_b64 = item.get("icon").and_then(|v| v.as_str());
    let icon_blob: Option<Vec<u8>> = icon_b64.map(|s| {
        use base64::Engine;
        // 去除换行符后 decode
        let cleaned: String = s.chars().filter(|c| !c.is_whitespace()).collect();
        base64::engine::general_purpose::STANDARD.decode(&cleaned).unwrap_or_default()
    });

    let id = item.get("uuid").and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT OR REPLACE INTO subscriptions (id, name, price, currency, billing_cycle, billing_date, \
         next_bill_date, end_date, is_one_time, is_suspended, color, icon, icon_mime_type, should_be_tinted, category_id, \
         notes, link, is_reminder_enabled, reminder_type, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?20)",
        rusqlite::params![
            id, title, price, currency, billing_cycle,
            billing_date, next_bill_date.as_deref(), end_date.as_deref(),
            is_one_time as i32, is_suspended as i32,
            color, icon_blob, "image/png", should_be_tinted as i32,
            category_id,
            notes, link, is_reminder_enabled as i32, reminder_type, now,
        ],
    ).map_err(|e| e.to_string())?;

    // 导入 payments 为 billing_records
    if let Some(payments) = item.get("payments").and_then(|v| v.as_array()) {
        for payment in payments {
            let p_price = payment.get("price").and_then(|v| v.as_f64()).unwrap_or(price);
            let p_currency_raw = payment.get("currency").and_then(|v| v.as_str()).unwrap_or(currency);
            let p_currency = if p_currency_raw == "RMB" { "CNY" } else { p_currency_raw };
            let p_ts = payment.get("date").and_then(|v| v.as_i64()).unwrap_or(billing_ts);
            let p_date = ts_to_date(p_ts);

            // 计算周期结束日期
            let cycle = crate::models::BillingCycle::from_str(billing_cycle)
                .unwrap_or(crate::models::BillingCycle::Month1);
            let p_end = cycle.next_date(
                chrono::NaiveDate::parse_from_str(&p_date, "%Y-%m-%d").unwrap_or_default()
            ).to_string();

            let _ = conn.execute(
                "INSERT INTO billing_records (subscription_id, period_start, period_end, amount, currency, paid_at) \
                 VALUES (?1,?2,?3,?4,?5,?6)",
                rusqlite::params![id, p_date, p_end, p_price, p_currency, p_date],
            );
        }
    }

    Ok(())
}

fn ts_to_date(ts_ms: i64) -> String {
    use chrono::TimeZone;
    chrono::Utc.timestamp_opt(ts_ms / 1000, 0)
        .single()
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "2025-01-01".to_string())
}

// ========== 图片代理 ==========

pub async fn fetch_image(
    body: web::Json<FetchImageRequest>,
) -> HttpResponse {
    let client = reqwest::Client::new();
    let resp = match client.get(&body.url).send().await {
        Ok(r) => r,
        Err(e) => return HttpResponse::BadRequest().json(ApiResponse::<()>::err(format!("下载失败: {}", e))),
    };

    if !resp.status().is_success() {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::err(format!("下载失败: HTTP {}", resp.status())));
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .to_string();

    let mime = if content_type.contains("svg") {
        "image/svg+xml"
    } else if content_type.contains("webp") {
        "image/webp"
    } else if content_type.contains("jpeg") || content_type.contains("jpg") {
        "image/jpeg"
    } else if content_type.contains("png") {
        "image/png"
    } else if content_type.contains("gif") {
        "image/gif"
    } else {
        let url_lower = body.url.to_lowercase();
        if url_lower.ends_with(".svg") { "image/svg+xml" }
        else if url_lower.ends_with(".webp") { "image/webp" }
        else if url_lower.ends_with(".jpg") || url_lower.ends_with(".jpeg") { "image/jpeg" }
        else { "image/png" }
    };

    let bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => return HttpResponse::BadRequest().json(ApiResponse::<()>::err(format!("读取数据失败: {}", e))),
    };

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    HttpResponse::Ok().json(ApiResponse::ok(FetchImageResponse {
        data: b64,
        mime_type: mime.to_string(),
    }))
}

// ========== 鉴权 ==========

#[derive(serde::Deserialize)]
pub struct LoginRequest {
    pub password: String,
}

#[derive(serde::Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub username: String,
    pub require_auth: bool,
}

pub async fn login(
    state: web::Data<AppState>,
    body: web::Json<LoginRequest>,
) -> HttpResponse {
    use crate::auth::is_auth_disabled;
    
    // 如果禁用鉴权，直接返回成功
    if is_auth_disabled() {
        return HttpResponse::Ok().json(ApiResponse::ok(LoginResponse {
            token: String::new(),
            username: "Guest".to_string(),
            require_auth: false,
        }));
    }
    
    let conn = state.db.lock().unwrap();
    
    // 验证密码
    if db::verify_password(&conn, &body.password) {
        // 获取用户信息
        let user = db::get_user(&conn).ok().flatten();
        let username = user.as_ref().map(|u| u.username.clone()).unwrap_or_else(|| "admin".to_string());
        let token = user.map(|u| u.password_hash).unwrap_or_default();
        
        HttpResponse::Ok().json(ApiResponse::ok(LoginResponse {
            token,
            username,
            require_auth: true,
        }))
    } else {
        HttpResponse::Unauthorized().json(ApiResponse::<()>::err("密码错误"))
    }
}

pub async fn check_auth() -> HttpResponse {
    use crate::auth::is_auth_disabled;
    
    let require_auth = !is_auth_disabled();
    HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({
        "require_auth": require_auth
    })))
}

#[derive(serde::Serialize)]
pub struct UserInfo {
    pub username: String,
}

pub async fn get_user_info(state: web::Data<AppState>) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::get_user(&conn) {
        Ok(Some(user)) => HttpResponse::Ok().json(ApiResponse::ok(UserInfo {
            username: user.username,
        })),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()>::err("用户不存在")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

#[derive(serde::Deserialize)]
pub struct UpdateUserRequest {
    pub username: Option<String>,
    pub old_password: Option<String>,
    pub new_password: Option<String>,
}

pub async fn update_user(
    state: web::Data<AppState>,
    body: web::Json<UpdateUserRequest>,
) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    
    // 如果要修改密码，需要验证旧密码
    if body.new_password.is_some() {
        let old_pwd = body.old_password.as_deref().unwrap_or("");
        if !db::verify_password(&conn, old_pwd) {
            return HttpResponse::BadRequest().json(ApiResponse::<()>::err("旧密码错误"));
        }
    }
    
    match db::update_user(&conn, body.username.as_deref(), body.new_password.as_deref()) {
        Ok(_) => {
            // 返回新的用户信息和 token
            if let Ok(Some(user)) = db::get_user(&conn) {
                HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({
                    "username": user.username,
                    "token": user.password_hash,
                })))
            } else {
                HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({"success": true})))
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

// ========== 通知渠道 ==========

pub async fn list_notification_channels(state: web::Data<AppState>) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::list_notification_channels(&conn) {
        Ok(channels) => HttpResponse::Ok().json(ApiResponse::ok(channels)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn get_notification_channel(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::get_notification_channel(&conn, &path) {
        Ok(ch) => HttpResponse::Ok().json(ApiResponse::ok(ch)),
        Err(_) => HttpResponse::NotFound().json(ApiResponse::<()>::err("渠道不存在".to_string())),
    }
}

pub async fn create_notification_channel(state: web::Data<AppState>, body: web::Json<CreateNotificationChannel>) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::create_notification_channel(&conn, &body) {
        Ok(id) => HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({"id": id}))),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn update_notification_channel(state: web::Data<AppState>, path: web::Path<String>, body: web::Json<UpdateNotificationChannel>) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::update_notification_channel(&conn, &path, &body) {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({"success": true}))),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn delete_notification_channel(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let conn = state.db.lock().unwrap();
    match db::delete_notification_channel(&conn, &path) {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({"success": true}))),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::err(e.to_string())),
    }
}

pub async fn test_notification(body: web::Json<TestNotificationRequest>) -> HttpResponse {
    match body.channel_type.as_str() {
        "smtp" => do_test_smtp(&body.config).await,
        "webhook" => do_test_webhook(&body.config).await,
        _ => HttpResponse::BadRequest().json(ApiResponse::<()>::err("不支持的通知类型".to_string())),
    }
}

async fn do_test_smtp(config: &serde_json::Value) -> HttpResponse {
    use mail_send::{SmtpClientBuilder, mail_builder::MessageBuilder};

    let cfg: SmtpChannelConfig = match serde_json::from_value(config.clone()) {
        Ok(c) => c,
        Err(e) => return HttpResponse::BadRequest().json(ApiResponse::<()>::err(format!("配置解析失败: {}", e))),
    };

    log::info!("Testing SMTP: {}:{} tls={}", cfg.host, cfg.port, cfg.use_tls);

    let message = MessageBuilder::new()
        .from((cfg.from_name.as_str(), cfg.from_email.as_str()))
        .to(cfg.to_email.as_str())
        .subject("Sub Recorder 邮件测试")
        .text_body("这是一封测试邮件，如果您收到此邮件，说明 SMTP 配置正确。");

    let creds = (cfg.username.clone(), cfg.password.clone());
    let use_implicit_tls = cfg.port == 465;

    let conn_result = if cfg.use_tls {
        SmtpClientBuilder::new(cfg.host.clone(), cfg.port as u16)
            .implicit_tls(use_implicit_tls)
            .credentials(creds)
            .connect().await
    } else {
        SmtpClientBuilder::new(cfg.host.clone(), cfg.port as u16)
            .implicit_tls(false)
            .allow_invalid_certs()
            .credentials(creds)
            .connect().await
    };

    match conn_result {
        Ok(mut client) => match client.send(message).await {
            Ok(_) => HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({"success": true, "message": "测试邮件已发送"}))),
            Err(e) => {
                log::error!("SMTP send failed: {}", e);
                HttpResponse::BadRequest().json(ApiResponse::<()>::err(format!("发送失败: {}", e)))
            }
        },
        Err(e) => {
            log::error!("SMTP connect failed: {}", e);
            let msg = if e.to_string().contains("Unparseable") {
                "连接失败: 响应格式异常，请检查端口（25/465/587）和 TLS 设置".to_string()
            } else {
                format!("连接失败: {}", e)
            };
            HttpResponse::BadRequest().json(ApiResponse::<()>::err(msg))
        }
    }
}

async fn do_test_webhook(config: &serde_json::Value) -> HttpResponse {
    let cfg: WebhookChannelConfig = match serde_json::from_value(config.clone()) {
        Ok(c) => c,
        Err(e) => return HttpResponse::BadRequest().json(ApiResponse::<()>::err(format!("配置解析失败: {}", e))),
    };

    log::info!("Testing webhook: {} type={}", cfg.url, cfg.webhook_type);

    let client = reqwest::Client::new();

    // 构建 OneBot URL 和请求
    let (url, body) = if cfg.webhook_type == "onebot" {
        let message_type = cfg.message_type.as_deref().unwrap_or("private");
        let target_id = cfg.target_id.as_deref().unwrap_or("");
        
        if target_id.is_empty() {
            return HttpResponse::BadRequest().json(ApiResponse::<()>::err("请填写目标 QQ 号或群号".to_string()));
        }

        let endpoint = match message_type {
            "group" => format!("{}/send_group_msg", cfg.url.trim_end_matches('/')),
            _ => format!("{}/send_private_msg", cfg.url.trim_end_matches('/')),
        };

        let body = match message_type {
            "group" => serde_json::json!({
                "group_id": target_id.parse::<i64>().unwrap_or(0),
                "message": "Sub Recorder 测试消息\n如果您收到此消息，说明配置正确。"
            }),
            _ => serde_json::json!({
                "user_id": target_id.parse::<i64>().unwrap_or(0),
                "message": "Sub Recorder 测试消息\n如果您收到此消息，说明配置正确。"
            }),
        };

        (endpoint, body)
    } else {
        let text = cfg.body_template
            .replace("{title}", "Sub Recorder 测试")
            .replace("{message}", "如果您收到此消息，说明配置正确。")
            .replace("{subscription}", "测试订阅");
        let body = serde_json::from_str(&text).unwrap_or(serde_json::json!({"text": text}));
        (cfg.url.clone(), body)
    };

    let mut req = match cfg.method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        _ => client.post(&url),
    };

    // 添加 OneBot Access Token
    if cfg.webhook_type == "onebot" {
        if let Some(token) = &cfg.access_token {
            if !token.is_empty() {
                req = req.header("Authorization", format!("Bearer {}", token));
            }
        }
    }

    // 添加自定义 headers
    if let Some(headers) = &cfg.headers {
        if let Some(obj) = headers.as_object() {
            for (k, v) in obj {
                if let Some(s) = v.as_str() { req = req.header(k, s); }
            }
        }
    }

    if cfg.method.to_uppercase() != "GET" {
        req = req.json(&body);
    }

    match req.send().await {
        Ok(resp) => {
            let status = resp.status();
            if status.is_success() {
                HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({"success": true, "message": "测试消息已发送"})))
            } else {
                let body_text = resp.text().await.unwrap_or_default();
                log::error!("Webhook error: {} {}", status, body_text);
                HttpResponse::BadRequest().json(ApiResponse::<()>::err(format!("Webhook 返回 {}: {}", status, body_text)))
            }
        }
        Err(e) => {
            log::error!("Webhook failed: {}", e);
            HttpResponse::BadRequest().json(ApiResponse::<()>::err(format!("发送失败: {}", e)))
        }
    }
}
