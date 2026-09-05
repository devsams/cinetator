import { useEffect, useState } from "react";
import { listNotes, resolveNote, replyToNote } from "./api";

export default function Team({ project }) {
  const projectId = project?.project_id;
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState({});
  const [sending, setSending] = useState(null);

  async function refresh() {
    if (!projectId) return;
    try { setNotes(await listNotes(projectId)); } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); }, [projectId]);

  async function sendReply(noteId) {
    const text = (replyDrafts[noteId] || "").trim();
    if (!text) return;
    setSending(noteId); setError("");
    try {
      await replyToNote(noteId, text);
      setReplyDrafts((d) => ({ ...d, [noteId]: "" }));
      await refresh();
    } catch (e) { setError(e.message); } finally { setSending(null); }
  }

  async function markResolved(noteId) {
    await resolveNote(noteId, true);
    await refresh();
  }

  if (!projectId) return null;

  const unanswered = notes.filter((n) => !n.reply_text);
  const answered = notes.filter((n) => n.reply_text);

  return (
    <div>
      <div className="ct-ptitle"><span className="num">08</span>Team</div>
      <p className="ct-psub">Notes from cast, crew, and location contacts — reply here and they'll see it on their page.</p>
      {error && <p style={{ color: "#ff5c5c" }}>{error}</p>}

      {notes.length === 0 && (
        <div className="ct-card" style={{ color: "#74777f", fontSize: 13.5 }}>No notes yet.</div>
      )}

      {unanswered.length > 0 && (
        <>
          <div className="ct-secrow"><span className="dot" style={{ background: "#f5c518" }} /><h3>Needs a reply</h3><span className="ct-count">{unanswered.length}</span></div>
          {unanswered.map((n) => (
            <NoteCard key={n.id} n={n} draft={replyDrafts[n.id] || ""}
              onDraft={(v) => setReplyDrafts((d) => ({ ...d, [n.id]: v }))}
              onSend={() => sendReply(n.id)} onResolve={() => markResolved(n.id)}
              sending={sending === n.id} />
          ))}
        </>
      )}

      {answered.length > 0 && (
        <>
          <div className="ct-secrow"><span className="dot" style={{ background: "#3ddc84" }} /><h3>Answered</h3><span className="ct-count">{answered.length}</span></div>
          {answered.map((n) => (
            <NoteCard key={n.id} n={n} draft="" onDraft={() => {}} onSend={() => {}} onResolve={() => {}} sending={false} readOnly />
          ))}
        </>
      )}
    </div>
  );
}

function NoteCard({ n, draft, onDraft, onSend, onResolve, sending, readOnly }) {
  return (
    <div className="ct-card" style={n.flags_production && !n.reply_text ? { borderColor: "#3a3010", background: "#1f1c10" } : {}}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div className="disp" style={{ fontSize: 15 }}>
            {n.person_name}{n.day_number ? ` · Day ${n.day_number}` : ""}
            {n.flags_production && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#f5c518" }}>@PRODUCTION</span>}
          </div>
          <div style={{ fontSize: 13, color: "#e6e8ec", marginTop: 6 }}>{n.text}</div>
          <div style={{ fontSize: 11, color: "#74777f", marginTop: 4 }}>{fmt(n.created_at)}</div>
        </div>
        {!readOnly && !n.reply_text && (
          <button style={ghostBtn} onClick={onResolve}>Mark resolved</button>
        )}
      </div>

      {n.reply_text ? (
        <div style={replyBox}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#3ddc84", textTransform: "uppercase", letterSpacing: .4 }}>Your reply</div>
          <div style={{ fontSize: 13, color: "#e6e8ec", marginTop: 4 }}>{n.reply_text}</div>
        </div>
      ) : !readOnly && (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <textarea className="ct-ta" style={{ minHeight: 44, flex: 1 }} value={draft}
            onChange={(e) => onDraft(e.target.value)} placeholder="Type a reply…" />
          <button className="ct-btn dark" onClick={onSend} disabled={sending || !draft.trim()}>
            {sending ? "…" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}

function fmt(iso) {
  if (!iso) return "";
  const d = new Date(iso + "Z");
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h ago";
  return d.toLocaleDateString();
}

const ghostBtn = { background: "#242428", border: "none", color: "#b6b9c0", borderRadius: 8, padding: "6px 11px", fontSize: 12, cursor: "pointer" };
const replyBox = { marginTop: 12, paddingTop: 12, borderTop: "1px solid #2a2a2e" };
