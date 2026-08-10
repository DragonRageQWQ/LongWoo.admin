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
import { DROP_STATUS_LABELS, DROP_STATUS_DESCRIPTIONS } from "@/types/database";

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
};

// 状态徽章配色
const STATUS_STYLES: Record<DropItemStatus, string> = {
  on_sale: "bg-green-50 text-green-600",
  preparing: "bg-amber-50 text-amber-600",
  adopted: "bg-blue-50 text-blue-600",
};

export default function DropItemsManagement() {
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
        showToast("error", result.error || "加载失败");
      }
    } catch (err) {
      console.error("加载掉落列表异常:", err);
      showToast("error", "加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

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
        showToast("success", "图片上传成功");
      } else {
        showToast("error", data.error || "图片上传失败");
      }
    } catch {
      showToast("error", "图片上传失败，请稍后重试");
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
        showToast("success", "图片上传成功");
      } else {
        showToast("error", data.error || "图片上传失败");
      }
    } catch {
      showToast("error", "图片上传失败，请稍后重试");
    } finally {
      setEditUploading(false);
    }
  };

  // 新增掉落
  const handleCreate = async () => {
    if (!form.title.trim()) return showToast("error", "请填写掉落标题");
    if (!form.image_url) return showToast("error", "请先上传介绍图片");
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return showToast("error", "请填写有效价格");

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
      };
      const result = await createDropItem(input);
      if (result.success) {
        showToast("success", "掉落新增成功");
        setForm(emptyForm);
        loadItems();
      } else {
        showToast("error", result.error || "新增失败");
      }
    } catch {
      showToast("error", "新增失败，请稍后重试");
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
    });
  };

  // 保存编辑
  const handleUpdate = async () => {
    if (!editing) return;
    if (!editForm.title.trim()) return showToast("error", "请填写掉落标题");
    if (!editForm.image_url) return showToast("error", "请上传介绍图片");
    const price = Number(editForm.price);
    if (!Number.isFinite(price) || price < 0) return showToast("error", "请填写有效价格");

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
      };
      const result = await updateDropItem(editing.id, input);
      if (result.success) {
        showToast("success", "掉落修改成功");
        setEditing(null);
        loadItems();
      } else {
        showToast("error", result.error || "修改失败");
      }
    } catch {
      showToast("error", "修改失败，请稍后重试");
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
        showToast("error", result.error || "状态切换失败");
      }
    } catch {
      showToast("error", "状态切换失败，请稍后重试");
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
        showToast("success", "掉落已删除");
        setDeleting(null);
        loadItems();
      } else {
        showToast("error", result.error || "删除失败");
      }
    } catch {
      showToast("error", "删除失败，请稍后重试");
    } finally {
      setDeleteSaving(false);
    }
  };

  // 跳转到掉落界面（用户视角 / 管理员编辑模式）
  const goToDropPage = (editMode: boolean) => {
    window.open(`/preorder-step1.html${editMode ? "?edit=1" : ""}`, "_blank");
  };

  // 图片选择框
  const renderUploadBox = (
    imageUrl: string,
    uploading: boolean,
    onFile: (file: File) => void
  ) => (
    <div className="flex items-start gap-3">
      <div className="w-24 h-24 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="掉落图片预览" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-8 h-8 text-gray-300" />
        )}
      </div>
      <div className="flex-1">
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? "上传中..." : "上传图片"}
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
        <p className="text-xs text-gray-400 mt-2">支持 JPG / PNG / GIF / WebP，不超过 8MB</p>
      </div>
    </div>
  );

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
    onChange: (v: DropItemStatus) => void
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">掉落状态 *</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DropItemStatus)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lw-accent/20 focus:border-lw-accent"
      >
        {(Object.keys(DROP_STATUS_LABELS) as DropItemStatus[]).map((s) => (
          <option key={s} value={s}>
            {DROP_STATUS_LABELS[s]} - {DROP_STATUS_DESCRIPTIONS[s]}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div>
        <h1 className="text-xl font-bold text-lw-black">掉落管理</h1>
        <p className="text-sm text-gray-400 mt-1">
          管理「购买掉落」界面展示内容（仅超级管理员可用）
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600">发售：可以购买</span>
          <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600">准备：只能查看，不能购买</span>
          <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600">领养：已被购买，交付中</span>
        </div>
      </div>

      {/* 操作入口：跳转掉落界面 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">掉落界面：</span>
          <button
            onClick={() => goToDropPage(false)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            查看掉落界面（用户视角）
          </button>
          <button
            onClick={() => goToDropPage(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lw-accent text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
            在掉落界面编辑（管理员模式）
          </button>
          <span className="text-xs text-gray-400">
            点击后跳转到购买掉落界面，管理员模式下可直接编辑内容并保存
          </span>
        </div>
      </div>

      {/* 新增表单 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-lw-accent" />
          <h2 className="text-base font-semibold text-lw-black">新增掉落</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderField("掉落标题 *", form.title, (v) => setForm({ ...form, title: v }), "如：百丈冰")}
          {renderField("价格（RMB）*", form.price, (v) => setForm({ ...form, price: v }), "如：35000")}
          {renderStatusSelect(form.status, (v) => setForm({ ...form, status: v }))}
          {renderField("包含内容", form.includes, (v) => setForm({ ...form, includes: v }), "如：双视图/标准全装/定制外衣/定制道具")}
          {renderField("版权说明", form.copyright, (v) => setForm({ ...form, copyright: v }), "如：全部版权转让/可商用*")}
          {renderField("交付说明", form.delivery, (v) => setForm({ ...form, delivery: v }), "如：成品部分立即交付，剩余预计 4-6 周")}
        </div>
        <div className="mt-4">
          {renderField("介绍信息", form.description, (v) => setForm({ ...form, description: v }), "简要介绍该掉落", true)}
        </div>
        <div className="mt-4">{renderUploadBox(form.image_url, uploading, handleUpload)}</div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleCreate}
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-lw-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "保存中..." : "新增掉落"}
          </button>
        </div>
      </div>

      {/* 掉落列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-6">
        <h2 className="text-base font-semibold text-lw-black mb-4">
          掉落列表
          <span className="ml-2 text-xs font-normal text-gray-400">共 {items.length} 个掉落</span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">暂无掉落，请先新增</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-lw-black">{item.title}</span>
                    <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_STYLES[item.status]}`}>
                      {DROP_STATUS_LABELS[item.status]}
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
                    title="切换掉落状态"
                  >
                    {(Object.keys(DROP_STATUS_LABELS) as DropItemStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {DROP_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => openEdit(item)}
                    className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="编辑"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(item)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="删除"
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
              <h3 className="text-base font-semibold text-lw-black">编辑掉落</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("掉落标题 *", editForm.title, (v) => setEditForm({ ...editForm, title: v }))}
                {renderField("价格（RMB）*", editForm.price, (v) => setEditForm({ ...editForm, price: v }))}
              </div>
              {renderStatusSelect(editForm.status, (v) => setEditForm({ ...editForm, status: v }))}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("包含内容", editForm.includes, (v) => setEditForm({ ...editForm, includes: v }))}
                {renderField("版权说明", editForm.copyright, (v) => setEditForm({ ...editForm, copyright: v }))}
              </div>
              {renderField("交付说明", editForm.delivery, (v) => setEditForm({ ...editForm, delivery: v }))}
              {renderField("介绍信息", editForm.description, (v) => setEditForm({ ...editForm, description: v }), "", true)}
              <div>{renderUploadBox(editForm.image_url, editUploading, handleEditUpload)}</div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleUpdate}
                disabled={editSaving || editUploading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lw-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {editSaving ? "保存中..." : "保存修改"}
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
              <h3 className="text-base font-semibold text-lw-black">删除掉落</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600">
                确定要删除掉落「{deleting.title}」吗？
              </p>
              <p className="text-xs text-gray-400 mt-2">
                删除后立即从前端掉落界面消失，此操作不可恢复。
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleteSaving ? "删除中..." : "确认删除"}
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
