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

export default function WorksManagement({
  isSuperAdmin = false,
}: {
  isSuperAdmin?: boolean;
}) {
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
        showToast("error", result.error || "加载失败");
      }
    } catch (err) {
      console.error("加载作品列表异常:", err);
      showToast("error", "加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
      const res = await fetch("/api/works/upload", { method: "POST", body: formData });
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

  // 新增作品
  const handleCreate = async () => {
    if (!form.title.trim()) return showToast("error", "请填写作品名称");
    if (!form.description.trim()) return showToast("error", "请填写作品描述");
    if (!form.image_url) return showToast("error", "请先上传作品图片");

    setSaving(true);
    try {
      const result = await createWork(form as WorkInput);
      if (result.success) {
        showToast("success", "作品新增成功");
        setForm(emptyForm);
        if (result.nextCode) setNextCode(result.nextCode);
        loadWorks();
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
    if (!editForm.title.trim()) return showToast("error", "请填写作品名称");
    if (!editForm.description.trim()) return showToast("error", "请填写作品描述");
    if (!editForm.image_url) return showToast("error", "请上传作品图片");

    setEditSaving(true);
    try {
      const result = await updateWork(editing.id, editForm as WorkInput);
      if (result.success) {
        showToast("success", "作品修改成功");
        setEditing(null);
        loadWorks();
      } else {
        showToast("error", result.error || "修改失败");
      }
    } catch {
      showToast("error", "修改失败，请稍后重试");
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
        showToast("success", "作品已删除，后续序号已自动重排");
        setDeleting(null);
        loadWorks();
      } else {
        showToast("error", result.error || "删除失败");
      }
    } catch {
      showToast("error", "删除失败，请稍后重试");
    } finally {
      setDeleteSaving(false);
    }
  };

  // 图片选择框（新增）
  const renderUploadBox = (
    imageUrl: string,
    uploading: boolean,
    onFile: (file: File) => void
  ) => (
    <div className="flex items-start gap-3">
      <div className="w-24 h-24 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt="作品图片预览" className="w-full h-full object-cover" />
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

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div>
        <h1 className="text-xl font-bold text-lw-black">作品管理</h1>
        <p className="text-sm text-gray-400 mt-1">
          管理首页「我们的作品」展示内容（仅超级管理员可用）
        </p>
      </div>

      {/* 新增表单 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-lw-accent" />
          <h2 className="text-base font-semibold text-lw-black">
            新增作品
            <span className="ml-2 text-xs font-normal text-gray-400">
              将自动分配编码：作品 {nextCode || "--"}
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderField("作品名称 *", form.title, (v) => setForm({ ...form, title: v }), "如：板栗")}
          {renderField("类型标签", form.tag, (v) => setForm({ ...form, tag: v }), "全装定制案例")}
          {renderField("定制类型", form.work_type, (v) => setForm({ ...form, work_type: v }))}
          {renderField("交付周期", form.delivery, (v) => setForm({ ...form, delivery: v }))}
          {renderField("制作工艺", form.craft, (v) => setForm({ ...form, craft: v }))}
        </div>
        <div className="mt-4">
          {renderField("作品描述 *", form.description, (v) => setForm({ ...form, description: v }), "简要介绍该作品", true)}
        </div>
        <div className="mt-4">{renderUploadBox(form.image_url, uploading, handleUpload)}</div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleCreate}
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-lw-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "保存中..." : "新增作品"}
          </button>
        </div>
      </div>

      {/* 作品列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-6">
        <h2 className="text-base font-semibold text-lw-black mb-4">
          作品列表
          <span className="ml-2 text-xs font-normal text-gray-400">共 {works.length} 个作品</span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : works.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">暂无作品，请先新增</div>
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
                      作品 {work.code}
                    </span>
                    <span className="text-sm font-semibold text-lw-black truncate">{work.title}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 truncate">{work.description}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setPreviewing(work)}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title="预览"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(work)}
                    className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="编辑"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(work)}
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
              <h3 className="text-base font-semibold text-lw-black">
                编辑作品
                <span className="ml-2 text-xs font-normal text-gray-400">作品 {editing.code}</span>
              </h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("作品名称 *", editForm.title, (v) => setEditForm({ ...editForm, title: v }))}
                {renderField("类型标签", editForm.tag, (v) => setEditForm({ ...editForm, tag: v }))}
                {renderField("定制类型", editForm.work_type, (v) => setEditForm({ ...editForm, work_type: v }))}
                {renderField("交付周期", editForm.delivery, (v) => setEditForm({ ...editForm, delivery: v }))}
              </div>
              <div>
                {renderField("制作工艺", editForm.craft, (v) => setEditForm({ ...editForm, craft: v }))}
              </div>
              <div>
                {renderField("作品描述 *", editForm.description, (v) => setEditForm({ ...editForm, description: v }), "", true)}
              </div>
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
              <h3 className="text-base font-semibold text-lw-black">删除作品</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600">
                确定要删除「作品 {deleting.code} - {deleting.title}」吗？
              </p>
              <p className="text-xs text-gray-400 mt-2">
                删除后，后续作品的编码序号将自动前移补齐。
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
              <span className="text-white font-medium">作品 {previewing.code} - {previewing.title}</span>
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
