"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AiCharacter } from "@/types/database";
import { COPY, type Gt2Lang } from "../copy";

const MAX_LENGTHS = {
  name: 30,
  persona: 2000,
  tone: 50,
  greeting: 300,
  user_nickname: 20,
};

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/**
 * 龙灵工坊 · 内嵌编辑角色视图
 * 复用生产 API：PATCH /api/ai/characters/{id}、DELETE 同路径、POST …/avatar
 * 编辑模式下头像更换即时上传（已有角色 ID），保存走 PATCH，删除带二次确认。
 */
export default function AgentEditView({
  lang,
  character,
  onSaved,
  onDeleted,
  onCancel,
}: {
  lang: Gt2Lang;
  character: AiCharacter;
  onSaved: (updated: AiCharacter) => void;
  onDeleted: (id: string) => void;
  onCancel: () => void;
}) {
  const c = COPY[lang].agent;

  const [name, setName] = useState(character.name);
  const [persona, setPersona] = useState(character.persona ?? "");
  const [tone, setTone] = useState(character.tone ?? "");
  const [greeting, setGreeting] = useState(character.greeting ?? "");
  const [userNickname, setUserNickname] = useState(character.user_nickname ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(character.avatar_url);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 编辑模式：已有角色 ID，头像更换即时上传
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
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/ai/characters/${character.id}/avatar`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = await res.json();
        if (data.success) {
          setAvatarUrl(data.avatar_url);
        } else {
          setError(data.error || c.errAvatarUpload);
        }
      } catch {
        setError(c.errAvatarUpload);
      }
    },
    [character.id, c]
  );

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(c.errName);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          persona: persona.trim(),
          tone: tone.trim(),
          greeting: greeting.trim(),
          user_nickname: userNickname.trim(),
          avatar_url: avatarUrl,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        onSaved(data.character as AiCharacter);
      } else {
        setError(data.error || c.errEditSave);
        setSaving(false);
      }
    } catch {
      setError(c.errNetwork);
      setSaving(false);
    }
  }, [character.id, name, persona, tone, greeting, userNickname, avatarUrl, c, onSaved]);

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    if (!window.confirm(c.editDeleteConfirm.replace("{name}", character.name))) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/characters/${character.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        onDeleted(character.id);
      } else {
        setError(data.error || c.errEditDelete);
        setDeleting(false);
      }
    } catch {
      setError(c.errNetwork);
      setDeleting(false);
    }
  }, [character.id, character.name, deleting, c, onDeleted]);

  return (
    <div className="gt2-agent-edit gt2-rise">
      {/* 返回聊天 */}
      <div className="gt2-agent-edit-head">
        <button type="button" className="gt2-chat-back" onClick={onCancel} aria-label={c.backBtn} title={c.backBtn}>
          <BackIcon />
          <span>{c.backBtn}</span>
        </button>
      </div>

      <div className="gt2-agent-form">
        <div className="gt2-section-label">
          <b>{c.editTitle}</b>
          <span>{c.editTitleEn}</span>
        </div>
        <p className="gt2-agent-edit-sub">{c.editSubtitle}</p>

        <div className="gt2-agent-avatar">
          <button
            type="button"
            className="gt2-agent-avatar-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={character.name} />
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
          <button type="button" className="gt2-btn-danger" onClick={handleDelete} disabled={deleting || saving}>
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {c.editDeleting}
              </>
            ) : (
              <>
                <TrashIcon />
                {c.editDelete}
              </>
            )}
          </button>
          <button type="button" className="gt2-btn-solid" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {c.editSaving}
              </>
            ) : (
              c.editSave
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
