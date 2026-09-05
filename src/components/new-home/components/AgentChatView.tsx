"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiCharacter, AiChatMessage } from "@/types/database";
import { COPY, type Gt2Lang } from "../copy";
import AgentEditView from "./AgentEditView";

/** 角色头像：有图用图，无图显示名字首字 */
function CharAvatar({ char, size, className }: { char: AiCharacter; size: number; className?: string }) {
  if (char.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={char.avatar_url} alt={char.name} className={className} style={{ width: size, height: size }} />;
  }
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        color: "#fff",
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        borderRadius: "50%",
      }}
    >
      {char.name.charAt(0)}
    </div>
  );
}

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);

const SlidersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 21v-7" />
    <path d="M4 10V3" />
    <path d="M12 21v-9" />
    <path d="M12 8V3" />
    <path d="M20 21v-5" />
    <path d="M20 12V3" />
    <path d="M2 14h4" />
    <path d="M10 8h4" />
    <path d="M18 16h4" />
  </svg>
);

/**
 * 龙灵工坊 · 内嵌聊天视图
 * 在新首页内完成「角色列表 → 切换 → 对话」全流程：
 * - 顶部横向角色切换栏（含新建入口）
 * - 消息区：加载历史 / 无历史显示开场白 / 乐观发送 / 清空
 * 全部复用生产 API（/api/ai/characters*），生产页面不受影响。
 */
