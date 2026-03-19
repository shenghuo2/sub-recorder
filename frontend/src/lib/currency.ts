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

// 内置 fallback 汇率 (基于 CNY，表示 1 外币 = X CNY)
const FALLBACK_RATES: Record<string, number> = {
  CNY: 1,
  USD: 7.3,      // 1 USD ≈ 7.3 CNY
  EUR: 7.9,      // 1 EUR ≈ 7.9 CNY
  GBP: 9.2,      // 1 GBP ≈ 9.2 CNY
  JPY: 0.048,    // 1 JPY ≈ 0.048 CNY
  KRW: 0.0053,   // 1 KRW ≈ 0.0053 CNY
  INR: 0.087,    // 1 INR ≈ 0.087 CNY
  RUB: 0.079,    // 1 RUB ≈ 0.079 CNY
  HKD: 0.93,     // 1 HKD ≈ 0.93 CNY
  TWD: 0.23,     // 1 TWD ≈ 0.23 CNY
  CAD: 5.3,      // 1 CAD ≈ 5.3 CNY
  AUD: 4.8,      // 1 AUD ≈ 4.8 CNY
  SGD: 5.4,      // 1 SGD ≈ 5.4 CNY
  THB: 0.21,     // 1 THB ≈ 0.21 CNY
  VND: 0.00029,  // 1 VND ≈ 0.00029 CNY
  MYR: 1.64,     // 1 MYR ≈ 1.64 CNY
  PHP: 0.13,     // 1 PHP ≈ 0.13 CNY
  TRY: 0.20,     // 1 TRY ≈ 0.20 CNY
  BRL: 1.27,     // 1 BRL ≈ 1.27 CNY
  CHF: 8.3,      // 1 CHF ≈ 8.3 CNY
  SEK: 0.70,     // 1 SEK ≈ 0.70 CNY
  NOK: 0.68,     // 1 NOK ≈ 0.68 CNY
  DKK: 1.06,     // 1 DKK ≈ 1.06 CNY
  PLN: 1.82,     // 1 PLN ≈ 1.82 CNY
  NZD: 4.3,      // 1 NZD ≈ 4.3 CNY
  NGN: 0.016,    // 1 NGN ≈ 0.016 CNY
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
