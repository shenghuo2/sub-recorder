import currency from "currency.js";

// 货币配置：符号、精度、位置
interface CurrencyConfig {
  symbol: string;
  precision: number;
  pattern: string; // ! = symbol, # = amount
  name: string;
}

const CURRENCY_CONFIG: Record<string, CurrencyConfig> = {
  CNY: { symbol: "¥", precision: 2, pattern: "!#", name: "人民币" },
  USD: { symbol: "$", precision: 2, pattern: "!#", name: "美元" },
  EUR: { symbol: "€", precision: 2, pattern: "!#", name: "欧元" },
  GBP: { symbol: "£", precision: 2, pattern: "!#", name: "英镑" },
  JPY: { symbol: "JP¥", precision: 0, pattern: "!#", name: "日元" },
  KRW: { symbol: "₩", precision: 0, pattern: "!#", name: "韩元" },
  INR: { symbol: "₹", precision: 2, pattern: "!#", name: "印度卢比" },
  RUB: { symbol: "₽", precision: 2, pattern: "#!", name: "俄罗斯卢布" },
  HKD: { symbol: "HK$", precision: 2, pattern: "!#", name: "港币" },
  TWD: { symbol: "NT$", precision: 0, pattern: "!#", name: "新台币" },
  CAD: { symbol: "C$", precision: 2, pattern: "!#", name: "加元" },
  AUD: { symbol: "A$", precision: 2, pattern: "!#", name: "澳元" },
  SGD: { symbol: "S$", precision: 2, pattern: "!#", name: "新加坡元" },
  THB: { symbol: "฿", precision: 2, pattern: "!#", name: "泰铢" },
  VND: { symbol: "₫", precision: 0, pattern: "#!", name: "越南盾" },
  MYR: { symbol: "RM", precision: 2, pattern: "!#", name: "马来西亚林吉特" },
  PHP: { symbol: "₱", precision: 2, pattern: "!#", name: "菲律宾比索" },
  TRY: { symbol: "₺", precision: 2, pattern: "!#", name: "土耳其里拉" },
  BRL: { symbol: "R$", precision: 2, pattern: "!#", name: "巴西雷亚尔" },
  CHF: { symbol: "CHF", precision: 2, pattern: "! #", name: "瑞士法郎" },
  SEK: { symbol: "kr", precision: 2, pattern: "# !", name: "瑞典克朗" },
  NOK: { symbol: "kr", precision: 2, pattern: "# !", name: "挪威克朗" },
  DKK: { symbol: "kr", precision: 2, pattern: "# !", name: "丹麦克朗" },
  PLN: { symbol: "zł", precision: 2, pattern: "# !", name: "波兰兹罗提" },
  NZD: { symbol: "NZ$", precision: 2, pattern: "!#", name: "新西兰元" },
  NGN: { symbol: "₦", precision: 2, pattern: "!#", name: "尼日利亚奈拉" },
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_CONFIG);

export function getCurrencyConfig(code: string): CurrencyConfig {
  return CURRENCY_CONFIG[code] || { symbol: code, precision: 2, pattern: "!#", name: code };
}

export function getSymbol(code: string): string {
  return getCurrencyConfig(code).symbol;
}

export function formatCurrency(amount: number, code: string): string {
  const cfg = getCurrencyConfig(code);
  const c = currency(amount, {
    symbol: cfg.symbol,
    precision: cfg.precision,
    pattern: cfg.pattern,
  });
  return c.format();
}

export function formatCurrencyCompact(amount: number, code: string): string {
  const cfg = getCurrencyConfig(code);
  // 整数不显示小数位
  const isInteger = amount % 1 === 0;
  const c = currency(amount, {
    symbol: cfg.symbol,
    precision: isInteger ? 0 : cfg.precision,
    pattern: cfg.pattern,
  });
  return c.format();
}

