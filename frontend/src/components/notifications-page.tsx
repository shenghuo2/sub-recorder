"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Mail, Webhook, Check, AlertCircle } from "lucide-react";
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

  // 新增/编辑表单状态
  const [formType, setFormType] = useState<"smtp" | "webhook">("webhook");
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
  const [webhookBodyTemplate, setWebhookBodyTemplate] = useState('{"message": "{message}"}');

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
    setFormType("webhook");
    
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
    setWebhookBodyTemplate('{"message": "{message}"}');
    
    setEditingChannel(null);
    setShowAddForm(false);
  };

  const handleEdit = (channel: NotificationChannel) => {
    setEditingChannel(channel);
    setFormName(channel.name);
    setFormEnabled(channel.enabled);
    setFormType(channel.channel_type);

    if (channel.channel_type === "smtp") {
      const config = channel.config;
      setSmtpHost(config.host || "");
      setSmtpPort(config.port || 587);
      setSmtpUsername(config.username || "");
      setSmtpPassword("");
      setSmtpFromEmail(config.from_email || "");
      setSmtpFromName(config.from_name || "Sub Recorder");
      setSmtpToEmail(config.to_email || "");
      setSmtpUseTls(config.use_tls !== false);
    } else if (channel.channel_type === "webhook") {
      const config = channel.config;
      setWebhookUrl(config.url || "");
      setWebhookMethod(config.method || "POST");
      setWebhookType(config.webhook_type || "onebot");
      setWebhookHeaders(config.headers ? JSON.stringify(config.headers, null, 2) : "");
      setWebhookBodyTemplate(config.body_template || '{"message": "{message}"}');
    }

    setShowAddForm(true);
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
        webhook_type: webhookType,
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
        webhook_type: webhookType,
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
                {channel.channel_type === "smtp" ? (
                  <Mail className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Webhook className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <div className="font-medium">{channel.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {channel.channel_type === "smtp" ? "邮件通知" : "Webhook 通知"}
                    {channel.channel_type === "webhook" && ` (${channel.config.webhook_type})`}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>渠道名称</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如：QQ 机器人通知"
                />
              </div>
              <div className="space-y-2">
                <Label>通知类型</Label>
                <Select
                  value={formType}
                  onValueChange={(v: "smtp" | "webhook") => setFormType(v)}
                  disabled={!!editingChannel}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="smtp">邮件 (SMTP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>启用此渠道</Label>
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
            </div>

            {/* Webhook 配置 */}
            {formType === "webhook" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Webhook 类型</Label>
                  <Select value={webhookType} onValueChange={setWebhookType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onebot">OneBot 协议 (QQ机器人)</SelectItem>
                      <SelectItem value="custom">自定义</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Webhook URL</Label>
                    <Input
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="http://localhost:5700/send_private_msg?user_id=123456"
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

                {webhookType === "custom" && (
                  <>
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
                  </>
                )}

                {webhookType === "onebot" && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• OneBot 协议会自动发送 POST 请求，消息体格式为: {`{"message": "..."}`}</p>
                    <p>• URL 示例: http://localhost:5700/send_private_msg?user_id=123456</p>
                  </div>
                )}
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
