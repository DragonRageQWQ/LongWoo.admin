"use client";

import { useState, useRef, useCallback } from "react";
import { Scissors, Paintbrush, Box, Wrench, Upload, FileText, ChevronRight, ChevronLeft } from "lucide-react";
import Button from "@/components/ui/Button";
import StepIndicator from "./components/StepIndicator";

const serviceTypes = [
  { id: "fullsuit", label: "全套兽装", icon: Scissors, desc: "头套+身体+手部+脚部+尾巴" },
  { id: "partial", label: "半套兽装", icon: Paintbrush, desc: "头套+手部+尾巴" },
  { id: "head", label: "头套定制", icon: Box, desc: "独立头套定制" },
  { id: "accessories", label: "配件定制", icon: Wrench, desc: "尾巴、爪子、翅膀等" },
];

const stepLabels = ["服务类型", "需求描述", "上传图片", "联系信息", "确认提交"];

interface FormData {
  serviceType: string;
  description: string;
  images: File[];
  name: string;
  phone: string;
  email: string;
}

export default function OrderSubmitPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    serviceType: "",
    description: "",
    images: [],
    name: "",
    phone: "",
    email: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setFormData((prev) => ({ ...prev, images: [...prev.images, ...arr] }));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const selectedService = serviceTypes.find((s) => s.id === formData.serviceType);

  const canNext = (): boolean => {
    switch (step) {
      case 1:
        return formData.serviceType !== "";
      case 2:
        return formData.description.trim().length > 0;
      case 3:
        return true; // 上传非必填
      case 4:
        return formData.name.trim() !== "" && formData.phone.trim() !== "" && formData.email.trim() !== "";
      default:
        return false;
    }
  };

  const handleSubmit = () => {
    // TODO: 提交到后端
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center bg-lw-gray py-12 px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-lw-black mb-3">提交成功</h2>
          <p className="text-gray-500">您的委托已提交，我们会尽快与您联系。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-lw-gray py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-lw-black text-center mb-8">
          提交委托
        </h1>

        {/* 步骤指示器 */}
        <div className="mb-10">
          <StepIndicator currentStep={step} totalSteps={5} labels={stepLabels} />
        </div>

        {/* 表单内容 */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm min-h-[360px]">
          {/* 步骤 1: 服务类型 */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-lw-black mb-6">选择服务类型</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {serviceTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => updateField("serviceType", type.id)}
                    className={`flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                      formData.serviceType === type.id
                        ? "border-lw-accent bg-blue-50"
                        : "border-gray-100 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        formData.serviceType === type.id
                          ? "bg-lw-accent text-white"
                          : "bg-lw-gray text-lw-black"
                      }`}
                    >
                      <type.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-lw-black">{type.label}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{type.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 步骤 2: 需求描述 */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-lw-black mb-6">描述您的需求</h2>
              <textarea
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="请详细描述您的需求，包括角色设定、配色方案、尺寸要求、功能需求等..."
                rows={8}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
              />
              <p className="text-xs text-gray-400 mt-2">
                请尽可能详细地描述您的需求，有助于我们更准确地估价。
              </p>
            </div>
          )}

          {/* 步骤 3: 上传设定图 */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-lw-black mb-6">上传设定图（可选）</h2>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-lw-accent bg-blue-50"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  拖拽图片到此处，或点击选择文件
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  支持 JPG、PNG、WEBP，单个文件不超过 10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                  className="hidden"
                />
              </div>
              {/* 已上传文件列表 */}
              {formData.images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {formData.images.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg bg-lw-gray flex items-center justify-center overflow-hidden">
                        <FileText className="w-6 h-6 text-gray-400" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        X
                      </button>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {file.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 步骤 4: 联系信息 */}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold text-lw-black mb-6">填写联系信息</h2>
              <div className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-lw-black mb-1.5">
                    姓名
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="请输入您的姓名"
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-lw-black mb-1.5">
                    手机号
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="请输入您的手机号"
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label htmlFor="email2" className="block text-sm font-medium text-lw-black mb-1.5">
                    邮箱
                  </label>
                  <input
                    id="email2"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="请输入您的邮箱"
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 步骤 5: 确认提交 */}
          {step === 5 && (
            <div>
              <h2 className="text-lg font-semibold text-lw-black mb-6">确认信息</h2>
              <div className="space-y-4">
                <div className="bg-lw-gray rounded-xl p-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">服务类型</span>
                    <span className="font-medium text-lw-black">
                      {selectedService?.label ?? "-"}
                    </span>
                  </div>
                  <div className="border-t border-gray-200" />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">需求描述</span>
                  </div>
                  <p className="text-sm text-gray-600 bg-white rounded-lg p-3">
                    {formData.description}
                  </p>
                  <div className="border-t border-gray-200" />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">附件数量</span>
                    <span className="font-medium text-lw-black">
                      {formData.images.length} 个文件
                    </span>
                  </div>
                  <div className="border-t border-gray-200" />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">联系人</span>
                    <span className="font-medium text-lw-black">{formData.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">手机号</span>
                    <span className="font-medium text-lw-black">{formData.phone}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">邮箱</span>
                    <span className="font-medium text-lw-black">{formData.email}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 导航按钮 */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            size="md"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            上一步
          </Button>

          {step < 5 ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setStep((s) => Math.min(5, s + 1))}
              disabled={!canNext()}
            >
              下一步
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={handleSubmit}>
              提交委托
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