export default function AgentChatView({
  lang,
  onNew,
  onBack,
  targetId,
}: {
  lang: Gt2Lang;
  onNew: () => void;
  onBack: () => void;
  targetId?: string | null;
}) {
  const c = COPY[lang].agent;

  const [characters, setCharacters] = useState<AiCharacter[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [character, setCharacter] = useState<AiCharacter | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [editing, setEditing] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeChipRef = useRef<HTMLButtonElement>(null);

  // 选中胶囊自动滚入视野（立即一次 + 展开动画结束后一次，覆盖名字展开宽度）
  useEffect(() => {
    const opts = { behavior: "smooth", inline: "nearest", block: "nearest" } as const;
    activeChipRef.current?.scrollIntoView(opts);
    const t = window.setTimeout(() => {
      activeChipRef.current?.scrollIntoView(opts);
    }, 520);
    return () => window.clearTimeout(t);
  }, [currentId, characters]);

  // 加载角色列表；targetId 优先选中（创建成功后直达）
  useEffect(() => {
    let alive = true;
    fetch("/api/ai/characters", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        if (data.success) {
          const list: AiCharacter[] = data.characters ?? [];
          setCharacters(list);
          const hit =
            targetId && list.some((ch) => ch.id === targetId)
              ? targetId
              : (list[0]?.id ?? null);
          setCurrentId(hit);
        } else if (data.error === "未登录") {
          setLoginRequired(true);
        } else {
          setError(data.error || c.errChatLoad);
        }
      })
      .catch(() => setError(c.errNetwork))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [targetId, c.errChatLoad, c.errNetwork]);

  // 切换角色 → 加载角色信息 + 历史消息（无历史展示开场白）
  useEffect(() => {
    if (!currentId) {
      setCharacter(null);
      setMessages([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/ai/characters/${currentId}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        if (data.success) {
          setCharacter(data.character);
          const msgs: AiChatMessage[] = data.messages ?? [];
          if (msgs.length === 0 && data.character.greeting) {
            setMessages([
              {
                id: "greeting",
                character_id: currentId,
                user_id: "",
                role: "assistant",
                content: data.character.greeting,
                created_at: new Date().toISOString(),
              },
            ]);
          } else {
            setMessages(msgs);
          }
        } else {
          setError(data.error || c.errChatLoad);
        }
      })
      .catch(() => setError(c.errNetwork))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [currentId, c.errChatLoad, c.errNetwork]);

  // 新消息后滚动到底部
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // 发送消息（乐观更新 + 服务端回填）
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || sending || !currentId) return;

    const tempUserMsg: AiChatMessage = {
      id: `temp-${Date.now()}`,
      character_id: currentId,
      user_id: "",
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInput("");
    setSending(true);
    setError(null);
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const res = await fetch(`/api/ai/characters/${currentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          data.userMessage,
          data.assistantMessage,
        ]);
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        setError(data.error || c.errChatSend);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setError(c.errNetwork);
    } finally {
      setSending(false);
    }
  }, [input, sending, currentId, c.errChatSend, c.errNetwork]);

  // 清空对话
  const handleClear = useCallback(async () => {
    if (!currentId || clearing) return;
    if (!window.confirm(c.chatClearConfirm)) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/ai/characters/${currentId}/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        if (character?.greeting) {
          setMessages([
            {
              id: "greeting",
              character_id: currentId,
              user_id: "",
              role: "assistant",
              content: character.greeting,
              created_at: new Date().toISOString(),
            },
          ]);
        } else {
          setMessages([]);
        }
      } else {
        setError(data.error || c.errChatClear);
      }
    } catch {
      setError(c.errNetwork);
    } finally {
      setClearing(false);
    }
  }, [currentId, clearing, character, c.chatClearConfirm, c.errChatClear, c.errNetwork]);

  // 输入框自适应高度
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  // 保存角色：同步列表胶囊 + 当前头部
  const handleSaved = useCallback((updated: AiCharacter) => {
    setCharacters((prev) => prev.map((ch) => (ch.id === updated.id ? updated : ch)));
    if (currentId === updated.id) setCharacter(updated);
    setEditing(false);
  }, [currentId]);

  // 删除角色：移出列表，自动切换到剩余角色
  const handleDeleted = useCallback((id: string) => {
    const rest = characters.filter((ch) => ch.id !== id);
    setCharacters(rest);
    if (currentId === id) {
      setCurrentId(rest[0]?.id ?? null);
    }
    setEditing(false);
  }, [characters, currentId]);

  // Enter 发送（Shift+Enter 换行）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // 未登录：给出登录提示（正常不会出现，游客可浏览但创建角色需登录）
  if (loginRequired) {
    return (
      <div className="gt2-chat-empty">
        <p>{c.loginHint}</p>
      </div>
    );
  }

  // 编辑角色：独立子视图（保存 / 删除 / 返回聊天）
  if (editing && character) {
    return (
      <AgentEditView
        lang={lang}
        character={character}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="gt2-chat">
      {/* 顶栏：返回居左固定，角色胶囊独立滚动，互不重叠 */}
      <div className="gt2-chat-topbar">
        <button type="button" className="gt2-chat-back" onClick={onBack} aria-label={c.backBtn} title={c.backBtn}>
          <BackIcon />
          <span>{c.backBtn}</span>
        </button>
        <div className="gt2-chat-switcher">
          {characters.map((ch) => (
            <button
              key={ch.id}
              ref={currentId === ch.id ? activeChipRef : undefined}
              type="button"
              className="gt2-chat-chip"
              data-on={currentId === ch.id}
              onClick={() => setCurrentId(ch.id)}
              title={ch.name}
            >
              <CharAvatar char={ch} size={22} className="gt2-chat-chip-avatar" />
              <span className="gt2-chat-chip-name">{ch.name}</span>
            </button>
          ))}
          <button
            type="button"
            className="gt2-chat-chip gt2-chat-chip-add"
            onClick={onNew}
            aria-label={c.newRole}
            title={c.newRole}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* 空列表 */}
      {characters.length === 0 && !loading ? (
        <div className="gt2-chat-empty">
          <p>{c.chatEmpty}</p>
          <button type="button" className="gt2-btn-solid" onClick={onNew}>
            {c.chatCreateFirst}
          </button>
        </div>
      ) : (
        <div className="gt2-chat-body">
          {/* 聊天头部 */}
          <div className="gt2-chat-header">
            {character && <CharAvatar char={character} size={40} className="gt2-chat-header-avatar" />}
            <div className="gt2-chat-header-info">
              <h2 className="gt2-chat-header-name">
                {character?.name ?? "…"}
              </h2>
              <p className="gt2-chat-header-sub">
                {character?.user_nickname
                  ? c.chatHelloWithName.replace("{name}", character.user_nickname)
                  : c.chatHello}
              </p>
            </div>
            <button
              type="button"
              className="gt2-chat-edit"
              onClick={() => setEditing(true)}
              disabled={!currentId}
              title={c.editBtn}
            >
              <SlidersIcon />
              <span>{c.editBtn}</span>
            </button>
            <button
              type="button"
              className="gt2-chat-clear"
              onClick={handleClear}
              disabled={clearing || !currentId}
              title={c.chatClearTitle}
              aria-label={c.chatClearTitle}
            >
              <TrashIcon />
            </button>
          </div>

          {/* 消息区 */}
          <div className="gt2-chat-messages" ref={messagesRef}>
            {loading ? (
              <div className="gt2-chat-loading">
                <span className="gt2-chat-typing-dot" />
                <span className="gt2-chat-typing-dot" />
                <span className="gt2-chat-typing-dot" />
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`gt2-chat-msg ${msg.role}`}>
                  <CharAvatar
                    char={{
                      id: "me",
                      user_id: "",
                      name: msg.role === "assistant" ? (character?.name ?? "AI") : "我",
                      avatar_url: msg.role === "assistant" ? (character?.avatar_url ?? null) : null,
                      persona: null,
                      tone: null,
                      greeting: null,
                      user_nickname: null,
                      is_active: true,
                      created_at: "",
                      updated_at: "",
                    }}
                    size={28}
                    className="gt2-chat-msg-avatar"
                  />
                  <div className="gt2-chat-bubble">{msg.content}</div>
                </div>
              ))
            )}

            {sending && (
              <div className="gt2-chat-msg assistant">
                <CharAvatar char={character ?? { id: "c", user_id: "", name: "AI", avatar_url: null, persona: null, tone: null, greeting: null, user_nickname: null, is_active: true, created_at: "", updated_at: "" }} size={28} className="gt2-chat-msg-avatar" />
                <div className="gt2-chat-bubble gt2-chat-typing">
                  <span className="gt2-chat-typing-dot" />
                  <span className="gt2-chat-typing-dot" />
                  <span className="gt2-chat-typing-dot" />
                </div>
              </div>
            )}
          </div>

          {error && <p className="gt2-chat-error">{error}</p>}

          {/* 输入栏 */}
          <div className="gt2-chat-input-row">
            <textarea
              ref={inputRef}
              className="gt2-chat-input"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={c.chatInputPh}
              rows={1}
              maxLength={4000}
            />
            <button
              type="button"
              className="gt2-chat-send"
              onClick={handleSend}
              disabled={sending || !input.trim() || !currentId}
              aria-label={c.send}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
