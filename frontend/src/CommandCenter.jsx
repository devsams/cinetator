import { useState, useRef, useEffect } from "react";
import { sendChat, executeChatAction } from "./api";

function actionLabel(name, args) {
  switch (name) {
    case "add_person": return `Add ${args.name} (${args.role_type}${args.character ? " — " + args.character : ""})`;
    case "confirm_location": return `Confirm location: ${args.name}`;
    case "research_location": return `Research ${args.location_name} with Parallel`;
    case "add_candidate_date": return `Add ${args.date} as a candidate date for Day ${args.day_number}`;
    case "lock_date": return `Lock ${args.date} for Day ${args.day_number}`;
    case "send_reminder": return `Send a reminder to: ${(args.names || []).join(", ")}`;
    case "send_outreach": return `Send availability requests to: ${(args.names || []).join(", ")}`;
    default: return name;
  }
}

export default function CommandCenter({ project }) {
  const projectId = project?.project_id;
  const enabled = !!project?.breakdown;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "I'm your Command Center. Ask me anything about the shoot, or ask me to help — I'll confirm before doing anything." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState(null); // {name, args}
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput(""); setError("");
    const history = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", text: m.text }));
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);
    try {
      const r = await sendChat(projectId, text, history);
      setMessages((m) => [...m, { role: "assistant", text: r.reply || "…" }]);
      if (r.tool_call) setPending(r.tool_call);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function confirmAction() {
    if (!pending) return;
    setSending(true); setError("");
    try {
      await executeChatAction(projectId, pending.name, pending.args);
      setMessages((m) => [...m, { role: "assistant", text: `✓ Done — ${actionLabel(pending.name, pending.args)}.` }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `That didn't work: ${e.message}` }]);
    } finally {
      setPending(null); setSending(false);
    }
  }
  function cancelAction() {
    setMessages((m) => [...m, { role: "assistant", text: "Okay, I won't do that." }]);
    setPending(null);
  }

  return (
    <div style={{ ...panel, width: open ? 340 : 52 }}>
      <button style={toggleBtn} onClick={() => setOpen((v) => !v)} title={open ? "Collapse" : "Open Command Center"}>
        {open ? "›" : "🎬"}
      </button>

      {open && (
        <div style={inner}>
          <div className="disp" style={{ fontSize: 15, padding: "16px 16px 8px" }}>Command Center</div>

          {!enabled ? (
            <div style={{ padding: 16, color: "#74777f", fontSize: 13 }}>
              Analyze a script in the Breakdown tab first — I'll be ready once there's a production to help with.
            </div>
          ) : (
            <>
              <div style={msgList}>
                {messages.map((m, i) => (
                  <div key={i} style={{ ...bubble, ...(m.role === "user" ? bubbleUser : bubbleAssistant) }}>
                    {m.text}
                  </div>
                ))}
                {pending && (
                  <div style={confirmCard}>
                    <div style={{ fontSize: 12.5, marginBottom: 10 }}>
                      <b>Proposed action:</b><br />{actionLabel(pending.name, pending.args)}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="ct-btn dark tiny" onClick={confirmAction} disabled={sending}>
                        {sending ? "Working…" : "Confirm"}
                      </button>
                      <button className="ct-btn ghost tiny" onClick={cancelAction} disabled={sending}>Cancel</button>
                    </div>
                  </div>
                )}
                {error && <div style={{ color: "#ff5c5c", fontSize: 12, padding: "0 4px" }}>{error}</div>}
                <div ref={endRef} />
              </div>

              <div style={inputRow}>
                <input
                  style={inputStyle}
                  placeholder="Ask or tell it what to do…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  disabled={sending || !!pending}
                />
                <button className="ct-btn dark tiny" onClick={send} disabled={sending || !!pending}>Send</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const panel = {
  position: "fixed", top: 0, right: 0, height: "100vh", background: "#161618",
  borderLeft: "1px solid #2a2a2e", zIndex: 40, transition: "width .18s", overflow: "hidden",
  display: "flex", flexDirection: "column",
};
const toggleBtn = {
  position: "absolute", top: 16, left: 10, width: 32, height: 32, borderRadius: 8,
  background: "#f5c518", color: "#0d0d0e", border: "none", fontWeight: 800, cursor: "pointer", fontSize: 15,
};
const inner = { paddingTop: 8, display: "flex", flexDirection: "column", height: "100%" };
const msgList = { flex: 1, overflowY: "auto", padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 };
const bubble = { padding: "10px 13px", borderRadius: 12, fontSize: 13, lineHeight: 1.5, maxWidth: "88%" };
const bubbleAssistant = { background: "#1d1d20", color: "#e6e8ec", alignSelf: "flex-start" };
const bubbleUser = { background: "#242428", color: "#fff", alignSelf: "flex-end" };
const confirmCard = { background: "#2a2410", border: "1px solid #3a3010", borderRadius: 12, padding: 12, color: "#f0d878" };
const inputRow = { display: "flex", gap: 8, padding: 14, borderTop: "1px solid #2a2a2e" };
const inputStyle = { flex: 1, background: "#242428", border: "1px solid #2a2a2e", borderRadius: 9, padding: "9px 11px", color: "#fff", fontSize: 13 };