export function formatCurrencyWithDecimals(amount: number, code: string, decimals: number): string {
  const cfg = getCurrencyConfig(code);
  const c = currency(amount, {
    symbol: cfg.symbol,
    precision: decimals,
    pattern: cfg.pattern,
  });
  return c.format();
}

// ========== 汇率 ==========

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  updatedAt: string;
}

const RATE_CACHE_KEY = "sub_recorder_exchange_rates";
const RATE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// 内置 fallback 汇率 (基于 CNY，表示 1 CNY = X 外币)
const FALLBACK_RATES: Record<string, number> = {
  CNY: 1,
  USD: 0.137,     // 1 CNY ≈ 0.137 USD
  EUR: 0.127,     // 1 CNY ≈ 0.127 EUR
  GBP: 0.109,     // 1 CNY ≈ 0.109 GBP
  JPY: 20.83,     // 1 CNY ≈ 20.83 JPY
  KRW: 188.68,    // 1 CNY ≈ 188.68 KRW
  INR: 11.49,     // 1 CNY ≈ 11.49 INR
  RUB: 12.66,     // 1 CNY ≈ 12.66 RUB
  HKD: 1.075,     // 1 CNY ≈ 1.075 HKD
  TWD: 4.35,      // 1 CNY ≈ 4.35 TWD
  CAD: 0.189,     // 1 CNY ≈ 0.189 CAD
  AUD: 0.208,     // 1 CNY ≈ 0.208 AUD
  SGD: 0.185,     // 1 CNY ≈ 0.185 SGD
  THB: 4.76,      // 1 CNY ≈ 4.76 THB
  VND: 3448.28,   // 1 CNY ≈ 3448.28 VND
  MYR: 0.610,     // 1 CNY ≈ 0.610 MYR
  PHP: 7.69,      // 1 CNY ≈ 7.69 PHP
  TRY: 5.0,       // 1 CNY ≈ 5.0 TRY
  BRL: 0.787,     // 1 CNY ≈ 0.787 BRL
  CHF: 0.120,     // 1 CNY ≈ 0.120 CHF
  SEK: 1.429,     // 1 CNY ≈ 1.429 SEK
  NOK: 1.471,     // 1 CNY ≈ 1.471 NOK
  DKK: 0.943,     // 1 CNY ≈ 0.943 DKK
  PLN: 0.549,     // 1 CNY ≈ 0.549 PLN
  NZD: 0.233,     // 1 CNY ≈ 0.233 NZD
  NGN: 62.5,      // 1 CNY ≈ 62.5 NGN
};

function getCachedRates(): ExchangeRates | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RATE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as ExchangeRates & { cachedAt: number };
    if (Date.now() - cached.cachedAt > RATE_CACHE_TTL) return null;
    return cached;
  } catch {
    return null;
  }
}

function setCachedRates(rates: ExchangeRates) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ ...rates, cachedAt: Date.now() }));
  } catch {
    // ignore
  }
}

export async function fetchExchangeRates(base = "CNY"): Promise<ExchangeRates> {
  const cached = getCachedRates();
  if (cached && cached.base === base) return cached;

  try {
    // 使用免费的 exchangerate-api (无需 API Key)
    const resp = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!resp.ok) throw new Error("API error");
    const data = await resp.json();
    const rates: ExchangeRates = {
      base,
      rates: data.rates || {},
      updatedAt: new Date().toISOString(),
    };
    setCachedRates(rates);
    return rates;
  } catch {
    // fallback 到内置汇率
    return {
      base: "CNY",
      rates: FALLBACK_RATES,
      updatedAt: "fallback",
    };
  }
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
  base = "CNY"
): number {
  if (from === to) return amount;
  // rates 是以 base 为基准的
  const fromRate = from === base ? 1 : rates[from];
  const toRate = to === base ? 1 : rates[to];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

export function getCurrentExchangeRates(): ExchangeRates | null {
  return getCachedRates();
}

export function clearExchangeRatesCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RATE_CACHE_KEY);
}
