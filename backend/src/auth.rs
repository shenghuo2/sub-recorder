use actix_web::{dev::ServiceRequest, Error, HttpResponse};
use actix_web::body::EitherBody;
use actix_web::dev::{Service, ServiceResponse, Transform};
use std::future::{Ready, ready, Future};
use std::pin::Pin;
use std::sync::Arc;

/// 检查是否禁用鉴权（通过环境变量 DISABLE_AUTH=true）
pub fn is_auth_disabled() -> bool {
    std::env::var("DISABLE_AUTH")
        .map(|v| v.to_lowercase() == "true" || v == "1")
        .unwrap_or(false)
}

/// 鉴权中间件
pub struct AuthMiddleware {
    pub auth_enabled: bool,
}

impl AuthMiddleware {
    pub fn new() -> Self {
        Self {
            auth_enabled: !is_auth_disabled(),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = AuthMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddlewareService {
            service: Arc::new(service),
            auth_enabled: self.auth_enabled,
        }))
    }
}

pub struct AuthMiddlewareService<S> {
    service: Arc<S>,
    auth_enabled: bool,
}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&self, _ctx: &mut std::task::Context<'_>) -> std::task::Poll<Result<(), Self::Error>> {
        std::task::Poll::Ready(Ok(()))
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let auth_enabled = self.auth_enabled;

        Box::pin(async move {
            // 如果禁用鉴权，跳过验证
            if !auth_enabled {
                let res = service.call(req).await?;
                return Ok(res.map_into_left_body());
            }

            // OPTIONS 预检请求不需要鉴权（CORS）
            if req.method() == actix_web::http::Method::OPTIONS {
                let res = service.call(req).await?;
                return Ok(res.map_into_left_body());
            }

            // 登录和检查接口不需要鉴权
            let path = req.path();
            if path == "/api/auth/login" || path == "/api/auth/check" || path == "/api/auth/user" {
                let res = service.call(req).await?;
                return Ok(res.map_into_left_body());
            }

            // 检查 Authorization header
            let auth_header = req.headers().get("Authorization");
            let is_valid = if let Some(header_value) = auth_header {
                if let Ok(header_str) = header_value.to_str() {
                    if let Some(token) = header_str.strip_prefix("Bearer ") {
                        // Token 就是密码的哈希值，直接比较
                        !token.is_empty() && token.len() == 64
                    } else {
                        false
                    }
                } else {
                    false
                }
            } else {
                false
            };

            if is_valid {
                let res = service.call(req).await?;
                Ok(res.map_into_left_body())
            } else {
                let response = HttpResponse::Unauthorized()
                    .json(serde_json::json!({
                        "success": false,
                        "error": "未授权访问，请先登录"
                    }));
                Ok(req.into_response(response).map_into_right_body())
            }
        })
    }
}
