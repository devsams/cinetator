import { useState, useRef, useEffect } from "react";
import {
  listChatSessions, newChatSession, getChatMessages, sendChat, executeChatAction,
} from "./api";

function actionLabel(name, args) {
  switch (name) {
    case "add_person": return `Add ${args.name} (${args.role_type}${args.character ? " — " + args.character : ""})`;
    case "confirm_location": return `Confirm location: ${args.name}`;
    case "research_location": return `Research ${args.location_name} with Parallel`;
    case "add_candidate_date": return `Add ${args.date} as a candidate date for Day ${args.day_number}`;
    case "lock_date": return `Lock ${args.date} for Day ${args.day_number}`;
    case "send_reminder": return `Send a reminder to: ${(args.names || []).join(", ")}`;
    case "send_outreach": return `Send availability requests to: ${(args.names || []).join(", ")}`;
    case "reply_to_note": return `Reply to ${args.person_name}: "${args.reply_text}"`;
    case "mark_arrived": return `Mark ${args.person_name} as arrived on Day ${args.day_number}`;
    case "mark_scene_complete": return `Mark scene ${args.scene_number} complete on Day ${args.day_number}`;
    default: return name;
  }
}

export default function CommandCenter({ project }) {
  const projectId = project?.project_id;
  const enabled = !!project?.breakdown;
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pending, open]);

  async function loadSessions() {
    try { setSessions(await listChatSessions(projectId)); } catch {}
  }

  async function ensureSession() {
    if (sessionId) return sessionId;
    const s = await newChatSession(projectId);
    setSessionId(s.id);
    await loadSessions();
    return s.id;
  }

  async function openHistory() {
    setShowHistory((v) => !v);
    if (!showHistory) await loadSessions();
  }

  async function openSession(id) {
    setSessionId(id);
    setShowHistory(false);
    const msgs = await getChatMessages(projectId, id);
    setMessages(msgs.map((m) => ({ role: m.role, text: m.text })));
  }

  async function startNew() {
    const s = await newChatSession(projectId);
    setSessionId(s.id);
    setMessages([{ role: "assistant", text: "New chat with Lily. Ask me anything, or ask me to help — I'll confirm before doing anything." }]);
    setShowHistory(false);
    await loadSessions();
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput(""); setError("");
    const sid = await ensureSession();
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);
    try {
      const r = await sendChat(projectId, sid, text);
      setMessages((m) => [...m, { role: "assistant", text: r.reply || "…" }]);
      if (r.tool_call) setPending(r.tool_call);
    } catch (e) { setError(e.message); } finally { setSending(false); }
  }

  async function confirmAction() {
    if (!pending) return;
    setSending(true); setError("");
    try {
      await executeChatAction(projectId, pending.name, pending.args);
      setMessages((m) => [...m, { role: "assistant", text: `✓ Done — ${actionLabel(pending.name, pending.args)}.` }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `That didn't work: ${e.message}` }]);
    } finally { setPending(null); setSending(false); }
  }
  function cancelAction() {
    setMessages((m) => [...m, { role: "assistant", text: "Okay, I won't do that." }]);
    setPending(null);
  }

  if (!enabled) return null; // don't clutter the screen before there's a project to help with

  return (
    <>
      <button style={bubbleBtn} onClick={() => setOpen((v) => !v)} title={open ? "Close" : "Ask Lily"}>
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div style={chatWindow}>
          <div style={chatHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={avatarDot}>L</span>
              <div className="disp" style={{ fontSize: 15 }}>Lily</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={miniBtn} onClick={openHistory}>History</button>
              <button style={miniBtn} onClick={startNew}>+ New</button>
            </div>
          </div>

          {showHistory ? (
            <div style={{ padding: "4px 16px", overflowY: "auto", flex: 1 }}>
              {sessions.length === 0 && <div style={{ color: "#74777f", fontSize: 13 }}>No past chats yet.</div>}
              {sessions.map((s) => (
                <div key={s.id} style={histRow} onClick={() => openSession(s.id)}>
                  <div style={{ fontSize: 13, color: "#fff" }}>{s.title || "Untitled chat"}</div>
                  <div style={{ fontSize: 11, color: "#74777f" }}>{new Date(s.updated_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div style={msgList}>
                {messages.length === 0 && (
                  <div style={{ ...bubble, ...bubbleAssistant }}>
                    Hi, I'm Lily. Ask me anything about the shoot, or ask me to help — I'll confirm before doing anything.
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} style={{ ...bubble, ...(m.role === "user" ? bubbleUser : bubbleAssistant) }}>{m.text}</div>
                ))}
                {pending && (
                  <div style={confirmCard}>
                    <div style={{ fontSize: 12.5, marginBottom: 10 }}><b>Proposed action:</b><br />{actionLabel(pending.name, pending.args)}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="ct-btn dark tiny" onClick={confirmAction} disabled={sending}>{sending ? "Working…" : "Confirm"}</button>
                      <button className="ct-btn ghost tiny" onClick={cancelAction} disabled={sending}>Cancel</button>
                    </div>
                  </div>
                )}
                {error && <div style={{ color: "#ff5c5c", fontSize: 12, padding: "0 4px" }}>{error}</div>}
                <div ref={endRef} />
              </div>
              <div style={inputRow}>
                <input style={inputStyle} placeholder="Ask Lily…" value={input}
                  onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                  disabled={sending || !!pending} />
                <button style={sendBtn} onClick={send} disabled={sending || !!pending}>➤</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

const bubbleBtn = {
  position: "fixed", bottom: 24, right: 24, width: 56, height: 56, borderRadius: "50%",
  background: "#f5c518", color: "#0d0d0e", border: "none", fontSize: 22, fontWeight: 800,
  cursor: "pointer", zIndex: 50, boxShadow: "0 4px 16px rgba(0,0,0,.4)",
};
const chatWindow = {
  position: "fixed", bottom: 92, right: 24, width: 340, maxHeight: "70vh", background: "#161618",
  border: "1px solid #2a2a2e", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,.5)",
  zIndex: 49, display: "flex", flexDirection: "column", overflow: "hidden",
};
const chatHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #2a2a2e" };
const avatarDot = { width: 26, height: 26, borderRadius: "50%", background: "#f5c518", color: "#0d0d0e", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, fontFamily: "Oswald, sans-serif" };
const miniBtn = { background: "#242428", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11, color: "#b6b9c0", cursor: "pointer" };
const histRow = { padding: "10px 4px", borderBottom: "1px solid #2a2a2e", cursor: "pointer" };
const msgList = { flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 380 };
const bubble = { padding: "10px 13px", borderRadius: 16, fontSize: 13, lineHeight: 1.5, maxWidth: "85%" };
const bubbleAssistant = { background: "#1d1d20", color: "#e6e8ec", alignSelf: "flex-start", borderBottomLeftRadius: 4 };
const bubbleUser = { background: "#f5c518", color: "#0d0d0e", alignSelf: "flex-end", borderBottomRightRadius: 4, fontWeight: 500 };
const confirmCard = { background: "#2a2410", border: "1px solid #3a3010", borderRadius: 12, padding: 12, color: "#f0d878" };
const inputRow = { display: "flex", gap: 8, padding: 12, borderTop: "1px solid #2a2a2e" };
const inputStyle = { flex: 1, background: "#242428", border: "1px solid #2a2a2e", borderRadius: 20, padding: "9px 14px", color: "#fff", fontSize: 13 };
const sendBtn = { width: 34, height: 34, borderRadius: "50%", background: "#f5c518", color: "#0d0d0e", border: "none", fontSize: 14, cursor: "pointer", flexShrink: 0 };
