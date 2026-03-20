"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, RotateCcw, Server, RefreshCw, LogOut } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_CURRENCIES, getSymbol, getCurrencyConfig, fetchExchangeRates, getCurrentExchangeRates, clearExchangeRatesCache } from "@/lib/currency";
import { clearAuthToken, getAuthToken, getStoredUsername, updateUser } from "@/lib/api";

const API_URL_KEY = "sub_recorder_api_url";

// Currency conversion settings keys
const CURRENCY_CONVERT_ENABLED_KEY = "sub_recorder_currency_convert_enabled";
const CURRENCY_TARGET_KEY = "sub_recorder_currency_target";
const CURRENCY_DECIMALS_KEY = "sub_recorder_currency_decimals";
const CYCLE_FORMAT_KEY = "sub_recorder_cycle_format"; // "zh" or "en"
const NORMALIZE_CYCLE_KEY = "sub_recorder_normalize_cycle"; // billing cycle for normalization, e.g. "month_1"

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem(API_URL_KEY);
  // null 表示未设置，返回空字符串（代理模式）
  // 空字符串表示用户明确选择代理模式
  return stored ?? "";
}

export function getCurrencyConvertEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CURRENCY_CONVERT_ENABLED_KEY) === "true";
}

export function getTargetCurrency(): string {
  if (typeof window === "undefined") return "CNY";
  return localStorage.getItem(CURRENCY_TARGET_KEY) || "CNY";
}

export function getCurrencyDecimals(): number {
  if (typeof window === "undefined") return 2;
  const val = localStorage.getItem(CURRENCY_DECIMALS_KEY);
  return val ? parseInt(val, 10) : 2;
}

export function getCycleFormat(): "zh" | "en" {
  if (typeof window === "undefined") return "zh";
  const val = localStorage.getItem(CYCLE_FORMAT_KEY);
  return val === "en" ? "en" : "zh";
}

/** 获取统计均分周期，默认 "auto"（自动取最小周期），否则返回固定 billing_cycle */
export function getNormalizeCycle(): string {
  if (typeof window === "undefined") return "auto";
  return localStorage.getItem(NORMALIZE_CYCLE_KEY) || "auto";
}

