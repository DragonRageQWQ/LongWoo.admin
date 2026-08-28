"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COPY, type Gt2Lang } from "../copy";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const COMPRESS_TARGET_BYTES = 4 * 1024 * 1024;
const BASE_PRICE = 18000;

const DIM_KEYS: Record<string, string> = {
  height: "longwoo_body_height",
  weight: "longwoo_body_weight",
  chest: "longwoo_body_chest",
  waist: "longwoo_body_waist",
  hip: "longwoo_body_hip",
  shoe: "longwoo_shoe_size",
};

type DimKey = "height" | "weight" | "chest" | "waist" | "hip" | "shoe";
type DimState = Record<DimKey, string>;

const EMPTY_DIMS: DimState = { height: "", weight: "", chest: "", waist: "", hip: "", shoe: "" };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// 读取图片真实宽高比，供上传框按比例自适应高度
function measureImageRatio(dataUrl: string, onRatio: (ratio: number) => void) {
  const img = new Image();
  img.onload = () => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      onRatio(img.naturalWidth / img.naturalHeight);
    }
  };
  img.src = dataUrl;
}

function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const MAX_EDGE = 1920;
        let w = img.width;
        let h = img.height;
        if (w > MAX_EDGE || h > MAX_EDGE) {
          const scale = Math.min(MAX_EDGE / w, MAX_EDGE / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.85;
        let out = canvas.toDataURL("image/jpeg", quality);
        let estBytes = Math.floor((out.length * 3) / 4);
        while (estBytes > COMPRESS_TARGET_BYTES && quality > 0.45) {
          quality -= 0.1;
          out = canvas.toDataURL("image/jpeg", quality);
          estBytes = Math.floor((out.length * 3) / 4);
        }
        resolve(out);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * 内嵌委托兽装向导（Fursuit Commission）
 * 将旧官网 5 步静态流程（上传设定图→选配→折抵→联系→等待估价）整体内嵌到新首页：
 * - 全部复用生产 API：POST /api/order/create + POST /api/order/upload-attachment
 * - 落库 requirements 格式与官网静态页完全一致，管理后台订单详情可直接阅读
 * - 选配/折抵/身体数据/订单号同步写入 sessionStorage（与官网键名一致）
 */
export default function FursuitPanel({ lang }: { lang: Gt2Lang }) {
  const c = COPY[lang].fursuit;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);

  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageSize, setImageSize] = useState("");
  const [imageRatio, setImageRatio] = useState<number | null>(null);

  // 选配（多选）：key = addon.name；"无" 用 "__none__" 表示
  const [addonSel, setAddonSel] = useState<Record<string, boolean>>({});
  // 折抵权益（单选）：选中 benefit.value
  const [benefitValue, setBenefitValue] = useState(0);

  const [dims, setDims] = useState<DimState>(EMPTY_DIMS);
  const [social, setSocial] = useState("");
  const [contact, setContact] = useState({ name: "", email: "" });

  const [error, setError] = useState<string | null>(null);
  // 第四步必填字段错误提示（key: name / email / height / weight）
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 从 sessionStorage 恢复已填信息（与官网静态流程键名一致）
  useEffect(() => {
    try {
      const img = sessionStorage.getItem("longwoo_design_ref_image");
      if (img) {
        setImageData(img);
        setImageName(sessionStorage.getItem("longwoo_design_ref_name") || "");
        setImageSize(sessionStorage.getItem("longwoo_design_ref_size") || "");
        measureImageRatio(img, setImageRatio);
      }
      const d: DimState = { ...EMPTY_DIMS };
      (Object.keys(DIM_KEYS) as DimKey[]).forEach((k) => {
        d[k] = sessionStorage.getItem(DIM_KEYS[k]) || "";
      });
      setDims(d);
      setSocial(sessionStorage.getItem("longwoo_social_account") || "");
      const savedAddon = sessionStorage.getItem("longwoo_step2_addon");
      if (savedAddon && savedAddon !== "无") {
        // 用价格字符串匹配，避免中英文切换导致选择丢失
        const items = savedAddon.split("、");
        const sel: Record<string, boolean> = {};
        c.addons.forEach((a) => {
          if (!a.disabled) sel[a.name] = items.some((t) => t.includes(a.price));
        });
        setAddonSel(sel);
      } else {
        // 默认选中"无"（与官网一致）
        setAddonSel({ __none__: true });
      }
      const savedBenefit = sessionStorage.getItem("longwoo_step3_benefit_amount");
      if (savedBenefit) {
        const v = parseInt(savedBenefit, 10);
        if (!isNaN(v) && v > 0) setBenefitValue(v);
      }
    } catch {
      /* ignore */
    }
  }, [c.addons]);

  // 选配合计
  const addonTotal = useMemo(() => {
    let total = 0;
    c.addons.forEach((a) => {
      if (!a.disabled && addonSel[a.name]) total += a.value;
    });
    return total;
  }, [addonSel, c.addons]);

  // 折抵金额
  const discount = benefitValue;

  // 同步选配/折抵到 sessionStorage（与官网一致，查询与后台展示兼容）
  useEffect(() => {
    try {
      const list = c.addons.filter((a) => !a.disabled && addonSel[a.name]);
      const value = list.length ? list.map((a) => `${a.name}（${a.price}）`).join("、") : "无";
      sessionStorage.setItem("longwoo_step2_addon", value);
      sessionStorage.setItem("longwoo_step2_addon_amount", String(addonTotal));
    } catch {
      /* ignore */
    }
  }, [addonSel, addonTotal, c.addons]);

  useEffect(() => {
    try {
      const benefit = c.benefits.find((b) => b.value === benefitValue);
      sessionStorage.setItem(
        "longwoo_step3_benefit",
        benefit ? `${benefit.label}（${benefit.price}）` : ""
      );
      sessionStorage.setItem("longwoo_step3_benefit_amount", String(benefitValue));
    } catch {
      /* ignore */
    }
  }, [benefitValue, c.benefits]);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      if (!IMAGE_TYPES.includes(file.type)) {
        setError(c.errImgType);
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(c.errImgLarge);
        return;
      }

      setError(null);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        let dataUrl = ev.target?.result as string;
        const estBytes = Math.floor((dataUrl.length * 3) / 4);
        if (estBytes > COMPRESS_TARGET_BYTES) {
          dataUrl = await compressImage(dataUrl);
        }
        const sizeText = formatSize(file.size);
        setImageData(dataUrl);
        setImageName(file.name);
        setImageSize(sizeText);
        measureImageRatio(dataUrl, setImageRatio);
        try {
          sessionStorage.setItem("longwoo_design_ref_image", dataUrl);
          sessionStorage.setItem("longwoo_design_ref_name", file.name);
          sessionStorage.setItem("longwoo_design_ref_size", sizeText);
        } catch {
          /* ignore */
        }
      };
      reader.readAsDataURL(file);
    },
    [c]
  );

  const handleRemove = useCallback(() => {
    setImageData(null);
    setImageName("");
    setImageSize("");
    setImageRatio(null);
    try {
      sessionStorage.removeItem("longwoo_design_ref_image");
      sessionStorage.removeItem("longwoo_design_ref_name");
      sessionStorage.removeItem("longwoo_design_ref_size");
    } catch {
      /* ignore */
    }
  }, []);

  const handleDimChange = useCallback((key: DimKey, value: string) => {
    const filtered = value.replace(/[^\d.]/g, "");
    setDims((prev) => ({ ...prev, [key]: filtered }));
    try {
      sessionStorage.setItem(DIM_KEYS[key], filtered);
    } catch {
      /* ignore */
    }
  }, []);

  const handleSocialChange = useCallback((value: string) => {
    setSocial(value);
    try {
      sessionStorage.setItem("longwoo_social_account", value);
    } catch {
      /* ignore */
    }
  }, []);

  // ===== 选配逻辑（与官网一致："无"互斥） =====
  const toggleAddon = useCallback((name: string) => {
    setAddonSel((prev) => {
      const next = { ...prev };
      if (next[name]) {
        delete next[name];
      } else {
        next[name] = true;
        // 选具体项时取消"无"
        delete next.__none__;
      }
      return next;
    });
  }, []);

  const selectNone = useCallback(() => {
    setAddonSel({ __none__: true });
  }, []);

  // ===== 步骤导航 =====
  const goTo = useCallback(
    (target: number) => {
      if (target < 1 || target > 5) return;
      if (target > maxStep) return;
      setError(null);
      setStep(target);
    },
    [maxStep]
  );

  const clearFieldError = useCallback((k: string) => {
    setFieldErrors((p) => {
      if (!p[k]) return p;
      const n = { ...p };
      delete n[k];
      return n;
    });
  }, []);

  // 第四步必填校验：姓名 / 邮箱 / 身高 / 体重
  const validateStep4 = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!contact.name.trim()) errs.name = c.errName;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) errs.email = c.errEmail;
    if (!dims.height.trim()) errs.height = c.errDimRequired;
    if (!dims.weight.trim()) errs.weight = c.errDimRequired;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [contact, dims, c]);

  const goNext = useCallback(() => {
    setError(null);
    if (step === 1 && !imageData) {
      setError(c.errImgRequired);
      return;
    }
    if (step === 4 && !validateStep4()) {
      return;
    }
    const next = Math.min(step + 1, 5);
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
  }, [step, imageData, validateStep4, c]);

  // ===== 需求描述拼接（与官网静态页 buildRequirements 完全一致） =====
  const buildRequirements = useCallback(() => {
    const get = (k: string) => {
      try {
        return sessionStorage.getItem(k) || "";
      } catch {
        return "";
      }
    };
    const lines: string[] = [];
    lines.push("【下单来源】自设兽装购买流程（新首页内嵌下单）");
    const designRefName = get("longwoo_design_ref_name");
    const addonOption = get("longwoo_step2_addon");
    const benefitOption = get("longwoo_step3_benefit");
    const addonAmount = parseInt(get("longwoo_step2_addon_amount") || "0", 10) || 0;
    const benefitAmount = parseInt(get("longwoo_step3_benefit_amount") || "0", 10) || 0;
    if (designRefName) lines.push("【设定图】" + designRefName);
    if (addonOption) lines.push("【选配内容】" + addonOption);
    if (benefitOption) lines.push("【折抵权益】" + benefitOption);
    const priceLines: string[] = [];
    priceLines.push(`基础价格 RMB ${BASE_PRICE.toLocaleString("en-US")}`);
    priceLines.push(`附加选项 RMB ${addonAmount.toLocaleString("en-US")}`);
    priceLines.push(`折抵 RMB -${benefitAmount.toLocaleString("en-US")}`);
    priceLines.push(
      `合计 RMB ${(BASE_PRICE + addonAmount - benefitAmount).toLocaleString("en-US")}`
    );
    lines.push("【价格明细】" + priceLines.join("，"));
    const body: string[] = [];
    const bh = get("longwoo_body_height");
    if (bh) body.push("身高" + bh + "CM");
    const bw = get("longwoo_body_weight");
    if (bw) body.push("体重" + bw + "KG");
    const bc = get("longwoo_body_chest");
    if (bc) body.push("胸围" + bc + "CM");
    const bwa = get("longwoo_body_waist");
    if (bwa) body.push("腰围" + bwa + "CM");
    const bhi = get("longwoo_body_hip");
    if (bhi) body.push("臀围" + bhi + "CM");
    const ss = get("longwoo_shoe_size");
    if (ss) body.push("鞋码" + ss);
    if (body.length) lines.push("【身体数据】" + body.join("，"));
    const sa = get("longwoo_social_account");
    if (sa) lines.push("【社交账号】" + sa);
    return lines.join("\n");
  }, []);

  // ===== 提交：创建订单 → 上传设定图 → 进入等待估价 =====
  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setError(null);
    if (!validateStep4()) {
      setStep(4);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: contact.name.trim(),
          customerEmail: contact.email.trim(),
          requirements: buildRequirements(),
        }),
      });
      const result = await res.json();

      if (!result.success || !result.orderNo) {
        setError(result.error || c.errSubmit);
        setSubmitting(false);
        return;
      }

      try {
        sessionStorage.setItem("longwoo_order_no", result.orderNo);
      } catch {
        /* ignore */
      }

      // 上传设定图（失败不阻断流程，与官网一致：明确告知但继续）
      if (result.orderId && result.uploadToken && imageData) {
        try {
          const upRes = await fetch("/api/order/upload-attachment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: result.orderId,
              uploadToken: result.uploadToken,
              fileName: imageName,
              dataUrl: imageData,
            }),
          });
          const upResult = await upRes.json().catch(() => ({ success: false }));
          if (!upRes.ok || !upResult.success) {
            const msg = upResult?.error || "图片过大或格式不支持";
            alert(c.errUploadAlert.replace("{msg}", msg));
          }
        } catch {
          alert(c.errUploadAlert.replace("{msg}", "网络异常"));
        }
      }

      setOrderNo(result.orderNo);
      setStep(5);
      setMaxStep(5);
    } catch {
      setError(c.errNetwork);
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, contact, imageData, imageName, buildRequirements, validateStep4, c]);

  const handleCopy = useCallback(async () => {
    if (!orderNo) return;
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    };
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(orderNo);
        done();
      } else {
        const ta = document.createElement("textarea");
        ta.value = orderNo;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      }
    } catch {
      done();
    }
  }, [orderNo]);

  // 步骤状态：done / active / todo
  const stepState = (i: number): "done" | "active" | "todo" => {
    if (i === step) return "active";
    if (i < step) return "done";
    return "todo";
  };

  const total = BASE_PRICE + addonTotal - discount;

  return (
    <div className="gt2-stage">
      <span className="gt2-watermark" aria-hidden="true">02</span>
      <div className="gt2-stage-scroll">
        <div className="gt2-panel-inner">
          <div className="gt2-fursuit">
            <div className="gt2-stagger" style={{ "--i": 0 } as React.CSSProperties}>
              <p className="gt2-kicker">{c.kicker}</p>
            </div>
            <div className="gt2-stagger" style={{ "--i": 1 } as React.CSSProperties}>
              <h1 className="gt2-display">{c.title}</h1>
              <p className="gt2-display-sub">
                {c.titleEn}
                <span className="gt2-fs-meta">
                  {c.deliveryHint} · {c.priceRangeHint}
                </span>
              </p>
            </div>

            {/* 步骤指示条 */}
            <div className="gt2-fs-stepbar" style={{ "--i": 2 } as React.CSSProperties}>
              {c.steps.map((label, i) => {
                const idx = i + 1;
                return (
                  <div
                    key={label}
                    className="gt2-fs-step-seg"
                    data-done={i > 0 && idx <= maxStep}
                    onClick={() => goTo(idx)}
                  >
                    <div className="gt2-fs-step-item" data-state={stepState(idx)} data-reached={idx <= maxStep}>
                      <div className="gt2-fs-step-dot">
                        {idx < step ? <CheckIcon /> : idx}
                      </div>
                      <span className="gt2-fs-step-label">{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 当前步骤内容 */}
            <div key={step} className="gt2-fs-step-view" style={{ "--i": 3 } as React.CSSProperties}>
              {/* 第 1 步：上传设定图 */}
              {step === 1 && (
                <>
                  <div
                    className="gt2-upload-zone"
                    data-uploaded={!!imageData}
                    style={imageRatio ? { aspectRatio: String(imageRatio) } : undefined}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFile}
                      className="hidden"
                    />
                    {!imageData ? (
                      <div
                        className="gt2-upload-placeholder"
                        role="button"
                        tabIndex={0}
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="3" width="18" height="18" rx="4" />
                          <circle cx="8.8" cy="8.8" r="1.6" />
                          <path d="M21 15.5l-4.2-4.2a1.6 1.6 0 0 0-2.3 0L7 18.8" />
                        </svg>
                        <div className="gt2-upload-title">{c.uploadTitle}</div>
                        <div className="gt2-upload-hint">{c.uploadHint}</div>
                      </div>
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="gt2-upload-preview-img" src={imageData} alt={imageName} />
                        <div className="gt2-upload-bar">
                          <div className="gt2-upload-bar-info">
                            <div className="gt2-upload-bar-name">{imageName}</div>
                            <div className="gt2-upload-bar-size">{imageSize}</div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                          >
                            {c.reupload}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove();
                            }}
                          >
                            {c.remove}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* 第 2 步：选配内容（多选） */}
              {step === 2 && (
                <>
                  <div className="gt2-fs-section-head">
                    <b>{c.steps[1]}</b>
                    <span className="gt2-fs-multi-hint">{c.addonHint}</span>
                  </div>
                  <div className="gt2-fs-opt-list">
                    <div
                      className="gt2-fs-opt"
                      data-on={!!addonSel.__none__}
                      data-box="square"
                      onClick={selectNone}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectNone();
                        }
                      }}
                    >
                      <div className="gt2-fs-opt-box">
                        <CheckIcon />
                      </div>
                      <div className="gt2-fs-opt-main">
                        <span className="gt2-fs-opt-name">{c.addonNone}</span>
                      </div>
                    </div>
                    {c.addons.map((addon) => (
                      <div
                        key={addon.name}
                        className="gt2-fs-opt"
                        data-on={!!addonSel[addon.name]}
                        data-disabled={addon.disabled}
                        data-box="square"
                        onClick={() => !addon.disabled && toggleAddon(addon.name)}
                        role="button"
                        tabIndex={addon.disabled ? -1 : 0}
                        onKeyDown={(e) => {
                          if (!addon.disabled && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            toggleAddon(addon.name);
                          }
                        }}
                      >
                        <div className="gt2-fs-opt-box">
                          <CheckIcon />
                        </div>
                        <div className="gt2-fs-opt-main">
                          <span className="gt2-fs-opt-name">{addon.name}</span>
                          <span className="gt2-fs-opt-sub">{addon.nameEn}</span>
                        </div>
                        {addon.disabled && addon.tag ? (
                          <span className="gt2-fs-opt-tag">{addon.tag}</span>
                        ) : (
                          <span className="gt2-fs-opt-price">{addon.price}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 第 3 步：折抵权益（单选） */}
              {step === 3 && (
                <>
                  <div className="gt2-fs-section-head">
                    <b>{c.benefitTitle}</b>
                  </div>
                  <div className="gt2-fs-opt-list">
                    {c.benefits.map((b) => (
                      <div
                        key={b.value}
                        className="gt2-fs-opt"
                        data-on={benefitValue === b.value}
                        onClick={() => setBenefitValue(b.value)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setBenefitValue(b.value);
                          }
                        }}
                      >
                        <div className="gt2-fs-opt-box">
                          <span className="gt2-fs-opt-dot" />
                        </div>
                        <div className="gt2-fs-opt-main">
                          <span className="gt2-fs-opt-name">{b.label}</span>
                          <span className="gt2-fs-opt-sub">{b.labelEn}</span>
                        </div>
                        <span className="gt2-fs-opt-price" data-benefit={b.value > 0}>
                          {b.price}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="gt2-fs-note">{c.benefitNote}</p>
                </>
              )}

              {/* 第 4 步：联系方式 + 身体数据 */}
              {step === 4 && (
                <>
                  <div className="gt2-fs-section-head">
                    <b>{c.contactTitle}</b>
                  </div>
                  <div className="gt2-fs-grid">
                    <div
                      className="gt2-fs-field gt2-fs-field--wide"
                      data-error={!!fieldErrors.name || undefined}
                      data-valid={!fieldErrors.name && contact.name.trim() ? true : undefined}
                    >
                      <label>
                        {c.nameLabel} <em>*</em>
                      </label>
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) => {
                          setContact((p) => ({ ...p, name: e.target.value }));
                          clearFieldError("name");
                        }}
                        placeholder={c.namePh}
                        maxLength={50}
                        autoComplete="name"
                      />
                      {fieldErrors.name && <p className="gt2-fs-field-err">{fieldErrors.name}</p>}
                    </div>
                    <div
                      className="gt2-fs-field gt2-fs-field--full"
                      data-error={!!fieldErrors.email || undefined}
                      data-valid={
                        !fieldErrors.email &&
                        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())
                          ? true
                          : undefined
                      }
                    >
                      <label>
                        {c.emailLabel} <em>*</em>
                      </label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => {
                          setContact((p) => ({ ...p, email: e.target.value }));
                          clearFieldError("email");
                        }}
                        placeholder={c.emailPh}
                        autoComplete="email"
                      />
                      {fieldErrors.email && <p className="gt2-fs-field-err">{fieldErrors.email}</p>}
                    </div>
                  </div>

                  <div className="gt2-fs-sub-block">
                    <div className="gt2-fs-sub-head">
                      <b>{c.bodyTitle}</b>
                      <span>{c.bodyHint}</span>
                    </div>
                    <div className="gt2-dim-grid">
                      {c.dims.map((dim) => {
                        const required = dim.key === "height" || dim.key === "weight";
                        return (
                          <div
                            key={dim.key}
                            className="gt2-dim-field"
                            data-error={!!fieldErrors[dim.key] || undefined}
                            data-valid={
                              !fieldErrors[dim.key] && dims[dim.key].trim() ? true : undefined
                            }
                          >
                            <span className="gt2-dim-label">
                              {dim.label}
                              {required && <em>*</em>}
                            </span>
                            <div className="gt2-dim-input">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={dims[dim.key]}
                                onChange={(e) => {
                                  handleDimChange(dim.key, e.target.value);
                                  clearFieldError(dim.key);
                                }}
                                aria-label={dim.label}
                              />
                              {dim.unit && <span className="gt2-dim-unit">{dim.unit}</span>}
                            </div>
                            {fieldErrors[dim.key] && (
                              <p className="gt2-dim-err">{fieldErrors[dim.key]}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="gt2-fs-field gt2-fs-field--full gt2-fs-social">
                    <label>{c.socialLabel}</label>
                    <textarea
                      value={social}
                      onChange={(e) => handleSocialChange(e.target.value)}
                      placeholder={c.socialPh}
                      rows={2}
                      maxLength={200}
                    />
                  </div>
                </>
              )}

              {/* 第 5 步：等待估价（提交成功） */}
              {step === 5 && (
                <div className="gt2-fs-done">
                  <div className="gt2-fs-done-check">
                    <CheckIcon />
                  </div>
                  <h2 className="gt2-fs-done-title">{c.doneTitle}</h2>
                  <p className="gt2-fs-done-text">{c.doneText}</p>
                  <div className="gt2-fs-done-code">
                    {c.orderCodePrefix}
                    <b>{orderNo ?? "——"}</b>
                  </div>
                  <div className="gt2-fs-done-actions">
                    <button type="button" className="gt2-btn-ghost" onClick={handleCopy} data-copied={copied}>
                      {copied ? c.copied : c.copyBtn}
                    </button>
                    <a
                      className="gt2-btn-solid gt2-fs-query"
                      href={`/gray-test/test2?tab=check&no=${encodeURIComponent(orderNo ?? "")}&email=${encodeURIComponent(contact.email.trim())}`}
                    >
                      {c.queryLink}
                    </a>
                  </div>
                  <p className="gt2-fs-done-tip">{c.saveTip}</p>
                </div>
              )}

              {/* 错误提示 */}
              {error && <div className="gt2-form-error">{error}</div>}

              {/* 价格摘要（步骤 2-4 常驻） */}
              {step >= 2 && step <= 4 && (
                <div className="gt2-fs-price">
                  <div className="gt2-fs-price-row">
                    <span>{c.priceBase}</span>
                    <b>RMB {BASE_PRICE.toLocaleString("en-US")}</b>
                  </div>
                  <div className="gt2-fs-price-row">
                    <span>{c.priceAddon}</span>
                    <b>RMB {addonTotal.toLocaleString("en-US")}</b>
                  </div>
                  <div className="gt2-fs-price-row">
                    <span>{c.priceDiscount}</span>
                    <b data-discount={discount > 0}>
                      {discount > 0 ? `- RMB ${discount.toLocaleString("en-US")}` : "RMB 0"}
                    </b>
                  </div>
                  <div className="gt2-fs-price-row gt2-fs-price-total">
                    <span>{c.priceTotal}</span>
                    <b>RMB {total.toLocaleString("en-US")}</b>
                  </div>
                </div>
              )}
            </div>

            {/* 步骤导航 */}
            {step < 5 && (
              <div className="gt2-fs-nav" style={{ "--i": 4 } as React.CSSProperties}>
                {step > 1 && (
                  <button type="button" className="gt2-btn-ghost" onClick={() => goTo(step - 1)}>
                    {c.btnPrev}
                  </button>
                )}
                {step === 4 ? (
                  <button
                    type="button"
                    className="gt2-btn-solid"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? c.submitting : c.submitBtn}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="gt2-btn-solid"
                    onClick={goNext}
                    disabled={step === 1 && !imageData}
                  >
                    {c.btnNext}
                  </button>
                )}
              </div>
            )}

            {step < 5 && (
              <p className="gt2-submit-hint gt2-fs-foot-hint" style={{ "--i": 5 } as React.CSSProperties}>
                {c.submitHint}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
