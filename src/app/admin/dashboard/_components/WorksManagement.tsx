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
  Eye,
} from "lucide-react";
import {
  listWorks,
  createWork,
  updateWork,
  deleteWork,
} from "@/actions/works-actions";
import type { Work, WorkInput } from "@/types/database";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface ToastState {
  type: "success" | "error";
  message: string;
}

interface WorkFormState {
  title: string;
  tag: string;
  description: string;
  work_type: string;
  delivery: string;
  craft: string;
  image_url: string;
}

const emptyForm: WorkFormState = {
  title: "",
  tag: "全装定制案例",
  description: "",
  work_type: "全装定制",
  delivery: "预计 4-6 周",
  craft: "立体剪裁 · 手工缝制",
  image_url: "",
};

export default function WorksManagement() {
  const { t } = useLanguage();
  // 列表
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCode, setNextCode] = useState("");

  // 新增表单
  const [form, setForm] = useState<WorkFormState>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 编辑弹窗
  const [editing, setEditing] = useState<Work | null>(null);
  const [editForm, setEditForm] = useState<WorkFormState>(emptyForm);
  const [editUploading, setEditUploading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // 删除确认
  const [deleting, setDeleting] = useState<Work | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // 预览
  const [previewing, setPreviewing] = useState<Work | null>(null);

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

  // 加载作品列表
  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listWorks();
      if (result.success) {
        setWorks((result.data || []) as Work[]);
        if (result.nextCode) setNextCode(result.nextCode);
      } else {
        showToast("error", result.error || t("admin.works.err.loadFailed"));
      }
    } catch (err) {
      console.error("加载作品列表异常:", err);
      showToast("error", t("admin.works.err.loadRetry"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWorks();
  }, [loadWorks]);

  // 上传图片（新增表单）
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/works/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.image_url) {
        setForm((prev) => ({ ...prev, image_url: data.image_url }));
        showToast("success", t("admin.works.err.uploadSuccess"));
      } else {
        showToast("error", data.error || t("admin.works.err.uploadFailed"));
      }
    } catch {
      showToast("error", t("admin.works.err.uploadRetry"));
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
      const res = await fetch("/api/works/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.image_url) {
        setEditForm((prev) => ({ ...prev, image_url: data.image_url }));
        showToast("success", t("admin.works.err.uploadSuccess"));
      } else {
        showToast("error", data.error || t("admin.works.err.uploadFailed"));
      }
    } catch {
      showToast("error", t("admin.works.err.uploadRetry"));
    } finally {
      setEditUploading(false);
    }
  };

  // 新增作品
  const handleCreate = async () => {
    if (!form.title.trim()) return showToast("error", t("admin.works.err.titleRequired"));
    if (!form.description.trim()) return showToast("error", t("admin.works.err.descRequired"));
    if (!form.image_url) return showToast("error", t("admin.works.err.imageRequired"));

    setSaving(true);
    try {
      const result = await createWork(form as WorkInput);
      if (result.success) {
        showToast("success", t("admin.works.err.createSuccess"));
        setForm(emptyForm);
        if (result.nextCode) setNextCode(result.nextCode);
        loadWorks();
      } else {
        showToast("error", result.error || t("admin.works.err.createFailed"));
      }
    } catch {
      showToast("error", t("admin.works.err.createRetry"));
    } finally {
      setSaving(false);
    }
  };

  // 打开编辑弹窗
  const openEdit = (work: Work) => {
    setEditing(work);
    setEditForm({
      title: work.title,
      tag: work.tag,
      description: work.description,
      work_type: work.work_type,
      delivery: work.delivery,
      craft: work.craft,
      image_url: work.image_url,
    });
  };

  // 保存编辑
  const handleUpdate = async () => {
    if (!editing) return;
    if (!editForm.title.trim()) return showToast("error", t("admin.works.err.titleRequired"));
    if (!editForm.description.trim()) return showToast("error", t("admin.works.err.descRequired"));
    if (!editForm.image_url) return showToast("error", t("admin.works.err.editImageRequired"));

    setEditSaving(true);
    try {
      const result = await updateWork(editing.id, editForm as WorkInput);
      if (result.success) {
        showToast("success", t("admin.works.err.updateSuccess"));
        setEditing(null);
        loadWorks();
      } else {
        showToast("error", result.error || t("admin.works.err.updateFailed"));
      }
    } catch {
      showToast("error", t("admin.works.err.updateRetry"));
    } finally {
      setEditSaving(false);
    }
  };

  // 确认删除
  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      const result = await deleteWork(deleting.id);
      if (result.success) {
        showToast("success", t("admin.works.err.deleteSuccess"));
        setDeleting(null);
        loadWorks();
      } else {
        showToast("error", result.error || t("admin.works.err.deleteFailed"));
      }
    } catch {
      showToast("error", t("admin.works.err.deleteRetry"));
    } finally {
      setDeleteSaving(false);
    }
  };

  // 图片选择框（新增）
  const renderUploadBox = (
    imageUrl: string,
    uploading: boolean,
    onFile: (file: File) => void,
    tr: (key: string) => string
  ) => (
    <div className="flex items-start gap-3">
      <div className="w-24 h-24 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={tr("admin.works.imgPreviewAlt")} className="w-full h-full object-cover" />
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
          {uploading ? tr("admin.works.uploading") : tr("admin.works.upload")}
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
        <p className="text-xs text-gray-400 mt-2">{tr("admin.works.uploadHint")}</p>
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

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div>
        <h1 className="text-xl font-bold text-lw-black">{t("admin.works.title")}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {t("admin.works.subtitle")}
        </p>
        <p className="text-xs text-gray-400 mt-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg inline-block">
          {t("admin.works.tip")}
        </p>
      </div>

      {/* 新增表单 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-lw-accent" />
          <h2 className="text-base font-semibold text-lw-black">
            {t("admin.works.add")}
            <span className="ml-2 text-xs font-normal text-gray-400">
              {t("admin.works.autoCode")}{nextCode || "--"}
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderField(t("admin.works.fieldTitle"), form.title, (v) => setForm({ ...form, title: v }), t("admin.works.phTitle"))}
          {renderField(t("admin.works.fieldTag"), form.tag, (v) => setForm({ ...form, tag: v }), t("admin.works.phTag"))}
          {renderField(t("admin.works.fieldType"), form.work_type, (v) => setForm({ ...form, work_type: v }))}
          {renderField(t("admin.works.fieldDelivery"), form.delivery, (v) => setForm({ ...form, delivery: v }))}
          {renderField(t("admin.works.fieldCraft"), form.craft, (v) => setForm({ ...form, craft: v }))}
        </div>
        <div className="mt-4">
          {renderField(t("admin.works.fieldDesc"), form.description, (v) => setForm({ ...form, description: v }), t("admin.works.phDesc"), true)}
        </div>
        <div className="mt-4">{renderUploadBox(form.image_url, uploading, handleUpload, t)}</div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleCreate}
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-lw-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? t("admin.works.saving") : t("admin.works.add")}
          </button>
        </div>
      </div>

      {/* 作品列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-6">
        <h2 className="text-base font-semibold text-lw-black mb-4">
          {t("admin.works.list")}
          <span className="ml-2 text-xs font-normal text-gray-400">{t("admin.works.listTotal")} {works.length} {t("admin.works.listUnit")}</span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : works.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">{t("admin.works.empty")}</div>
        ) : (
          <div className="space-y-3">
            {works.map((work) => (
              <div
                key={work.id}
                className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50">
                  <img src={work.image_url} alt={work.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-lw-accent bg-lw-accent/10 rounded-full px-2 py-0.5 flex-shrink-0">
                      {t("admin.works.workPrefix")}{work.code}
                    </span>
                    <span className="text-sm font-semibold text-lw-black truncate">{work.title}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 truncate">{work.description}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setPreviewing(work)}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title={t("admin.works.preview")}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(work)}
                    className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title={t("admin.works.edit")}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(work)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title={t("admin.works.delete")}
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
              <h3 className="text-base font-semibold text-lw-black">
                {t("admin.works.editTitle")}
                <span className="ml-2 text-xs font-normal text-gray-400">{t("admin.works.workPrefix")}{editing.code}</span>
              </h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField(t("admin.works.fieldTitle"), editForm.title, (v) => setEditForm({ ...editForm, title: v }))}
                {renderField(t("admin.works.fieldTag"), editForm.tag, (v) => setEditForm({ ...editForm, tag: v }))}
                {renderField(t("admin.works.fieldType"), editForm.work_type, (v) => setEditForm({ ...editForm, work_type: v }))}
                {renderField(t("admin.works.fieldDelivery"), editForm.delivery, (v) => setEditForm({ ...editForm, delivery: v }))}
              </div>
              <div>
                {renderField(t("admin.works.fieldCraft"), editForm.craft, (v) => setEditForm({ ...editForm, craft: v }))}
              </div>
              <div>
                {renderField(t("admin.works.fieldDesc"), editForm.description, (v) => setEditForm({ ...editForm, description: v }), "", true)}
              </div>
              <div>{renderUploadBox(editForm.image_url, editUploading, handleEditUpload, t)}</div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                {t("admin.works.cancel")}
              </button>
              <button
                onClick={handleUpdate}
                disabled={editSaving || editUploading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lw-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {editSaving ? t("admin.works.saving") : t("admin.works.saveEdit")}
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
              <h3 className="text-base font-semibold text-lw-black">{t("admin.works.deleteTitle")}</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600">
                {t("admin.works.deleteConfirmStart")}{deleting.code} - {deleting.title}{t("admin.works.deleteConfirmEnd")}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {t("admin.works.deleteWarn")}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                {t("admin.works.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleteSaving ? t("admin.works.deleting") : t("admin.works.confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewing(null)}>
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewing(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={previewing.image_url} alt={previewing.title} className="w-full rounded-lg shadow-lg" />
            <div className="mt-3 text-center">
              <span className="text-white font-medium">{t("admin.works.workPrefix")}{previewing.code} - {previewing.title}</span>
              <p className="text-white/60 text-sm mt-1">{previewing.description}</p>
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