export function SettingsPage() {
  const [apiUrl, setApiUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  // Currency conversion settings
  const [convertEnabled, setConvertEnabled] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState("CNY");
  const [decimals, setDecimals] = useState(2);
  const [cycleFormat, setCycleFormat] = useState<"zh" | "en">("zh");
  const [normalizeCycle, setNormalizeCycle] = useState("auto");

  // 汇率管理
  const [exchangeRateInfo, setExchangeRateInfo] = useState<string>("");
  const [refreshingRates, setRefreshingRates] = useState(false);

  // 用户账户
  const [username, setUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingUser, setSavingUser] = useState(false);


  const loadExchangeRateInfo = () => {
    const rates = getCurrentExchangeRates();
    if (rates) {
      const date = rates.updatedAt === "fallback" 
        ? "内置汇率" 
        : new Date(rates.updatedAt).toLocaleString("zh-CN");
      const sampleRates = ["USD", "EUR", "JPY", "GBP"].map(cur => {
        const rate = rates.rates[cur];
        return rate ? `${cur}: ${rate.toFixed(4)}` : null;
      }).filter(Boolean).join(", ");
      setExchangeRateInfo(`${date} | ${sampleRates}`);
    } else {
      setExchangeRateInfo("未加载");
    }
  };


  useEffect(() => {
    const stored = localStorage.getItem(API_URL_KEY);
    // 显示实际存储的值，空字符串显示占位符提示
    setApiUrl(stored ?? "");
    setConvertEnabled(getCurrencyConvertEnabled());
    setTargetCurrency(getTargetCurrency());
    setDecimals(getCurrencyDecimals());
    setCycleFormat(getCycleFormat());
    setNormalizeCycle(getNormalizeCycle());
    loadExchangeRateInfo();
    // 加载用户名
    const storedUsername = getStoredUsername();
    if (storedUsername) {
      setUsername(storedUsername);
      setNewUsername(storedUsername);
    }
  }, []);

  const handleSave = () => {
    const trimmed = apiUrl.trim().replace(/\/+$/, "");
    localStorage.setItem(API_URL_KEY, trimmed);
    setApiUrl(trimmed);
    if (trimmed === "") {
      toast.success("已切换到代理模式，刷新页面后生效");
    } else {
      toast.success("API 地址已保存，刷新页面后生效");
    }
  };

  const handleReset = () => {
    localStorage.removeItem(API_URL_KEY);
    setApiUrl("");
    toast.info("已切换到代理模式（默认）");
  };

  const handleRefreshRates = async () => {
    setRefreshingRates(true);
    try {
      clearExchangeRatesCache();
      const rates = await fetchExchangeRates(targetCurrency);
      loadExchangeRateInfo();
      toast.success(`汇率已更新 (基于 ${rates.base})`);
    } catch (e: unknown) {
      toast.error("更新失败: " + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setRefreshingRates(false);
    }
  };


  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const trimmed = apiUrl.trim().replace(/\/+$/, "");
      // 如果是空或默认代理模式，测试 /api/auth/check
      // 否则测试用户配置的地址
      const testUrl = trimmed ? `${trimmed}/api/auth/check` : "/api/auth/check";
      const res = await fetch(testUrl, { 
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setTestResult("ok");
        toast.success("连接成功");
      } else {
        setTestResult("fail");
        toast.error(`连接失败: HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      setTestResult("fail");
      const msg = e instanceof Error ? e.message : "网络错误";
      // 提示 CORS 问题
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        toast.error("连接失败: 可能是 CORS 限制，建议使用代理模式（留空地址）");
      } else {
        toast.error("连接失败: " + msg);
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8 px-6">
      <h1 className="text-2xl font-bold font-['MiSans'] mb-6">设置</h1>

      <div className="space-y-6">
        {/* API URL */}
        <div className="space-y-3 p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Server className="h-4 w-4 text-muted-foreground" />
            后端 API 地址
          </div>
          <Label className="text-xs text-muted-foreground">
            留空使用代理模式（Docker 部署推荐），或填写后端地址直连
          </Label>
          <Input
            value={apiUrl}
            onChange={(e) => { setApiUrl(e.target.value); setTestResult(null); }}
            placeholder="留空 = 代理模式，或填写 http://localhost:3456"
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>
              <Check className="h-3.5 w-3.5 mr-1" />
              保存
            </Button>
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? "测试中..." : "测试连接"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              恢复默认
            </Button>
          </div>
          {testResult && (
            <p className={`text-xs ${testResult === "ok" ? "text-green-600" : "text-destructive"}`}>
              {testResult === "ok" ? "✓ 连接正常" : "✗ 连接失败"}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            当前生效: <code className="bg-muted px-1 py-0.5 rounded">{getApiBaseUrl() || "代理模式"}</code>
          </p>
        </div>

        {/* Currency Conversion */}
        <div className="space-y-4 p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            货币汇率换算
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">启用汇率换算显示</Label>
            <Switch
              checked={convertEnabled}
              onCheckedChange={(checked) => {
                setConvertEnabled(checked);
                localStorage.setItem(CURRENCY_CONVERT_ENABLED_KEY, String(checked));
              }}
            />
          </div>

          {/* Target Currency */}
          <div className="space-y-2">
            <Label className="text-sm">目标货币</Label>
            <Select
              value={targetCurrency}
              onValueChange={(val) => {
                setTargetCurrency(val);
                localStorage.setItem(CURRENCY_TARGET_KEY, val);
              }}
              disabled={!convertEnabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((code) => {
                  const cfg = getCurrencyConfig(code);
                  return (
                    <SelectItem key={code} value={code}>
                      {getSymbol(code)} {code} - {cfg.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Exchange Rate Info */}
          {convertEnabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">汇率信息</Label>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleRefreshRates}
                  disabled={refreshingRates}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshingRates ? "animate-spin" : ""}`} />
                  {refreshingRates ? "更新中..." : "刷新汇率"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {exchangeRateInfo || "加载中..."}
              </p>
            </div>
          )}

          {/* Decimal Places */}
          <div className="space-y-2">
            <Label className="text-sm">小数位数</Label>
            <Select
              value={String(decimals)}
              onValueChange={(val) => {
                const num = parseInt(val, 10);
                setDecimals(num);
                localStorage.setItem(CURRENCY_DECIMALS_KEY, val);
              }}
              disabled={!convertEnabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 位小数</SelectItem>
                <SelectItem value="1">1 位小数</SelectItem>
                <SelectItem value="2">2 位小数</SelectItem>
                <SelectItem value="3">3 位小数</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Normalize Cycle */}
          <div className="space-y-2">
            <Label className="text-sm">统计均分周期</Label>
            <Label className="text-xs text-muted-foreground">控制主页汇总和卡片估算的均分计算单位</Label>
            <Select
              value={normalizeCycle}
              onValueChange={(val) => {
                setNormalizeCycle(val);
                localStorage.setItem(NORMALIZE_CYCLE_KEY, val);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">自动（取最小周期）</SelectItem>
                <SelectItem value="month_1">每月</SelectItem>
                <SelectItem value="month_3">每季</SelectItem>
                <SelectItem value="month_6">每半年</SelectItem>
                <SelectItem value="year_1">每年</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cycle Format */}
          <div className="space-y-2">
            <Label className="text-sm">周期单位格式</Label>
            <Select
              value={cycleFormat}
              onValueChange={(val: "zh" | "en") => {
                setCycleFormat(val);
                localStorage.setItem(CYCLE_FORMAT_KEY, val);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文 (¥99/月, ¥599/年)</SelectItem>
                <SelectItem value="en">英文 (¥99/mo, ¥599/y)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            开启后，非目标货币的金额后会显示 ≈ {getSymbol(targetCurrency)}xxx 的换算结果
          </p>
        </div>

        {/* 账户设置 */}
        {getAuthToken() && (
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-medium text-sm">账户设置</h3>
            
            {/* 用户名 */}
            <div className="space-y-2">
              <Label className="text-sm">用户名</Label>
              <div className="flex gap-2">
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="用户名"
                />
                <Button
                  size="sm"
                  disabled={savingUser || newUsername === username || !newUsername.trim()}
                  onClick={async () => {
                    setSavingUser(true);
                    try {
                      await updateUser({ username: newUsername.trim() });
                      setUsername(newUsername.trim());
                      toast.success("用户名已更新");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "更新失败");
                    } finally {
                      setSavingUser(false);
                    }
                  }}
                >
                  保存
                </Button>
              </div>
            </div>

            {/* 修改密码 */}
            <div className="space-y-2">
              <Label className="text-sm">修改密码</Label>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="当前密码"
              />
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="新密码"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="确认新密码"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={savingUser || !oldPassword || !newPassword || newPassword !== confirmPassword}
                onClick={async () => {
                  if (newPassword !== confirmPassword) {
                    toast.error("两次输入的密码不一致");
                    return;
                  }
                  setSavingUser(true);
                  try {
                    await updateUser({ old_password: oldPassword, new_password: newPassword });
                    setOldPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    toast.success("密码已更新");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "更新失败");
                  } finally {
                    setSavingUser(false);
                  }
                }}
              >
                更新密码
              </Button>
            </div>

            {/* 登出 */}
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => {
                clearAuthToken();
                toast.success("已登出");
                window.location.reload();
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              登出
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
