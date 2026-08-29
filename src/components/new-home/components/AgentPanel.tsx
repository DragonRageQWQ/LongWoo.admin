"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { COPY, type Gt2Lang } from "../copy";
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAvatarRef = useRef<File | null>(null);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      setError(null);
      pendingAvatarRef.current = file;
      setAvatarUrl(URL.createObjectURL(file));
    },
    [c]
  );

  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(c.errName);
      return;
    }

    setSaving(true);
    setError(null);
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
        setError(c.loginHint);
        setSaving(false);
        return;
      }
      if (!createData.success) {
        setError(createData.error || c.errCreate);
        setSaving(false);
        return;
      }

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
  }, [name, persona, tone, greeting, userNickname, avatarUrl, c]);

  return (
    <div className="gt2-agent-stage">
      <span className="gt2-watermark" aria-hidden="true">01</span>

      {/* 门面视图 */}
      <div className="gt2-agent-view" data-current={view === "hero"} data-dir={view === "form" ? "hero" : undefined} inert={view !== "hero" ? true : undefined}>
        <div className="gt2-agent-hero">
          <div className="gt2-rise" style={{ "--i": 1 } as React.CSSProperties}>
            <p className="gt2-kicker">{c.kicker}</p>
          </div>
          <h1 className="gt2-display gt2-rise" style={{ "--i": 2 } as React.CSSProperties}>
            {c.heroTitle}
          </h1>
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
    </div>
  );
}
