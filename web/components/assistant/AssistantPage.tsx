"use client";
import { useEffect, useRef, useState } from "react";
import { sendChat, decideAction, type PendingAction } from "@/services/agent.service";

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: PendingAction | null;
  /** set once an approve/reject card has been resolved */
  resolved?: "approve" | "reject";
}

const SUGGESTIONS = [
  "Show my Snapchat campaigns",
  "Create a campaign",
  "Check my Meta balance",
];

let _seq = 0;
const newId = () => `m${Date.now()}_${_seq++}`;

/* render • bullets and *bold* the same way the Telegram bubble does */
function renderText(text: string) {
  return text.split("\n").map((line, i) => {
    const html = line
      .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
      .replace(/•/g, '<span style="color:var(--accent)">•</span>');
    return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

export function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const empty = messages.length === 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { id: newId(), role: "user", text: trimmed }]);
    setBusy(true);
    try {
      const res = await sendChat(trimmed);
      setMessages((m) => [
        ...m,
        { id: newId(), role: "assistant", text: res.reply, pending: res.pending },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(msgId: string, action: PendingAction, decision: "approve" | "reject") {
    if (busy) return;
    setError(null);
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, resolved: decision } : x)));
    setBusy(true);
    try {
      const res = await decideAction(action.id, decision);
      setMessages((m) => [...m, { id: newId(), role: "assistant", text: res.reply }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(input);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        maxWidth: 720,
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: 28,
        padding: "8px 8px 8px 18px",
        boxShadow: "0 4px 24px oklch(0 0 0 / 0.25)",
      }}
    >
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask anything"
        disabled={busy}
        autoFocus
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          color: "var(--text-primary)",
          fontFamily: "var(--font-body)",
          fontSize: 15,
          outline: "none",
        }}
      />
      <button
        type="submit"
        disabled={busy || !input.trim()}
        aria-label="Send"
        style={{
          width: 38,
          height: 38,
          flexShrink: 0,
          borderRadius: "50%",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: busy || !input.trim() ? "var(--bg-elevated)" : "var(--accent)",
          color: "var(--text-inverse)",
          cursor: busy || !input.trim() ? "default" : "pointer",
          transition: "background 0.15s",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </button>
    </form>
  );

  /* ── empty state — centered ChatGPT-style hero ── */
  if (empty) {
    return (
      <div
        style={{
          height: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          padding: "0 20px",
        }}
      >
        <h1
          style={{
            fontSize: 30,
            fontWeight: 600,
            fontFamily: "var(--font-display)",
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Where should we begin?
        </h1>

        {composer}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              disabled={busy}
              style={{
                padding: "9px 16px",
                borderRadius: 20,
                border: "1px solid var(--border-default)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>
        )}
      </div>
    );
  }

  /* ── active conversation ── */
  return (
    <div
      style={{
        height: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 0",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18, padding: "0 20px" }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: msg.role === "user" ? "80%" : "100%",
                  background: msg.role === "user" ? "var(--bg-elevated)" : "transparent",
                  color: "var(--text-primary)",
                  borderRadius: msg.role === "user" ? 18 : 0,
                  padding: msg.role === "user" ? "10px 16px" : "2px 0",
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  whiteSpace: "pre-line",
                  fontFamily: "var(--font-body)",
                }}
              >
                {renderText(msg.text)}

                {/* approve / reject card */}
                {msg.pending && !msg.resolved && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => decide(msg.id, msg.pending!, "approve")} disabled={busy} style={btnStyle("var(--success)")}>
                      ✅ Approve
                    </button>
                    <button onClick={() => decide(msg.id, msg.pending!, "reject")} disabled={busy} style={btnStyle("var(--danger)")}>
                      ❌ Reject
                    </button>
                  </div>
                )}
                {msg.resolved && (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      fontWeight: 600,
                      color: msg.resolved === "approve" ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {msg.resolved === "approve" ? "✓ Approved" : "✕ Rejected"}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div style={{ color: "var(--text-tertiary)", fontSize: 14 }}>Thinking…</div>
          )}
          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        </div>
      </div>

      {/* bottom composer */}
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 20px 20px" }}>
        {composer}
      </div>
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 6,
    border: `1px solid ${color}`,
    background: "transparent",
    color,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-body)",
  };
}
