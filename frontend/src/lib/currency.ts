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

// 内置 fallback 汇率 (基于 CNY，大致汇率)
const FALLBACK_RATES: Record<string, number> = {
  CNY: 1,
  USD: 0.137,
  EUR: 0.126,
  GBP: 0.108,
  JPY: 20.6,
  KRW: 189,
  INR: 11.5,
  RUB: 12.6,
  HKD: 1.07,
  TWD: 4.42,
  CAD: 0.19,
  AUD: 0.21,
  SGD: 0.184,
  THB: 4.72,
  VND: 3450,
  MYR: 0.61,
  PHP: 7.8,
  TRY: 5.0,
  BRL: 0.79,
  CHF: 0.121,
  SEK: 1.42,
  NOK: 1.46,
  DKK: 0.94,
  PLN: 0.55,
  NZD: 0.23,
  NGN: 63.5,
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
