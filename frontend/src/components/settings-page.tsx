"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, RotateCcw, Server, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_CURRENCIES, getSymbol, getCurrencyConfig } from "@/lib/currency";

const API_URL_KEY = "sub_recorder_api_url";
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

// Currency conversion settings keys
const CURRENCY_CONVERT_ENABLED_KEY = "sub_recorder_currency_convert_enabled";
const CURRENCY_TARGET_KEY = "sub_recorder_currency_target";
const CURRENCY_DECIMALS_KEY = "sub_recorder_currency_decimals";
const CYCLE_FORMAT_KEY = "sub_recorder_cycle_format"; // "zh" or "en"
const NORMALIZE_CYCLE_KEY = "sub_recorder_normalize_cycle"; // billing cycle for normalization, e.g. "month_1"

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_API_URL;
  return localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL;
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
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  // Currency conversion settings
  const [convertEnabled, setConvertEnabled] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState("CNY");
  const [decimals, setDecimals] = useState(2);
  const [cycleFormat, setCycleFormat] = useState<"zh" | "en">("zh");
  const [normalizeCycle, setNormalizeCycle] = useState("auto");

  useEffect(() => {
    setApiUrl(getApiBaseUrl());
    setConvertEnabled(getCurrencyConvertEnabled());
    setTargetCurrency(getTargetCurrency());
    setDecimals(getCurrencyDecimals());
    setCycleFormat(getCycleFormat());
    setNormalizeCycle(getNormalizeCycle());
  }, []);

  const handleSave = () => {
    const trimmed = apiUrl.trim().replace(/\/+$/, "");
    localStorage.setItem(API_URL_KEY, trimmed);
    setApiUrl(trimmed);
    toast.success("API 地址已保存，刷新页面后生效");
  };

  const handleReset = () => {
    localStorage.removeItem(API_URL_KEY);
    setApiUrl(DEFAULT_API_URL);
    toast.info("已恢复默认地址");
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const trimmed = apiUrl.trim().replace(/\/+$/, "");
      const res = await fetch(`${trimmed}/api/categories`, { method: "GET" });
      if (res.ok) {
        setTestResult("ok");
        toast.success("连接成功");
      } else {
        setTestResult("fail");
        toast.error(`连接失败: HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      setTestResult("fail");
      toast.error("连接失败: " + (e instanceof Error ? e.message : "网络错误"));
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
            设置后端服务的地址，修改后需刷新页面
          </Label>
          <Input
            value={apiUrl}
            onChange={(e) => { setApiUrl(e.target.value); setTestResult(null); }}
            placeholder="http://localhost:3456"
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

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1 px-1">
          <p>当前生效地址: <code className="bg-muted px-1 py-0.5 rounded">{getApiBaseUrl()}</code></p>
          <p>默认地址: <code className="bg-muted px-1 py-0.5 rounded">{DEFAULT_API_URL}</code></p>
        </div>
      </div>
    </div>
  );
}
