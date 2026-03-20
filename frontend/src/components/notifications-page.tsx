"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Mail, Webhook, Check, AlertCircle, Send, Loader2 } from "lucide-react";
import {
  listNotificationChannels,
  createNotificationChannel,
  updateNotificationChannel,
  deleteNotificationChannel,
  testNotification,
  type NotificationChannel,
} from "@/lib/api";

export function NotificationsPage() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);

  // 新增/编辑表单状态 - 4种独立类型
  const [formType, setFormType] = useState<"smtp" | "onebot" | "telegram" | "webhook">("smtp");
  const [formName, setFormName] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);

  // SMTP 配置
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("Sub Recorder");
  const [smtpToEmail, setSmtpToEmail] = useState("");
  const [smtpUseTls, setSmtpUseTls] = useState(true);

  // Webhook 配置
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookMethod, setWebhookMethod] = useState("POST");
  const [webhookType, setWebhookType] = useState("onebot");
  const [webhookHeaders, setWebhookHeaders] = useState("");
  const [webhookBodyTemplate, setWebhookBodyTemplate] = useState('{"message": "{message"}');

  // OneBot 专用配置
  const [onebotAccessToken, setOnebotAccessToken] = useState("");
  const [onebotMessageType, setOnebotMessageType] = useState<"private" | "group">("private");
  const [onebotTargetId, setOnebotTargetId] = useState("");

  // Telegram 专用配置
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramSilent, setTelegramSilent] = useState(false);
  const [fetchingChatId, setFetchingChatId] = useState(false);

  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const data = await listNotificationChannels();
      setChannels(data);
    } catch (e) {
      toast.error("加载通知渠道失败");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormEnabled(true);
    setFormType("smtp");
    
    setSmtpHost("");
    setSmtpPort(587);
    setSmtpUsername("");
    setSmtpPassword("");
    setSmtpFromEmail("");
    setSmtpFromName("Sub Recorder");
    setSmtpToEmail("");
    setSmtpUseTls(true);
    
    setWebhookUrl("");
    setWebhookMethod("POST");
    setWebhookType("onebot");
    setWebhookHeaders("");
    setWebhookBodyTemplate('{"message": "{message"}');
    setOnebotAccessToken("");
    setOnebotMessageType("private");
    setOnebotTargetId("");
    
    setTelegramBotToken("");
    setTelegramChatId("");
    setTelegramSilent(false);
    
    setEditingChannel(null);
    setShowAddForm(false);
  };

  const handleEdit = (channel: NotificationChannel) => {
    setEditingChannel(channel);
    setFormName(channel.name);
    setFormEnabled(channel.enabled);
    setFormType(channel.channel_type);
    const config = channel.config;

    if (channel.channel_type === "smtp") {
      setSmtpHost(config.host || "");
      setSmtpPort(config.port || 587);
      setSmtpUsername(config.username || "");
      setSmtpPassword("");
      setSmtpFromEmail(config.from_email || "");
      setSmtpFromName(config.from_name || "Sub Recorder");
      setSmtpToEmail(config.to_email || "");
      setSmtpUseTls(config.use_tls !== false);
    } else if (channel.channel_type === "onebot") {
      setWebhookUrl(config.url || "");
      setOnebotAccessToken(config.access_token || "");
      setOnebotMessageType(config.message_type || "private");
      setOnebotTargetId(config.target_id || "");
    } else if (channel.channel_type === "telegram") {
      setTelegramBotToken(config.bot_token || "");
      setTelegramChatId(config.chat_id || "");
      setTelegramSilent(config.silent || false);
    } else if (channel.channel_type === "webhook") {
      setWebhookUrl(config.url || "");
      setWebhookMethod(config.method || "POST");
      setWebhookHeaders(config.headers ? JSON.stringify(config.headers, null, 2) : "");
      setWebhookBodyTemplate(config.body_template || '{"message": "{message"}');
    }

    setShowAddForm(true);
  };

  // 自动获取 Telegram Chat ID
  const fetchTelegramChatId = async () => {
    if (!telegramBotToken.trim()) {
      toast.error("请先填写机器人令牌");
      return;
    }
    setFetchingChatId(true);
    try {
      const resp = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getUpdates?limit=10`);
      const data = await resp.json();
      if (!data.ok) {
        toast.error(data.description || "获取失败");
        return;
      }
      if (!data.result || data.result.length === 0) {
        toast.error("没有找到消息，请先给机器人发送一条消息");
        return;
      }
      // 获取最新的 chat_id
      const lastMsg = data.result[data.result.length - 1];
      const chatId = lastMsg.message?.chat?.id || lastMsg.channel_post?.chat?.id;
      if (chatId) {
        setTelegramChatId(String(chatId));
        toast.success(`已获取 Chat ID: ${chatId}`);
      } else {
        toast.error("无法解析 Chat ID");
      }
    } catch (e: any) {
      toast.error(e.message || "获取失败");
    } finally {
      setFetchingChatId(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("请输入渠道名称");
      return;
    }

    let config: any = {};

    if (formType === "smtp") {
      if (!smtpHost || !smtpFromEmail || !smtpToEmail) {
        toast.error("请填写完整的 SMTP 配置");
        return;
      }
      config = {
        host: smtpHost,
        port: smtpPort,
        username: smtpUsername,
        password: smtpPassword,
        from_email: smtpFromEmail,
        from_name: smtpFromName,
        to_email: smtpToEmail,
        use_tls: smtpUseTls,
      };
    } else if (formType === "onebot") {
      if (!webhookUrl || !onebotTargetId) {
        toast.error("请填写完整的 OneBot 配置");
        return;
      }
      config = {
        url: webhookUrl,
        access_token: onebotAccessToken || undefined,
        message_type: onebotMessageType,
        target_id: onebotTargetId,
      };
    } else if (formType === "telegram") {
      if (!telegramBotToken || !telegramChatId) {
        toast.error("请填写完整的 Telegram 配置");
        return;
      }
      config = {
        bot_token: telegramBotToken,
        chat_id: telegramChatId,
        silent: telegramSilent,
      };
    } else if (formType === "webhook") {
      if (!webhookUrl) {
        toast.error("请填写 Webhook URL");
        return;
      }
      
      let headers = null;
      if (webhookHeaders.trim()) {
        try {
          headers = JSON.parse(webhookHeaders);
        } catch (e) {
          toast.error("Headers 格式错误，请使用 JSON 格式");
          return;
        }
      }

      config = {
        url: webhookUrl,
        method: webhookMethod,
        headers,
        body_template: webhookBodyTemplate,
      };
    }

    try {
      if (editingChannel) {
        await updateNotificationChannel(editingChannel.id, {
          name: formName,
          enabled: formEnabled,
          config,
        });
        toast.success("渠道已更新");
      } else {
        await createNotificationChannel({
          name: formName,
          channel_type: formType,
          enabled: formEnabled,
          config,
        });
        toast.success("渠道已创建");
      }
      resetForm();
      loadChannels();
    } catch (e: any) {
      toast.error(e.message || "保存失败");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个通知渠道吗？")) return;

    try {
      await deleteNotificationChannel(id);
      toast.success("渠道已删除");
      loadChannels();
    } catch (e: any) {
      toast.error(e.message || "删除失败");
    }
  };

  const handleTest = async () => {
    let config: any = {};

    if (formType === "smtp") {
      if (!smtpHost || !smtpFromEmail || !smtpToEmail) {
        toast.error("请填写完整的 SMTP 配置");
        return;
      }
      config = {
        host: smtpHost,
        port: smtpPort,
        username: smtpUsername,
        password: smtpPassword,
        from_email: smtpFromEmail,
        from_name: smtpFromName,
        to_email: smtpToEmail,
        use_tls: smtpUseTls,
      };
    } else if (formType === "onebot") {
      if (!webhookUrl || !onebotTargetId) {
        toast.error("请填写完整的 OneBot 配置");
        return;
      }
      config = {
        url: webhookUrl,
        access_token: onebotAccessToken || undefined,
        message_type: onebotMessageType,
        target_id: onebotTargetId,
      };
    } else if (formType === "telegram") {
      if (!telegramBotToken || !telegramChatId) {
        toast.error("请填写完整的 Telegram 配置");
        return;
      }
      config = {
        bot_token: telegramBotToken,
        chat_id: telegramChatId,
        silent: telegramSilent,
      };
    } else if (formType === "webhook") {
      if (!webhookUrl) {
        toast.error("请填写 Webhook URL");
        return;
      }

      let headers = null;
      if (webhookHeaders.trim()) {
        try {
          headers = JSON.parse(webhookHeaders);
        } catch (e) {
          toast.error("Headers 格式错误");
          return;
        }
      }

      config = {
        url: webhookUrl,
        method: webhookMethod,
        headers,
        body_template: webhookBodyTemplate,
      };
    }

    setTesting(true);
    try {
      const result = await testNotification({
        channel_type: formType,
        config,
      });
      toast.success(result.message || "测试成功");
    } catch (e: any) {
      toast.error(e.message || "测试失败");
    } finally {
      setTesting(false);
    }
  };

  const handleToggleEnabled = async (channel: NotificationChannel) => {
    try {
      await updateNotificationChannel(channel.id, {
        enabled: !channel.enabled,
      });
      loadChannels();
    } catch (e: any) {
      toast.error(e.message || "更新失败");
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto py-8 px-6">加载中...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-['MiSans']">通知管理</h1>
        <Button onClick={() => setShowAddForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          添加渠道
        </Button>
      </div>

      {/* 渠道列表 */}
      <div className="space-y-4 mb-6">
        {channels.length === 0 && !showAddForm && (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>还没有配置通知渠道</p>
            <p className="text-sm mt-2">点击上方"添加渠道"按钮开始配置</p>
          </div>
        )}

        {channels.map((channel) => (
          <div key={channel.id} className="p-4 rounded-xl border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {channel.channel_type === "smtp" && <Mail className="h-5 w-5 text-muted-foreground" />}
                {channel.channel_type === "onebot" && <Webhook className="h-5 w-5 text-muted-foreground" />}
                {channel.channel_type === "telegram" && <Send className="h-5 w-5 text-muted-foreground" />}
                {channel.channel_type === "webhook" && <Webhook className="h-5 w-5 text-muted-foreground" />}
                <div>
                  <div className="font-medium">{channel.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {channel.channel_type === "smtp" && "邮件通知"}
                    {channel.channel_type === "onebot" && "OneBot (QQ机器人)"}
                    {channel.channel_type === "telegram" && "Telegram 机器人"}
                    {channel.channel_type === "webhook" && "自定义 Webhook"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={channel.enabled}
                  onCheckedChange={() => handleToggleEnabled(channel)}
                />
                <Button variant="ghost" size="sm" onClick={() => handleEdit(channel)}>
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(channel.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 添加/编辑表单 */}
      {showAddForm && (
        <div className="p-6 rounded-xl border bg-card space-y-4">
          <h2 className="text-lg font-medium">
            {editingChannel ? "编辑通知渠道" : "添加通知渠道"}
          </h2>

          <div className="space-y-4">
            {/* 通知类型选择 - 放在最前面且更醒目 */}
            {!editingChannel && (
              <div className="space-y-2">
                <Label className="text-base font-medium">选择通知类型</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormType("smtp")}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      formType === "smtp"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4" />
                      <span className="font-medium text-sm">邮件</span>
                    </div>
                    <p className="text-xs text-muted-foreground">SMTP 邮件通知</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("onebot")}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      formType === "onebot"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Webhook className="h-4 w-4" />
                      <span className="font-medium text-sm">OneBot</span>
                    </div>
                    <p className="text-xs text-muted-foreground">QQ 机器人</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("telegram")}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      formType === "telegram"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Send className="h-4 w-4" />
                      <span className="font-medium text-sm">Telegram</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Telegram 机器人</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("webhook")}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      formType === "webhook"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Webhook className="h-4 w-4" />
                      <span className="font-medium text-sm">Webhook</span>
                    </div>
                    <p className="text-xs text-muted-foreground">自定义 HTTP</p>
                  </button>
                </div>
              </div>
            )}

            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>渠道名称</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={formType === "smtp" ? "例如：我的邮箱" : "例如：QQ 机器人"}
                />
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label>启用此渠道</Label>
                <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
              </div>
            </div>

            {/* OneBot 配置 */}
            {formType === "onebot" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>OneBot HTTP 地址</Label>
                  <Input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="http://127.0.0.1:5700"
                  />
                  <p className="text-xs text-muted-foreground">OneBot 实现的 HTTP API 地址（不含路径）</p>
                </div>

                <div className="space-y-2">
                  <Label>Access Token（可选）</Label>
                  <Input
                    type="password"
                    value={onebotAccessToken}
                    onChange={(e) => setOnebotAccessToken(e.target.value)}
                    placeholder="留空则不使用鉴权"
                  />
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    ⚠️ 出于安全原因，任何暴露到公网的 HTTP 地址，请务必设置 Access Token
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>消息类型</Label>
                    <Select 
                      value={onebotMessageType} 
                      onValueChange={(v: "private" | "group") => setOnebotMessageType(v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">私聊消息</SelectItem>
                        <SelectItem value="group">群消息</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{onebotMessageType === "private" ? "用户 QQ 号" : "群号"}</Label>
                    <Input
                      value={onebotTargetId}
                      onChange={(e) => setOnebotTargetId(e.target.value)}
                      placeholder={onebotMessageType === "private" ? "例如：123456789" : "例如：987654321"}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Telegram 配置 */}
            {formType === "telegram" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>机器人令牌 (Bot Token)</Label>
                  <Input
                    type="password"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  />
                  <p className="text-xs text-muted-foreground">
                    从 <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@BotFather</a> 获取，格式为 <code className="bg-muted px-1 rounded">数字:字母数字混合</code>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Chat ID</Label>
                  <div className="flex gap-2">
                    <Input
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="例如：123456789 或 -1001234567890"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchTelegramChatId}
                      disabled={fetchingChatId || !telegramBotToken.trim()}
                      className="shrink-0"
                    >
                      {fetchingChatId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "自动获取"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    支持私聊、群组或频道的 Chat ID。先给机器人发送一条消息，然后点击"自动获取"
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>静默发送</Label>
                    <p className="text-xs text-muted-foreground">消息发布后用户会收到无声通知</p>
                  </div>
                  <Switch checked={telegramSilent} onCheckedChange={setTelegramSilent} />
                </div>
              </div>
            )}

            {/* 自定义 Webhook 配置 */}
            {formType === "webhook" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Webhook URL</Label>
                    <Input
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://example.com/webhook"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>HTTP 方法</Label>
                    <Select value={webhookMethod} onValueChange={setWebhookMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="GET">GET</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>自定义 Headers (JSON 格式，可选)</Label>
                  <textarea
                    className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border bg-background"
                    value={webhookHeaders}
                    onChange={(e) => setWebhookHeaders(e.target.value)}
                    placeholder='{"Authorization": "Bearer token"}'
                  />
                </div>

                <div className="space-y-2">
                  <Label>消息体模板 (支持变量: {"{title}"}, {"{message}"}, {"{subscription}"})</Label>
                  <textarea
                    className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border bg-background font-mono"
                    value={webhookBodyTemplate}
                    onChange={(e) => setWebhookBodyTemplate(e.target.value)}
                    placeholder='{"text": "{title}: {message}"}'
                  />
                </div>
              </div>
            )}

            {/* SMTP 配置 */}
            {formType === "smtp" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SMTP 服务器</Label>
                    <Input
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>端口</Label>
                    <Input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      placeholder="587"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>用户名</Label>
                    <Input
                      value={smtpUsername}
                      onChange={(e) => setSmtpUsername(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>密码</Label>
                    <Input
                      type="password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={editingChannel ? "留空则不修改" : ""}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>发件人邮箱</Label>
                    <Input
                      value={smtpFromEmail}
                      onChange={(e) => setSmtpFromEmail(e.target.value)}
                      placeholder="noreply@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>发件人名称</Label>
                    <Input
                      value={smtpFromName}
                      onChange={(e) => setSmtpFromName(e.target.value)}
                      placeholder="Sub Recorder"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>收件人邮箱</Label>
                  <Input
                    value={smtpToEmail}
                    onChange={(e) => setSmtpToEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>使用 TLS</Label>
                  <Switch checked={smtpUseTls} onCheckedChange={setSmtpUseTls} />
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave}>
                <Check className="h-4 w-4 mr-1" />
                保存
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? "测试中..." : "发送测试"}
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
