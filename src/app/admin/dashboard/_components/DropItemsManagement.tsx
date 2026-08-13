"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Image as ImageIcon,
  Plus,
  Loader2,
  CheckCircle,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  Upload,
  ExternalLink,
} from "lucide-react";
import {
  listDropItems,
  createDropItem,
  updateDropItem,
  deleteDropItem,
  updateDropStatus,
} from "@/actions/drop-actions";
import type { DropItem, DropItemInput, DropItemStatus } from "@/types/database";
import { DROP_STATUS_LABELS } from "@/types/database";
import { useLanguage } from "@/components/i18n/LanguageProvider";

// 掉落状态下拉选项的 i18n key（渲染处用 t() 转换，避免模块级常量引用 hook）
const DROP_STATUS_I18N_KEYS: Record<DropItemStatus, string> = {
  on_sale: "admin.drop.status.onSale",
  preparing: "admin.drop.status.preparing",
  adopted: "admin.drop.status.adopted",
};

const DROP_STATUS_DESC_I18N_KEYS: Record<DropItemStatus, string> = {
  on_sale: "admin.drop.statusDesc.onSale",
  preparing: "admin.drop.statusDesc.preparing",
  adopted: "admin.drop.statusDesc.adopted",
};

interface ToastState {
  type: "success" | "error";
  message: string;
}

interface DropFormState {
  title: string;
  description: string;
  image_url: string;
  price: string;
  status: DropItemStatus;
  copyright: string;
  delivery: string;
  includes: string;
  focus_x: number;
  focus_y: number;
}

const emptyForm: DropFormState = {
  title: "",
  description: "",
  image_url: "",
  price: "",
  status: "preparing",
  copyright: "",
  delivery: "",
  includes: "",
  focus_x: 50,
  focus_y: 50,
};

// 状态徽章配色
const STATUS_STYLES: Record<DropItemStatus, string> = {
  on_sale: "bg-green-50 text-green-600",
  preparing: "bg-amber-50 text-amber-600",
  adopted: "bg-blue-50 text-blue-600",
};

