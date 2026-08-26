"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COPY, GT2_REMARK_KEY, type Gt2Lang } from "../copy";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const COMPRESS_TARGET_BYTES = 4 * 1024 * 1024;

const DIM_KEYS: Record<string, string> = {
  height: "longwoo_body_height",
  chest: "longwoo_body_chest",
  shoe: "longwoo_shoe_size",
  waist: "longwoo_body_waist",
};

type DimState = { height: string; chest: string; shoe: string; waist: string };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

export default function FursuitPanel({ lang }: { lang: Gt2Lang }) {
  const c = COPY[lang].fursuit;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageSize, setImageSize] = useState("");
  const [dims, setDims] = useState<DimState>({ height: "", chest: "", shoe: "", waist: "" });
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const img = sessionStorage.getItem("longwoo_design_ref_image");
      if (img) {
        setImageData(img);
        setImageName(sessionStorage.getItem("longwoo_design_ref_name") || "");
        setImageSize(sessionStorage.getItem("longwoo_design_ref_size") || "");
      }
      setRemark(sessionStorage.getItem(GT2_REMARK_KEY) || "");
      setDims({
        height: sessionStorage.getItem(DIM_KEYS.height) || "",
        chest: sessionStorage.getItem(DIM_KEYS.chest) || "",
        shoe: sessionStorage.getItem(DIM_KEYS.shoe) || "",
        waist: sessionStorage.getItem(DIM_KEYS.waist) || "",
      });
    } catch {
      /* ignore */
    }
  }, []);

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
    try {
      sessionStorage.removeItem("longwoo_design_ref_image");
      sessionStorage.removeItem("longwoo_design_ref_name");
      sessionStorage.removeItem("longwoo_design_ref_size");
    } catch {
      /* ignore */
    }
  }, []);

  const handleDimChange = useCallback((key: keyof DimState, value: string) => {
    const filtered = value.replace(/[^\d.]/g, "");
    setDims((prev) => ({ ...prev, [key]: filtered }));
    try {
      sessionStorage.setItem(DIM_KEYS[key], filtered);
    } catch {
      /* ignore */
    }
  }, []);

  const handleRemarkChange = useCallback((value: string) => {
    setRemark(value);
    try {
      sessionStorage.setItem(GT2_REMARK_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!imageData) {
      setError(c.errImgRequired);
      return;
    }
    window.location.href = "/order-step1.html";
  }, [imageData, c]);

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
          <p className="gt2-display-sub">{c.titleEn}</p>
        </div>

        <div style={{ height: 44 }} className="gt2-stagger" />

        {/* 设定图上传 */}
        <div className="gt2-stagger" style={{ "--i": 2 } as React.CSSProperties}>
          <div
            className="gt2-upload-zone"
            data-uploaded={!!imageData}
            onClick={() => {
              if (!imageData) fileInputRef.current?.click();
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !imageData) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            {!imageData ? (
              <div className="gt2-upload-placeholder">
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        <div style={{ height: 34 }} className="gt2-stagger" />

        {/* 选配 */}
        <div className="gt2-stagger" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="gt2-addon-row">
            {c.addons.map((addon) => (
              <button
                key={addon.name}
                type="button"
                className="gt2-addon-btn"
                onClick={() => {
                  window.location.href = "/order-step2.html";
                }}
              >
                <span className="gt2-addon-micro">{c.addonMicro}</span>
                <span className="gt2-addon-name">
                  {addon.name}
                  <small>{addon.nameEn}</small>
                </span>
                <span className="gt2-addon-price">{addon.price}</span>
              </button>
            ))}
          </div>
          <p className="gt2-form-hint">{c.addonHint}</p>
        </div>

        <div style={{ height: 34 }} className="gt2-stagger" />

        {/* 尺寸 2×2 */}
        <div className="gt2-stagger" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="gt2-dim-grid">
            {c.dims.map((dim) => (
              <div key={dim.key} className="gt2-dim-field">
                <span className="gt2-dim-label">{dim.label}</span>
                <div className="gt2-dim-input">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={dims[dim.key]}
                    onChange={(e) => handleDimChange(dim.key, e.target.value)}
                    aria-label={dim.label}
                  />
                  <span className="gt2-dim-unit">{dim.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 34 }} className="gt2-stagger" />

        {/* 备注 */}
        <div className="gt2-stagger" style={{ "--i": 5 } as React.CSSProperties}>
          <textarea
            className="gt2-input gt2-remark"
            value={remark}
            onChange={(e) => handleRemarkChange(e.target.value)}
            placeholder={c.remarkPh}
            maxLength={500}
          />
        </div>

        {/* 提交 */}
        <div className="gt2-submit-block gt2-stagger" style={{ "--i": 6 } as React.CSSProperties}>
          {error && <div className="gt2-form-error">{error}</div>}
          <button
            type="button"
            className="gt2-submit-btn"
            onClick={handleSubmit}
            disabled={!imageData}
          >
            {c.submitBtn}
          </button>
          <p className="gt2-submit-hint">{c.submitHint}</p>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
