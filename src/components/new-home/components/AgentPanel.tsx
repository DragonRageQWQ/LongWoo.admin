"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { COPY, type Gt2Lang } from "../copy";
import { useSession } from "@/components/providers/SessionProvider";
import {
  clearAiCharacterDraft,
  loadAiCharacterDraft,
  saveAiCharacterDraft,
} from "@/lib/ai-character-draft";
import AvatarCropModal from "@/components/avatar/AvatarCropModal";
import AgentChatView from "./AgentChatView";

const MAX_LENGTHS = {
  name: 30,
  persona: 2000,
  tone: 50,
  greeting: 300,
  user_nickname: 20,
};

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export default function AgentPanel({ lang }: { lang: Gt2Lang }) {
  const c = COPY[lang].agent;
  const { profile, loading: sessionLoading } = useSession();

  const [view, setView] = useState<"hero" | "form" | "chat">("hero");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [tone, setTone] = useState("");
  const [greeting, setGreeting] = useState("");
  const [userNickname, setUserNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 游客点击"创建角色"后的登录引导提示（草稿已保存）
  const [loginPrompt, setLoginPrompt] = useState(false);
  // 已恢复草稿且等待登录态解析，用于登录后自动回到表单视图
  const [draftPending, setDraftPending] = useState(false);
  // 头像裁切：选图后先进入裁切弹窗（null=未在裁切）
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAvatarRef = useRef<File | null>(null);
  const draftRestoredRef = useRef(false);

  // 挂载时恢复本地草稿（游客登录接力）：回填表单字段；
  // 若已登录（登录跳回场景），等 session 解析完成后自动打开表单视图。
  useEffect(() => {
    if (draftRestoredRef.current) return;
    const draft = loadAiCharacterDraft();
    if (!draft) return;
    draftRestoredRef.current = true;
    // 挂载后从外部存储（localStorage）同步草稿是合法副作用，同 SessionProvider 做法
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(draft.name);
    setPersona(draft.persona);
    setTone(draft.tone);
    setGreeting(draft.greeting);
    setUserNickname(draft.user_nickname);
    setDraftPending(true);
  }, []);

  useEffect(() => {
    if (!draftPending || sessionLoading) return;
    if (profile) {
      // 登录态解析完成后自动回到表单视图（登录回跳场景），属外部状态驱动的同步
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView("form");
      setDraftPending(false);
    }
  }, [draftPending, sessionLoading, profile]);

  // 引导游客去登录（草稿已在点击创建时保存，登录后自动回填）
  const goLogin = useCallback(() => {
    window.location.href = "/login?next=/";
  }, []);

  const handleAvatarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        setError(c.errAvatarLarge);
        return;
      }
      if (!AVATAR_TYPES.includes(file.type)) {
        setError(c.errAvatarFormat);
        return;
      }

      // 先进入裁切弹窗（自由选区 + 缩放），确认后再保存预览
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        setCropSrc(typeof reader.result === "string" ? reader.result : null);
      };
      reader.onerror = () => setError(c.errNetwork);
      reader.readAsDataURL(file);
    },
    [c]
  );

  // 裁切确认：保存裁切后的图片作为待上传头像（角色创建成功后上传）
  const handleCropConfirm = useCallback(async (blob: Blob) => {
    const file = new File([blob], "avatar.jpg", {
      type: blob.type || "image/jpeg",
    });
    pendingAvatarRef.current = file;
    setAvatarUrl(URL.createObjectURL(file));
    setCropSrc(null);
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(c.errName);
      return;
    }
    // session 尚未解析完成时不提交，避免误判为游客
    if (sessionLoading) return;

    // 游客：先把完整草稿存到本地，再提示登录（登录后自动回填，文案不丢失）
    if (!profile) {
      saveAiCharacterDraft({
        name: trimmedName,
        persona: persona.trim(),
        tone: tone.trim(),
        greeting: greeting.trim(),
        user_nickname: userNickname.trim(),
      });
      setLoginPrompt(true);
      return;
    }

    setSaving(true);
    setError(null);
    setLoginPrompt(false);
    try {
      const createRes = await fetch("/api/ai/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          persona: persona.trim(),
          tone: tone.trim(),
          greeting: greeting.trim(),
          user_nickname: userNickname.trim(),
        }),
        credentials: "include",
      });
      const createData = await createRes.json();

      if (createRes.status === 401) {
        // 会话过期等边界情况：同样先存草稿再引导登录
        saveAiCharacterDraft({
          name: trimmedName,
          persona: persona.trim(),
          tone: tone.trim(),
          greeting: greeting.trim(),
          user_nickname: userNickname.trim(),
        });
        setLoginPrompt(true);
        setSaving(false);
        return;
      }
      if (!createData.success) {
        setError(createData.error || c.errCreate);
        setSaving(false);
        return;
      }

      // 创建成功：清除本地草稿
      clearAiCharacterDraft();
      setDraftPending(false);

      const newId = createData.character.id as string;

      if (avatarUrl && avatarUrl.startsWith("blob:") && pendingAvatarRef.current) {
        const formData = new FormData();
        formData.append("file", pendingAvatarRef.current);
        await fetch(`/api/ai/characters/${newId}/avatar`, {
          method: "POST",
          body: formData,
          credentials: "include",
        }).catch(() => undefined);
      }

      // 内嵌流畅流程：创建成功后直接进入聊天并聚焦新角色，不再跳转生产页
      setCreatedId(newId);
      setView("chat");
      // 修复：创建成功路径必须重置 saving，否则再次进入创建表单时
      // 按钮残留 loading 状态且 disabled（组件不卸载，state 持久保留）
      setSaving(false);
      setName("");
      setPersona("");
      setTone("");
      setGreeting("");
      setUserNickname("");
      setAvatarUrl(null);
      pendingAvatarRef.current = null;
    } catch {
      setError(c.errNetwork);
      setSaving(false);
    }
  }, [name, persona, tone, greeting, userNickname, avatarUrl, profile, sessionLoading, c]);

  return (
    <div className="gt2-agent-stage">
      <span className="gt2-watermark" aria-hidden="true">01</span>

      {/* 门面视图 */}
      <div className="gt2-agent-view" data-current={view === "hero"} data-dir={view === "form" ? "hero" : undefined} inert={view !== "hero" ? true : undefined}>
        <div className="gt2-agent-hero">
          <div className="gt2-rise" style={{ "--i": 1 } as React.CSSProperties}>
            <p className="gt2-kicker">{c.kicker}</p>
          </div>
          <h2 className="gt2-display gt2-rise" style={{ "--i": 2 } as React.CSSProperties}>
            {c.heroTitle}
          </h2>
          <p className="gt2-display-sub gt2-rise" style={{ "--i": 3 } as React.CSSProperties}>
            {c.heroTitleEn}
          </p>
          <div className="gt2-agent-hero-lines gt2-rise" style={{ "--i": 4 } as React.CSSProperties}>
            {c.heroLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="gt2-agent-hero-cta gt2-rise" style={{ "--i": 5 } as React.CSSProperties}>
            <button type="button" className="gt2-btn-ghost" onClick={() => setView("chat")}>
              {c.chatMy}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button type="button" className="gt2-btn-solid" onClick={() => setView("form")}>
              {c.uploadBtn}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5" />
                <path d="M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 创建表单视图 */}
      <div className="gt2-agent-view" data-current={view === "form"} data-dir={view === "hero" ? "form" : undefined} inert={view !== "form" ? true : undefined}>
        <div className="gt2-agent-form">
          <div className="gt2-section-label">
            <b>{c.formTitle}</b>
            <span>{c.formTitleEn}</span>
          </div>

          <div className="gt2-agent-avatar">
            <button
              type="button"
              className="gt2-agent-avatar-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="avatar" />
              ) : (
                <span>{name.trim() ? name.charAt(0) : "＋"}</span>
              )}
              <span className="gt2-avatar-mask">{c.changeAvatar}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p>{c.avatarHint}</p>
          </div>

          <div className="gt2-field">
            <label className="gt2-field-label">
              {c.nameLabel} *
              <span className="gt2-field-count">{name.length}/{MAX_LENGTHS.name}</span>
            </label>
            <input
              className="gt2-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={c.namePh}
              maxLength={MAX_LENGTHS.name}
            />
          </div>

          <div className="gt2-field">
            <label className="gt2-field-label">
              {c.nicknameLabel}
              <span className="gt2-field-count">{userNickname.length}/{MAX_LENGTHS.user_nickname}</span>
            </label>
            <input
              className="gt2-input"
              value={userNickname}
              onChange={(e) => setUserNickname(e.target.value)}
              placeholder={c.nicknamePh}
              maxLength={MAX_LENGTHS.user_nickname}
            />
          </div>

          <div className="gt2-field">
            <label className="gt2-field-label">
              {c.personaLabel}
              <span className="gt2-field-count">{persona.length}/{MAX_LENGTHS.persona}</span>
            </label>
            <textarea
              className="gt2-input"
              rows={5}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder={c.personaPh}
              maxLength={MAX_LENGTHS.persona}
            />
          </div>

          <div className="gt2-field">
            <label className="gt2-field-label">
              {c.toneLabel}
              <span className="gt2-field-count">{tone.length}/{MAX_LENGTHS.tone}</span>
            </label>
            <div className="gt2-tone-row">
              {c.tonePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="gt2-tone-chip"
                  data-on={tone === preset}
                  onClick={() => setTone(tone === preset ? "" : preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              className="gt2-input"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder={c.tonePh}
              maxLength={MAX_LENGTHS.tone}
            />
          </div>

          <div className="gt2-field">
            <label className="gt2-field-label">
              {c.greetingLabel}
              <span className="gt2-field-count">{greeting.length}/{MAX_LENGTHS.greeting}</span>
            </label>
            <input
              className="gt2-input"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder={c.greetingPh}
              maxLength={MAX_LENGTHS.greeting}
            />
          </div>

          {error && <div className="gt2-form-error">{error}</div>}

          {loginPrompt && (
            <div className="gt2-login-prompt">
              <p>{c.loginPromptText}</p>
              <div className="gt2-login-prompt-actions">
                <button type="button" className="gt2-btn-ghost" onClick={() => setLoginPrompt(false)}>
                  {c.keepEdit}
                </button>
                <button type="button" className="gt2-btn-solid" onClick={goLogin}>
                  {c.goLogin}
                </button>
              </div>
            </div>
          )}

          <div className="gt2-form-actions">
            <button type="button" className="gt2-btn-ghost" onClick={() => setView("hero")} disabled={saving}>
              {c.backBtn}
            </button>
            <button type="button" className="gt2-btn-solid" onClick={handleCreate} disabled={saving || !name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {c.creating}
                </>
              ) : (
                c.createBtn
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 内嵌聊天视图：角色切换 + 对话全流程 */}
      <div className="gt2-agent-view gt2-agent-view--chat" data-current={view === "chat"} data-dir={view === "form" ? "chat" : undefined} inert={view !== "chat" ? true : undefined}>
        <AgentChatView lang={lang} onNew={() => setView("form")} onBack={() => setView("hero")} targetId={createdId} />
      </div>

      {/* 头像裁切弹窗：选图后自由选区 + 缩放 */}
      <AvatarCropModal
        open={Boolean(cropSrc)}
        imageSrc={cropSrc}
        onCancel={() => setCropSrc(null)}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
