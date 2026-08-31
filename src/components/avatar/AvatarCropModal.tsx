"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import "./avatar-crop.css";

/** 裁切输出边长：统一 512x512（头像展示尺寸，控制体积与清晰度） */
const OUTPUT_SIZE = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

/** 按选区从原图抠图并缩放为方形 JPEG Blob（与头像上传接口兼容） */
async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D 不可用");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("生成图片失败"))),
      "image/jpeg",
      0.9
    );
  });
}

/**
 * 头像裁切弹窗：选图后自由拖动选区 + 滚轮/滑块放大缩小
 *
 * @param open      是否显示
 * @param imageSrc  待裁切的图片（dataURL）
 * @param onCancel  取消（关闭弹窗）
 * @param onConfirm 确认回调：收到裁切后的 Blob，失败时 throw Error 展示在弹窗内
 */
export default function AvatarCropModal({
  open,
  imageSrc,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  imageSrc: string | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageSrcRef = useRef<string | null>(null);

  // 每次打开新图片时重置裁切状态
  useEffect(() => {
    if (!open || !imageSrc) return;
    if (imageSrcRef.current === imageSrc) return;
    imageSrcRef.current = imageSrc;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setError(null);
  }, [open, imageSrc]);

  // Esc 关闭（上传中不响应）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  const handleCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setArea(croppedAreaPixels);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!imageSrc || !area || busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await cropToBlob(imageSrc, area);
      await onConfirm(blob);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("profile.crop.err")
      );
    } finally {
      setBusy(false);
    }
  }, [imageSrc, area, busy, onConfirm, t]);

  if (!open || !imageSrc) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("profile.crop.title")}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 + 关闭 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-neutral-900">
            {t("profile.crop.title")}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label={t("profile.crop.cancel")}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer disabled:opacity-40"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              width="16"
              height="16"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 裁切区：自由拖动 + 滚轮缩放 */}
        <div className="avc-stage">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={1}
            maxZoom={4}
            zoomSpeed={0.6}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        {/* 缩放滑块 */}
        <div className="avc-zoom">
          <ZoomOut className="avc-zoom-icon" size={16} />
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="avc-zoom-range"
            aria-label={t("profile.crop.zoom")}
          />
          <ZoomIn className="avc-zoom-icon" size={16} />
        </div>
        <p className="mt-1.5 text-xs text-neutral-400">{t("profile.crop.hint")}</p>

        {error && (
          <p className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* 操作按钮 */}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-40"
          >
            {t("profile.crop.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !area}
            className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? t("profile.crop.saving") : t("profile.crop.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