export default function DropItemsManagement() {
  const { t } = useLanguage();
  const [items, setItems] = useState<DropItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 新增表单
  const [form, setForm] = useState<DropFormState>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 编辑弹窗
  const [editing, setEditing] = useState<DropItem | null>(null);
  const [editForm, setEditForm] = useState<DropFormState>(emptyForm);
  const [editUploading, setEditUploading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // 删除确认
  const [deleting, setDeleting] = useState<DropItem | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // 状态切换中
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDropItems();
      if (result.success) {
        setItems((result.data || []) as DropItem[]);
      } else {
        showToast("error", result.error || t("admin.drop.err.loadFailed"));
      }
    } catch (err) {
      console.error("加载掉落列表异常:", err);
      showToast("error", t("admin.drop.err.loadRetry"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems();
  }, [loadItems]);

  // 上传图片（新增表单）
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/drop-items/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.image_url) {
        setForm((prev) => ({ ...prev, image_url: data.image_url }));
        showToast("success", t("admin.drop.err.uploadSuccess"));
      } else {
        showToast("error", data.error || t("admin.drop.err.uploadFailed"));
      }
    } catch {
      showToast("error", t("admin.drop.err.uploadRetry"));
    } finally {
      setUploading(false);
    }
  };

  // 上传图片（编辑弹窗）
  const handleEditUpload = async (file: File) => {
    setEditUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/drop-items/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.image_url) {
        setEditForm((prev) => ({ ...prev, image_url: data.image_url }));
        showToast("success", t("admin.drop.err.uploadSuccess"));
      } else {
        showToast("error", data.error || t("admin.drop.err.uploadFailed"));
      }
    } catch {
      showToast("error", t("admin.drop.err.uploadRetry"));
    } finally {
      setEditUploading(false);
    }
  };

  // 新增掉落
  const handleCreate = async () => {
    if (!form.title.trim()) return showToast("error", t("admin.drop.err.titleRequired"));
    if (!form.image_url) return showToast("error", t("admin.drop.err.imageRequired"));
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return showToast("error", t("admin.drop.err.priceInvalid"));

    setSaving(true);
    try {
      const input: DropItemInput = {
        title: form.title.trim(),
        description: form.description.trim(),
        image_url: form.image_url,
        price,
        status: form.status,
        copyright: form.copyright.trim(),
        delivery: form.delivery.trim(),
        includes: form.includes.trim(),
        focus_x: form.focus_x,
        focus_y: form.focus_y,
      };
      const result = await createDropItem(input);
      if (result.success) {
        showToast("success", t("admin.drop.err.createSuccess"));
        setForm(emptyForm);
        loadItems();
      } else {
        showToast("error", result.error || t("admin.drop.err.createFailed"));
      }
    } catch {
      showToast("error", t("admin.drop.err.createRetry"));
    } finally {
      setSaving(false);
    }
  };

  // 打开编辑弹窗
  const openEdit = (item: DropItem) => {
    setEditing(item);
    setEditForm({
      title: item.title,
      description: item.description,
      image_url: item.image_url,
      price: String(item.price),
      status: item.status,
      copyright: item.copyright,
      delivery: item.delivery,
      includes: item.includes,
      focus_x: typeof item.focus_x === "number" ? item.focus_x : 50,
      focus_y: typeof item.focus_y === "number" ? item.focus_y : 50,
    });
  };

  // 保存编辑
  const handleUpdate = async () => {
    if (!editing) return;
    if (!editForm.title.trim()) return showToast("error", t("admin.drop.err.titleRequired"));
    if (!editForm.image_url) return showToast("error", t("admin.drop.err.editImageRequired"));
    const price = Number(editForm.price);
    if (!Number.isFinite(price) || price < 0) return showToast("error", t("admin.drop.err.priceInvalid"));

    setEditSaving(true);
    try {
      const input: DropItemInput = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        image_url: editForm.image_url,
        price,
        status: editForm.status,
        copyright: editForm.copyright.trim(),
        delivery: editForm.delivery.trim(),
        includes: editForm.includes.trim(),
        focus_x: editForm.focus_x,
        focus_y: editForm.focus_y,
      };
      const result = await updateDropItem(editing.id, input);
      if (result.success) {
        showToast("success", t("admin.drop.err.updateSuccess"));
        setEditing(null);
        loadItems();
      } else {
        showToast("error", result.error || t("admin.drop.err.updateFailed"));
      }
    } catch {
      showToast("error", t("admin.drop.err.updateRetry"));
    } finally {
      setEditSaving(false);
    }
  };

  // 快速切换状态
  const handleStatusChange = async (item: DropItem, status: DropItemStatus) => {
    if (status === item.status) return;
    setStatusUpdating(item.id);
    try {
      const result = await updateDropStatus(item.id, status);
      if (result.success) {
        showToast("success", `掉落状态已切换为「${DROP_STATUS_LABELS[status]}」`);
        loadItems();
      } else {
        showToast("error", result.error || t("admin.drop.err.statusChangeFailed"));
      }
    } catch {
      showToast("error", t("admin.drop.err.statusChangeRetry"));
    } finally {
      setStatusUpdating(null);
    }
  };

  // 确认删除
  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      const result = await deleteDropItem(deleting.id);
      if (result.success) {
        showToast("success", t("admin.drop.err.deleteSuccess"));
        setDeleting(null);
        loadItems();
      } else {
        showToast("error", result.error || t("admin.drop.err.deleteFailed"));
      }
    } catch {
      showToast("error", t("admin.drop.err.deleteRetry"));
    } finally {
      setDeleteSaving(false);
    }
  };

  // 跳转到掉落界面（用户视角 / 管理员编辑模式）
  const goToDropPage = (editMode: boolean) => {
    window.open(`/preorder-step1.html${editMode ? "?edit=1" : ""}`, "_blank");
  };

  // 图片选择框（含焦点框选）
  const renderUploadBox = (
    imageUrl: string,
    uploading: boolean,
    onFile: (file: File) => void,
    focus_x: number,
    focus_y: number,
    tr: (key: string) => string
  ) => (
    <div className="flex items-start gap-3">
      <div className="w-24 h-24 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={tr("admin.drop.imgPreviewAlt")}
            className="w-full h-full object-cover"
            style={{ objectPosition: `${focus_x}% ${focus_y}%` }}
          />
        ) : (
          <ImageIcon className="w-8 h-8 text-gray-300" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? tr("admin.drop.uploading") : tr("admin.drop.upload")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-xs text-gray-400 mt-2">{tr("admin.drop.uploadHint")}</p>
        {imageUrl && (
          <p className="text-xs text-gray-400 mt-1">
            {tr("admin.drop.focusLabel")} X {focus_x.toFixed(0)}% · Y {focus_y.toFixed(0)}%
            {tr("admin.drop.focusHint")}
          </p>
        )}
      </div>
    </div>
  );

  // 焦点框选组件：在完整图片上点击/拖拽选择展示焦点（防止长图/大图裁剪丢失角色）
  const renderFocusPicker = (
    imageUrl: string,
    focus_x: number,
    focus_y: number,
    onFocusChange: (x: number, y: number) => void,
    tr: (key: string) => string
  ) => {
    if (!imageUrl) return null;
    return (
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          {tr("admin.drop.focusPickerHint")}
        </p>
        <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50 select-none"
          style={{ height: 240 }}
          onMouseDown={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            onFocusChange(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="焦点选择"
            className="w-full h-full object-contain"
            draggable={false}
          />
          {/* 焦点十字标记 */}
          <div
            className="absolute w-5 h-5 -ml-2.5 -mt-2.5 pointer-events-none"
            style={{ left: `${focus_x}%`, top: `${focus_y}%` }}
          >
            <div className="absolute inset-0 border-2 border-blue-500 rounded-full opacity-80" />
            <div className="absolute left-1/2 top-1/2 w-px h-3 -ml-px -mt-1.5 bg-blue-500" />
            <div className="absolute left-1/2 top-1/2 h-px w-3 -ml-1.5 -mt-px bg-blue-500" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => onFocusChange(50, 50)}
          className="mt-2 text-xs text-gray-400 hover:text-blue-600"
        >
          {tr("admin.drop.focusReset")}
        </button>
      </div>
    );
  };

  // 表单字段
  const renderField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder = "",
    textarea = false
  ) =>
    textarea ? (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent/20 focus:border-lw-accent"
        />
      </div>
    ) : (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent/20 focus:border-lw-accent"
        />
      </div>
    );

  // 状态下拉
  const renderStatusSelect = (
    value: DropItemStatus,
    onChange: (v: DropItemStatus) => void,
    tr: (key: string) => string
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{tr("admin.drop.status")}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DropItemStatus)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lw-accent/20 focus:border-lw-accent"
      >
        {(Object.keys(DROP_STATUS_LABELS) as DropItemStatus[]).map((s) => (
          <option key={s} value={s}>
            {tr(DROP_STATUS_I18N_KEYS[s])} - {tr(DROP_STATUS_DESC_I18N_KEYS[s])}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div>
        <h1 className="text-xl font-bold text-lw-black">{t("admin.drop.title")}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {t("admin.drop.subtitle")}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600">{t("admin.drop.legendOnSale")}</span>
          <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600">{t("admin.drop.legendPreparing")}</span>
          <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600">{t("admin.drop.legendAdopted")}</span>
        </div>
      </div>

      {/* 操作入口：跳转掉落界面 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{t("admin.drop.interfaceLabel")}</span>
          <button
            onClick={() => goToDropPage(false)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            {t("admin.drop.viewUser")}
          </button>
          <button
            onClick={() => goToDropPage(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lw-accent text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
            {t("admin.drop.editAdmin")}
          </button>
          <span className="text-xs text-gray-400">
            {t("admin.drop.interfaceHint")}
          </span>
        </div>
      </div>

      {/* 新增表单 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-lw-accent" />
          <h2 className="text-base font-semibold text-lw-black">{t("admin.drop.add")}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderField(t("admin.drop.fieldTitle"), form.title, (v) => setForm({ ...form, title: v }), t("admin.drop.phTitle"))}
          {renderField(t("admin.drop.fieldPrice"), form.price, (v) => setForm({ ...form, price: v }), t("admin.drop.phPrice"))}
          {renderStatusSelect(form.status, (v) => setForm({ ...form, status: v }), t)}
          {renderField(t("admin.drop.fieldIncludes"), form.includes, (v) => setForm({ ...form, includes: v }), t("admin.drop.phIncludes"))}
          {renderField(t("admin.drop.fieldCopyright"), form.copyright, (v) => setForm({ ...form, copyright: v }), t("admin.drop.phCopyright"))}
          {renderField(t("admin.drop.fieldDelivery"), form.delivery, (v) => setForm({ ...form, delivery: v }), t("admin.drop.phDelivery"))}
        </div>
        <div className="mt-4">
          {renderField(t("admin.drop.fieldDescription"), form.description, (v) => setForm({ ...form, description: v }), t("admin.drop.phDescription"), true)}
        </div>
        <div className="mt-4">{renderUploadBox(form.image_url, uploading, handleUpload, form.focus_x, form.focus_y, t)}</div>
        {form.image_url && (
          <div className="mt-4">{renderFocusPicker(form.image_url, form.focus_x, form.focus_y, (x, y) => setForm({ ...form, focus_x: x, focus_y: y }), t)}</div>
        )}
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleCreate}
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-lw-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? t("admin.drop.saving") : t("admin.drop.add")}
          </button>
        </div>
      </div>

      {/* 掉落列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-6">
        <h2 className="text-base font-semibold text-lw-black mb-4">
          {t("admin.drop.list")}
          <span className="ml-2 text-xs font-normal text-gray-400">{t("admin.drop.listTotal")} {items.length} {t("admin.drop.listUnit")}</span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">{t("admin.drop.empty")}</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${typeof item.focus_x === "number" ? item.focus_x : 50}% ${typeof item.focus_y === "number" ? item.focus_y : 50}%`,
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-lw-black">{item.title}</span>
                    <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_STYLES[item.status]}`}>
                      {t(DROP_STATUS_I18N_KEYS[item.status])}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    RMB {Number(item.price).toLocaleString()} · {item.includes || "—"}
                  </p>
                </div>
                {/* 状态快速切换 */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select
                    value={item.status}
                    disabled={statusUpdating === item.id}
                    onChange={(e) => handleStatusChange(item, e.target.value as DropItemStatus)}
                    className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-lw-accent/20 cursor-pointer disabled:opacity-50"
                    title={t("admin.drop.statusSwitchTitle")}
                  >
                    {(Object.keys(DROP_STATUS_LABELS) as DropItemStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {t(DROP_STATUS_I18N_KEYS[s])}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => openEdit(item)}
                    className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title={t("admin.drop.edit")}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(item)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title={t("admin.drop.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-lw-black">{t("admin.drop.editTitle")}</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField(t("admin.drop.fieldTitle"), editForm.title, (v) => setEditForm({ ...editForm, title: v }))}
                {renderField(t("admin.drop.fieldPrice"), editForm.price, (v) => setEditForm({ ...editForm, price: v }))}
              </div>
              {renderStatusSelect(editForm.status, (v) => setEditForm({ ...editForm, status: v }), t)}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField(t("admin.drop.fieldIncludes"), editForm.includes, (v) => setEditForm({ ...editForm, includes: v }))}
                {renderField(t("admin.drop.fieldCopyright"), editForm.copyright, (v) => setEditForm({ ...editForm, copyright: v }))}
              </div>
              {renderField(t("admin.drop.fieldDelivery"), editForm.delivery, (v) => setEditForm({ ...editForm, delivery: v }))}
              {renderField(t("admin.drop.fieldDescription"), editForm.description, (v) => setEditForm({ ...editForm, description: v }), "", true)}
              <div>{renderUploadBox(editForm.image_url, editUploading, handleEditUpload, editForm.focus_x, editForm.focus_y, t)}</div>
              {editForm.image_url && (
                <div>{renderFocusPicker(editForm.image_url, editForm.focus_x, editForm.focus_y, (x, y) => setEditForm({ ...editForm, focus_x: x, focus_y: y }), t)}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                {t("admin.drop.cancel")}
              </button>
              <button
                onClick={handleUpdate}
                disabled={editSaving || editUploading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lw-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {editSaving ? t("admin.drop.saving") : t("admin.drop.saveEdit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-lw-black">{t("admin.drop.deleteTitle")}</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600">
                {t("admin.drop.deleteConfirmStart")}{deleting.title}{t("admin.drop.deleteConfirmEnd")}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {t("admin.drop.deleteWarn")}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                {t("admin.drop.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleteSaving ? t("admin.drop.deleting") : t("admin.drop.confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
