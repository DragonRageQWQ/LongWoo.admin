"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, Upload, ArrowRight, ArrowLeft } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import StepIndicator from "./components/StepIndicator";
import { createOrder, getServiceTypes } from "@/actions/order-actions";

const TOTAL_STEPS = 3;
const STEP_LABELS = ["填写信息", "描述需求", "确认提交"];

export default function OrderSubmitPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 服务类型列表
  const [serviceTypes, setServiceTypes] = useState<Array<{ id: string; name: string; price_range: string | null }>>([]);

  // 表单数据
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    serviceTypeId: "",
    requirements: "",
  });

  // 加载服务类型
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getServiceTypes();
      if (!cancelled && result.success && result.data) {
        setServiceTypes(result.data);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateStep = (): boolean => {
    if (currentStep === 1) {
      if (!formData.customerName.trim()) {
        setError("请输入您的姓名");
        return false;
      }
      if (!formData.customerPhone.trim()) {
        setError("请输入联系电话");
        return false;
      }
      if (!/^1[3-9]\d{9}$/.test(formData.customerPhone)) {
        setError("请输入有效的手机号码");
        return false;
      }
      if (!formData.customerEmail.trim()) {
        setError("请输入邮箱地址");
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) {
        setError("请输入有效的邮箱地址");
        return false;
      }
    }
    if (currentStep === 2) {
      if (!formData.requirements.trim()) {
        setError("请描述您的定制需求");
        return false;
      }
      if (formData.requirements.trim().length < 10) {
        setError("需求描述至少需要 10 个字");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await createOrder({
        serviceTypeId: formData.serviceTypeId || undefined,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerEmail: formData.customerEmail.trim(),
        requirements: formData.requirements.trim(),
      });

      if (result.success && result.orderNo) {
        setOrderNo(result.orderNo);
        setSuccess(true);
      } else {
        setError(result.error || "提交失败，请重试");
      }
    } catch {
      setError("提交委托单时发生未知错误");
    } finally {
      setSubmitting(false);
    }
  };

  // 提交成功页面
  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-lw-black mb-3">
              委托提交成功
            </h1>
            <p className="text-gray-500 mb-2">您的委托单号：</p>
            <p className="text-2xl font-bold text-lw-accent mb-8">
              {orderNo}
            </p>
            <p className="text-sm text-gray-400 mb-8">
              我们将在 1-2 个工作日内与您联系，请保持电话畅通。
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                variant="outline"
                onClick={() => router.push("/order/query")}
              >
                查询委托
              </Button>
              <Button variant="primary" onClick={() => router.push("/")}>
                返回首页
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-lw-gray">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 页面标题 */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-lw-black">提交委托</h1>
          <p className="mt-2 text-sm text-gray-500">
            填写以下信息，我们将为您提供专业的定制服务
          </p>
        </div>

        {/* 步骤指示器 */}
        <div className="mb-10">
          <StepIndicator
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            labels={STEP_LABELS}
          />
        </div>

        {/* 表单内容 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 步骤 1: 填写联系信息 */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-lw-black mb-1.5">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => updateField("customerName", e.target.value)}
                  placeholder="请输入您的姓名"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-lw-black mb-1.5">
                  手机号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  maxLength={11}
                  value={formData.customerPhone}
                  onChange={(e) =>
                    updateField(
                      "customerPhone",
                      e.target.value.replace(/\D/g, "")
                    )
                  }
                  placeholder="请输入手机号"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-lw-black mb-1.5">
                  邮箱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => updateField("customerEmail", e.target.value)}
                  placeholder="请输入邮箱地址"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                />
              </div>

              {/* 服务类型选择 */}
              {serviceTypes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-lw-black mb-1.5">
                    服务类型
                  </label>
                  <select
                    value={formData.serviceTypeId}
                    onChange={(e) => updateField("serviceTypeId", e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition bg-white"
                  >
                    <option value="">请选择服务类型（可选）</option>
                    {serviceTypes.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                        {st.price_range ? ` (${st.price_range})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 步骤 2: 描述需求 */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-lw-black mb-1.5">
                  定制需求 <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={8}
                  value={formData.requirements}
                  onChange={(e) => updateField("requirements", e.target.value)}
                  placeholder="请详细描述您的定制需求，包括：&#10;- 兽装类型（全套/半套/头套/配件等）&#10;- 角色设定或参考图&#10;- 材质偏好&#10;- 尺寸信息&#10;- 交付时间要求&#10;- 其他特殊要求"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition resize-none"
                />
                <p className="mt-2 text-xs text-gray-400">
                  {formData.requirements.length} 字（至少 10 字）
                </p>
              </div>

              <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-600 flex items-start gap-2">
                  <Upload className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  设计参考图可在估价后通过站内消息发送，或在此描述中注明链接。
                </p>
              </div>
            </div>
          )}

          {/* 步骤 3: 确认信息 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-lw-black mb-4">
                请确认以下信息：
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 py-3 border-b border-gray-50">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">
                    姓名
                  </span>
                  <span className="text-sm text-lw-black">
                    {formData.customerName || "-"}
                  </span>
                </div>
                <div className="flex items-start gap-3 py-3 border-b border-gray-50">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">
                    手机号
                  </span>
                  <span className="text-sm text-lw-black">
                    {formData.customerPhone || "-"}
                  </span>
                </div>
                <div className="flex items-start gap-3 py-3 border-b border-gray-50">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">
                    邮箱
                  </span>
                  <span className="text-sm text-lw-black break-all">
                    {formData.customerEmail || "-"}
                  </span>
                </div>
                {serviceTypes.length > 0 && (
                  <div className="flex items-start gap-3 py-3 border-b border-gray-50">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">
                      服务类型
                    </span>
                    <span className="text-sm text-lw-black">
                      {serviceTypes.find((st) => st.id === formData.serviceTypeId)?.name || "未指定"}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-3 py-3">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">
                    需求描述
                  </span>
                  <span className="text-sm text-lw-black whitespace-pre-wrap flex-1">
                    {formData.requirements || "-"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 导航按钮 */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
            {currentStep > 1 ? (
              <Button variant="outline" onClick={handlePrev} disabled={submitting}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                上一步
              </Button>
            ) : (
              <div />
            )}

            {currentStep < TOTAL_STEPS ? (
              <Button variant="primary" onClick={handleNext}>
                下一步
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    提交中...
                  </>
                ) : (
                  "确认提交"
                )}
              </Button>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
