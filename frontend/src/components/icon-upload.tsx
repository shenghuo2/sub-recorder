"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Link, Image as ImageIcon } from "lucide-react";
import * as api from "@/lib/api";

interface Props {
  subscriptionId: string;
  currentIcon: string | null;
  currentMimeType: string | null;
  onUpdated: () => void;
  tintFilter?: string;
}

const ACCEPTED_TYPES = "image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/gif";

function getMimeFromFile(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "svg": return "image/svg+xml";
    case "webp": return "image/webp";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    default: return "image/png";
  }
}

export function IconUpload({ subscriptionId, currentIcon, currentMimeType, onUpdated, tintFilter }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const iconSrc = currentIcon
    ? `data:${currentMimeType || "image/png"};base64,${currentIcon}`
    : null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 512 * 1024) {
      toast.error("图片不能超过 512KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadFile = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("请选择文件");
      return;
    }

    setUploading(true);
    try {
      const mime = getMimeFromFile(file);
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const b64 = dataUrl.split(",")[1];
        await api.uploadIcon(subscriptionId, b64, mime);
        toast.success("图标已更新");
        setDialogOpen(false);
        setPreview(null);
        onUpdated();
      };
      reader.readAsDataURL(file);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadUrl = async () => {
    if (!url.trim()) {
      toast.error("请输入图片 URL");
      return;
    }

    setUploading(true);
    try {
      await api.uploadIconFromUrl(subscriptionId, url.trim());
      toast.success("图标已更新");
      setDialogOpen(false);
      setUrl("");
      onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="h-16 w-16 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
      >
        {iconSrc ? (
          <img src={iconSrc} alt="icon" className="h-14 w-14 object-contain" style={tintFilter ? { filter: tintFilter } : undefined} />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>设置图标</DialogTitle>
          </DialogHeader>

          {/* Tab 切换 */}
          <div className="flex gap-2 border-b pb-2">
            <Button
              size="sm"
              variant={mode === "file" ? "default" : "ghost"}
              onClick={() => setMode("file")}
            >
              <Upload className="h-4 w-4 mr-1" />
              本地上传
            </Button>
            <Button
              size="sm"
              variant={mode === "url" ? "default" : "ghost"}
              onClick={() => setMode("url")}
            >
              <Link className="h-4 w-4 mr-1" />
              URL 获取
            </Button>
          </div>

          {mode === "file" ? (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>选择图片</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileSelect}
                />
                <p className="text-xs text-muted-foreground">
                  支持 PNG、JPG、SVG、WebP，最大 512KB
                </p>
              </div>
              {preview && (
                <div className="flex justify-center p-4 bg-muted/50 rounded-lg">
                  <img src={preview} alt="preview" className="h-16 w-16 object-contain" />
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
                <Button onClick={handleUploadFile} disabled={uploading}>
                  {uploading ? "上传中..." : "上传"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>图片 URL</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  支持 PNG、JPG、SVG、WebP 格式的直链
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
                <Button onClick={handleUploadUrl} disabled={uploading}>
                  {uploading ? "获取中..." : "获取"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
