import { useEffect, useState } from "react";
import { listPeople, getDaysText, sendTemplate } from "./api";

const DEFAULT_TEMPLATE = `Hi {name},

We're locking the shoot dates for our production and need your availability.

Here are the shoot days and the candidate dates:
{days}

Please open your personal link to tell us which dates work for you — or suggest alternates if none do:
{link}

Thanks!
The Production Team`;

export default function SendPanel({ projectId }) {
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState({});
  const [subject, setSubject] = useState("Please confirm your shoot dates");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [daysText, setDaysText] = useState("");
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    if (!projectId) return;
    try {
      const [ppl, dt] = await Promise.all([listPeople(projectId), getDaysText(projectId)]);
      setPeople(ppl);
      setDaysText(dt.days_text || "");
      // preselect everyone who has an email
      const sel = {};
      ppl.forEach((p) => { if (p.email) sel[p.id] = true; });
      setSelected(sel);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); }, [projectId]);

  function toggle(id) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  async function onSend() {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (ids.length === 0) { setError("Select at least one recipient."); return; }
    setSending(true); setError(""); setResult(null);
    try {
      const r = await sendTemplate(projectId, ids, subject, template);
      setResult(r);
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  }

  function copyLink(token) {
    const url = `${window.location.origin}/shoot/${token}`;
    navigator.clipboard.writeText(url);
  }

  if (!projectId) return null;

  const groups = ["cast", "crew", "other"];

  return (
    <section style={card}>
      <h3 style={{ marginTop: 0 }}>Send availability requests</h3>
      <p style={{ color: "#b6b9c0", marginTop: 4 }}>
        Pick who to contact, edit the message, and send. Each person's name and
        personal link are filled in automatically.
      </p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {/* Recipients */}
      {groups.map((g) => {
        const rows = people.filter((p) => p.role_type === g);
        if (rows.length === 0) return null;
        return (
          <div key={g} style={{ marginTop: 12 }}>
            <div style={fieldLabel}>{g}</div>
            {rows.map((p) => (
              <div key={p.id} style={row}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
                  <input type="checkbox" checked={!!selected[p.id]} disabled={!p.email}
                    onChange={() => toggle(p.id)} />
                  <span>{p.name}</span>
                  <span style={{ color: "#74777f", fontSize: 12 }}>
                    {p.email || "no email — add one in Breakdown"}
                  </span>
                </label>
                <button style={ghost} onClick={() => copyLink(p.token)}>Copy link</button>
              </div>
            ))}
          </div>
        );
      })}

      {/* Message */}
      <div style={{ marginTop: 16 }}>
        <div style={fieldLabel}>Subject</div>
        <input style={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={fieldLabel}>Message (uses {"{name}"}, {"{days}"}, {"{link}"})</div>
        <textarea style={{ ...input, minHeight: 200, fontFamily: "inherit" }}
          value={template} onChange={(e) => setTemplate(e.target.value)} />
        <div style={{ fontSize: 12, color: "#74777f", marginTop: 4 }}>
          Preview of {"{days}"}: <span style={{ whiteSpace: "pre-wrap" }}>{daysText || "no days set"}</span>
        </div>
      </div>

      <button style={button} onClick={onSend} disabled={sending}>
        {sending ? "Sending…" : "Send to selected"}
      </button>

      {result && (
        <div style={{ marginTop: 12, fontSize: 14 }}>
          <div style={{ color: "#181" }}>✓ Sent to {result.sent.length}: {result.sent.map((s) => s.name).join(", ")}</div>
          {result.skipped.length > 0 && (
            <div style={{ color: "#c80" }}>
              Skipped {result.skipped.length}: {result.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const card = { background: "#161618", border: "1px solid #2a2a2e", borderRadius: 12, padding: 20, marginTop: 24 };
const row = { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #2a2a2e" };
const input = { width: "100%", padding: 10, border: "1px solid #35353b", borderRadius: 8, fontSize: 14 };
const button = { marginTop: 16, padding: "10px 16px", background: "#f5c518", color: "#0d0d0e", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 };
const ghost = { padding: "6px 10px", background: "#161618", border: "1px solid #35353b", borderRadius: 8, cursor: "pointer", fontSize: 12 };
const fieldLabel = { fontSize: 12, fontWeight: 700, color: "#74777f", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 };
