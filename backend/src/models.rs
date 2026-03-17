use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

// ========== 计费周期 ==========

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BillingCycle {
    Daily,
    Weekly,
    Month1,
    Month2,
    Month3,
    Month6,
    Year1,
    Year2,
    Year3,
}

impl BillingCycle {
    pub fn to_str(&self) -> &'static str {
        match self {
            Self::Daily => "daily",
            Self::Weekly => "weekly",
            Self::Month1 => "month_1",
            Self::Month2 => "month_2",
            Self::Month3 => "month_3",
            Self::Month6 => "month_6",
            Self::Year1 => "year_1",
            Self::Year2 => "year_2",
            Self::Year3 => "year_3",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "daily" => Some(Self::Daily),
            "weekly" => Some(Self::Weekly),
            "month_1" => Some(Self::Month1),
            "month_2" => Some(Self::Month2),
            "month_3" => Some(Self::Month3),
            "month_6" => Some(Self::Month6),
            "year_1" => Some(Self::Year1),
            "year_2" => Some(Self::Year2),
            "year_3" => Some(Self::Year3),
            _ => None,
        }
    }

    /// 从起始日期计算下一个账单日期
    pub fn next_date(&self, from: NaiveDate) -> NaiveDate {
        use chrono::Months;
        match self {
            Self::Daily => from + chrono::Days::new(1),
            Self::Weekly => from + chrono::Days::new(7),
            Self::Month1 => from + Months::new(1),
            Self::Month2 => from + Months::new(2),
            Self::Month3 => from + Months::new(3),
            Self::Month6 => from + Months::new(6),
            Self::Year1 => from + Months::new(12),
            Self::Year2 => from + Months::new(24),
            Self::Year3 => from + Months::new(36),
        }
    }
}

// ========== 提醒类型 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReminderType {
    SameDay,
    OneDay,
    ThreeDays,
    OneWeek,
}

impl ReminderType {
    pub fn to_str(&self) -> &'static str {
        match self {
            Self::SameDay => "same_day",
            Self::OneDay => "one_day",
            Self::ThreeDays => "three_days",
            Self::OneWeek => "one_week",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "same_day" => Some(Self::SameDay),
            "one_day" => Some(Self::OneDay),
            "three_days" => Some(Self::ThreeDays),
            "one_week" => Some(Self::OneWeek),
            _ => None,
        }
    }
}

// ========== 订阅 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: String,
    pub name: String,
    pub price: f64,
    pub currency: String,
    pub billing_cycle: String,
    pub billing_date: NaiveDate,
    pub next_bill_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub is_one_time: bool,
    pub is_suspended: bool,
    /// 暂停日期：从这个日期之后不再续费，但之前的账单保留
    pub suspended_at: Option<NaiveDate>,
    /// 暂停前最后一个有效账单周期的结束日期
    pub suspended_until: Option<NaiveDate>,
    pub color: Option<i64>,
    pub icon: Option<String>,
    pub icon_mime_type: Option<String>,
    pub should_be_tinted: bool,
    pub category_id: Option<i64>,
    pub notes: Option<String>,
    pub link: Option<String>,
    pub is_reminder_enabled: bool,
    pub reminder_type: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSubscription {
    pub name: String,
    pub price: f64,
    pub currency: String,
    pub billing_cycle: String,
    pub billing_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub is_one_time: bool,
    pub color: Option<i64>,
    pub icon: Option<String>,
    pub icon_mime_type: Option<String>,
    pub should_be_tinted: Option<bool>,
    pub category_id: Option<i64>,
    pub notes: Option<String>,
    pub link: Option<String>,
    pub is_reminder_enabled: Option<bool>,
    pub reminder_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSubscription {
    pub name: Option<String>,
    pub price: Option<f64>,
    pub currency: Option<String>,
    pub billing_cycle: Option<String>,
    pub billing_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub is_one_time: Option<bool>,
    pub color: Option<i64>,
    pub icon: Option<String>,
    pub should_be_tinted: Option<bool>,
    pub category_id: Option<i64>,
    pub notes: Option<String>,
    pub link: Option<String>,
    pub is_reminder_enabled: Option<bool>,
    pub reminder_type: Option<String>,
}

// ========== 账单记录 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillingRecord {
    pub id: i64,
    pub subscription_id: String,
    /// 本次账单周期开始日期
    pub period_start: NaiveDate,
    /// 本次账单周期结束日期
    pub period_end: NaiveDate,
    /// 实际支付金额（可覆盖订阅默认价格）
    pub amount: f64,
    /// 实际支付货币（可覆盖订阅默认货币）
    pub currency: String,
    pub notes: Option<String>,
    pub paid_at: Option<NaiveDate>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBillingRecord {
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    /// 不填则用订阅的默认价格
    pub amount: Option<f64>,
    /// 不填则用订阅的默认货币
    pub currency: Option<String>,
    pub notes: Option<String>,
    pub paid_at: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateBillingRecord {
    pub period_start: Option<NaiveDate>,
    pub period_end: Option<NaiveDate>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    pub notes: Option<String>,
    pub paid_at: Option<NaiveDate>,
}

// ========== 分类 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub color: Option<i64>,
    pub icon: Option<String>,
    pub icon_mime_type: Option<String>,
    pub fa_icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCategory {
    pub id: Option<i64>,
    pub name: String,
    pub color: Option<i64>,
    pub icon: Option<String>,
    pub icon_mime_type: Option<String>,
    pub fa_icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCategory {
    pub name: Option<String>,
    pub color: Option<i64>,
    pub icon: Option<String>,
    pub icon_mime_type: Option<String>,
    pub fa_icon: Option<String>,
}

// ========== 暂停/恢复 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuspendRequest {
    /// 暂停生效日期，不填则为今天（已付账单保留，从此日期后不再计算新账单）
    pub suspend_from: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeRequest {
    /// 恢复后的新账单开始日期，不填则为今天
    pub resume_from: Option<NaiveDate>,
}

// ========== Logo 上传 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadIcon {
    /// base64 编码的图片数据
    pub icon: String,
    /// MIME type, 如 image/png, image/jpeg, image/svg+xml, image/webp
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadIconFromUrl {
    /// 图片 URL
    pub url: String,
}

// ========== 统一响应 ==========

#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self { success: true, data: Some(data), error: None }
    }

    pub fn err(msg: impl Into<String>) -> Self {
        Self { success: false, data: None, error: Some(msg.into()) }
    }
}

// ========== 订阅列表项（包含有效价格） ==========

#[derive(Debug, Serialize)]
pub struct SubscriptionWithEffective {
    #[serde(flatten)]
    pub subscription: Subscription,
    pub effective_price: f64,
    pub effective_currency: String,
}

// ========== 订阅详情（包含账单记录和有效价格） ==========

#[derive(Debug, Serialize)]
pub struct SubscriptionDetail {
    #[serde(flatten)]
    pub subscription: Subscription,
    pub billing_records: Vec<BillingRecord>,
    /// 当前周期的实际价格（如果有账单记录则用账单记录的价格，否则用默认价格）
    pub effective_price: f64,
    pub effective_currency: String,
}
