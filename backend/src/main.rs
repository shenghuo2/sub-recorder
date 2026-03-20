mod auth;
mod db;
mod handlers;
mod models;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer, HttpRequest, HttpResponse, middleware};
use db::AppState;
use rusqlite::Connection;
use std::sync::Mutex;

fn static_dir() -> String {
    std::env::var("STATIC_DIR").unwrap_or_else(|_| "./static".to_string())
}

async fn spa_fallback(_req: HttpRequest) -> actix_web::Result<HttpResponse> {
    let index = std::path::Path::new(&static_dir()).join("index.html");
    let body = std::fs::read_to_string(&index)
        .unwrap_or_else(|_| "<h1>Sub Recorder</h1><p>Frontend not found.</p>".to_string());
    Ok(HttpResponse::Ok().content_type("text/html; charset=utf-8").body(body))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let args: Vec<String> = std::env::args().collect();
    let db_path = std::env::var("DATABASE_PATH").unwrap_or_else(|_| "subscriptions.db".to_string());

    // 命令行重置密码
    if args.iter().any(|a| a == "--reset-password") {
        let conn = Connection::open(&db_path).expect("Failed to open database");
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;").ok();
        db::init_db(&conn);
        let new_password = db::generate_random_password();
        db::update_user(&conn, None, Some(&new_password)).expect("Failed to reset password");
        println!("========================================");
        println!("密码已重置");
        println!("用户名: admin");
        println!("新密码: {}", new_password);
        println!("========================================");
        return Ok(());
    }

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);

    let conn = Connection::open(&db_path).expect("Failed to open database");
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .expect("Failed to set PRAGMA");
    db::init_db(&conn);

    let auth_enabled = !auth::is_auth_disabled();
    log::info!("数据库已初始化: {}", db_path);
    log::info!("鉴权状态: {}", if auth_enabled { "已启用" } else { "已禁用 (DISABLE_AUTH=true)" });
    log::info!("服务启动在 http://0.0.0.0:{}", port);

    let state = web::Data::new(AppState { db: Mutex::new(conn) });

    HttpServer::new(move || {
        let cors = Cors::permissive();
        let json_cfg = web::JsonConfig::default().limit(10 * 1024 * 1024); // 10MB
        App::new()
            .wrap(cors)
            .wrap(auth::AuthMiddleware::new())
            .wrap(middleware::Logger::default())
            .app_data(state.clone())
            .app_data(json_cfg)
            // 订阅
            .route("/api/subscriptions", web::get().to(handlers::list_subscriptions))
            .route("/api/subscriptions", web::post().to(handlers::create_subscription))
            .route("/api/subscriptions/{id}", web::get().to(handlers::get_subscription))
            .route("/api/subscriptions/{id}", web::put().to(handlers::update_subscription))
            .route("/api/subscriptions/{id}", web::delete().to(handlers::delete_subscription))
            // 暂停/恢复
            .route("/api/subscriptions/{id}/suspend", web::post().to(handlers::suspend_subscription))
            .route("/api/subscriptions/{id}/resume", web::post().to(handlers::resume_subscription))
            // Icon
            .route("/api/subscriptions/{id}/icon", web::put().to(handlers::upload_icon))
            .route("/api/subscriptions/{id}/icon", web::get().to(handlers::get_icon))
            .route("/api/subscriptions/{id}/icon-from-url", web::post().to(handlers::upload_icon_from_url))
            // 账单记录
            .route("/api/subscriptions/{id}/billing-records", web::get().to(handlers::list_billing_records))
            .route("/api/subscriptions/{id}/billing-records", web::post().to(handlers::create_billing_record))
            .route("/api/billing-records/{id}", web::put().to(handlers::update_billing_record))
            .route("/api/billing-records/{id}", web::delete().to(handlers::delete_billing_record))
            // 分类
            .route("/api/categories", web::get().to(handlers::list_categories))
            .route("/api/categories", web::post().to(handlers::create_category))
            .route("/api/categories/{id}", web::put().to(handlers::update_category))
            .route("/api/categories/{id}", web::delete().to(handlers::delete_category))
            // 场景
            .route("/api/scenes", web::get().to(handlers::list_scenes))
            .route("/api/scenes", web::post().to(handlers::create_scene))
            .route("/api/scenes/{id}", web::get().to(handlers::get_scene))
            .route("/api/scenes/{id}", web::put().to(handlers::update_scene))
            .route("/api/scenes/{id}", web::delete().to(handlers::delete_scene))
            // 导入
            .route("/api/import", web::post().to(handlers::import_data))
            // 鉴权
            .route("/api/auth/login", web::post().to(handlers::login))
            .route("/api/auth/check", web::get().to(handlers::check_auth))
            .route("/api/auth/user", web::get().to(handlers::get_user_info))
            .route("/api/auth/user", web::put().to(handlers::update_user))
            // 图片代理
            .route("/api/fetch-image", web::post().to(handlers::fetch_image))
            // 通知渠道
            .route("/api/notifications/channels", web::get().to(handlers::list_notification_channels))
            .route("/api/notifications/channels", web::post().to(handlers::create_notification_channel))
            .route("/api/notifications/channels/{id}", web::get().to(handlers::get_notification_channel))
            .route("/api/notifications/channels/{id}", web::put().to(handlers::update_notification_channel))
            .route("/api/notifications/channels/{id}", web::delete().to(handlers::delete_notification_channel))
            .route("/api/notifications/test", web::post().to(handlers::test_notification))
            // 静态文件 + SPA fallback
            .service(
                actix_files::Files::new("/", static_dir())
                    .index_file("index.html")
                    .default_handler(web::to(spa_fallback))
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
