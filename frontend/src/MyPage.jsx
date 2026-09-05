import { useEffect, useState } from "react";
import { listPeople, getPersonView, submitPersonResponse, addNote, listMyNotes } from "./api";

function timeStyle(t) {
  const s = (t || "").toLowerCase();
  if (s.includes("magic")) return { bg: "#f5c518", fg: "#0d0d0e" };
  if (s.includes("sunset") || s.includes("dusk")) return { bg: "#ff6ba8", fg: "#0d0d0e" };
  if (s.includes("dawn") || s.includes("sunrise")) return { bg: "#ff9d5c", fg: "#0d0d0e" };
  if (s.includes("night")) return { bg: "#2d3a66", fg: "#cfe0ff" };
  if (s.includes("morning")) return { bg: "#3a4a2a", fg: "#d6f0b0" };
  return { bg: "#243a4a", fg: "#b9e0f5" };
}

export default function MyPage({ project }) {
  const projectId = project?.project_id;
  const [people, setPeople] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    listPeople(projectId).then(setPeople).catch((e) => setError(e.message));
  }, [projectId]);

  useEffect(() => {
    if (!selectedId) { setView(null); return; }
    loadView(selectedId);
  }, [selectedId]);

  async function loadView(id) {
    setError("");
    try { setView(await getPersonView(id)); } catch (e) { setError(e.message); }
  }

  if (!projectId) return null;

  return (
    <div>
      <div className="ct-ptitle"><span className="num">07</span>My Page</div>
      <p className="ct-psub">See exactly what a cast, crew, or location contact sees — scenes, call time, logistics, and a way to reach production.</p>

      <div className="ct-card">
        <span className="ct-lbl">Viewing as</span>
        <select className="ct-select" style={selectStyle} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">— pick a person —</option>
          {["cast", "crew", "other"].map((grp) => {
            const rows = people.filter((p) => p.role_type === grp);
            if (rows.length === 0) return null;
            return (
              <optgroup key={grp} label={grp.toUpperCase()}>
                {rows.map((p) => <option key={p.id} value={p.id}>{p.name}{p.character ? ` — ${p.character}` : ""}</option>)}
              </optgroup>
            );
          })}
        </select>
      </div>

      {error && <p style={{ color: "#ff5c5c" }}>{error}</p>}

      {view && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 8px" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#f5c518" }} />
            <span className="ct-lbl" style={{ margin: 0 }}>
              {view.person.role_type === "cast" ? (view.person.character || "Cast") : view.person.role_type === "crew" ? "Crew" : "Location"}
            </span>
          </div>
          <div className="disp" style={{ fontSize: 22, marginBottom: 18 }}>Hi {view.person.name.split(" ")[0]},</div>

          {view.days.length === 0 && (
            <div className="ct-card" style={{ color: "#74777f", fontSize: 13.5 }}>Not currently scheduled on any shoot days.</div>
          )}

          {view.days.map((day) => (
            <DayCard key={day.shoot_day_id} personId={selectedId} day={day}
              saving={saving === day.shoot_day_id}
              onSaving={() => setSaving(day.shoot_day_id)}
              onSaved={() => { setSaving(null); loadView(selectedId); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayCard({ personId, day, saving, onSaving, onSaved }) {
  const [picked, setPicked] = useState(day.picked_dates || []);
  const [suggest, setSuggest] = useState((day.suggested_dates || []).join(", "));
  const [noteText, setNoteText] = useState("");
  const [noteSent, setNoteSent] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [myNotes, setMyNotes] = useState([]);

  async function loadMyNotes() {
    try {
      const all = await listMyNotes(personId);
      setMyNotes(all.filter((n) => n.shoot_day_id === day.shoot_day_id));
    } catch {}
  }
  useEffect(() => { loadMyNotes(); }, [personId, day.shoot_day_id]);

  function toggle(d) {
    setPicked((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }
  async function save() {
    onSaving();
    const suggested = suggest.split(",").map((s) => s.trim()).filter(Boolean);
    await submitPersonResponse(personId, day.shoot_day_id, picked, suggested);
    onSaved();
  }
  async function sendNote() {
    if (!noteText.trim()) return;
    setNoteError("");
    try {
      await addNote(personId, noteText.trim(), day.shoot_day_id);
      setNoteText(""); setNoteSent(true);
      setTimeout(() => setNoteSent(false), 2500);
      await loadMyNotes();
    } catch (e) { setNoteError(e.message); }
  }

  return (
    <div className="ct-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="disp" style={{ fontSize: 17 }}>Day {day.day_number}{day.location_name ? ` — ${day.location_name}` : ""}</div>
          {day.location_address && <div style={{ color: "#74777f", fontSize: 12, marginTop: 2 }}>{day.location_address}</div>}
          {day.call_time && <div style={{ color: "#74777f", fontSize: 12.5, marginTop: 2 }}>Call time: {day.call_time}</div>}
        </div>
        {day.responded && <span style={respondedPill}>✓ Responded</span>}
      </div>

      {/* logistics: weather / safety / constraints */}
      {(day.weather || day.nearby_safety || day.constraints?.length > 0) && (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {day.weather && <Info label="Weather" text={day.weather} />}
          {day.nearby_safety && <Info label="Safety & nearest hospital" text={day.nearby_safety} tone="#ff9d9d" />}
          {day.constraints?.length > 0 && (
            <div>
              <span className="ct-lbl">Good to know</span>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, color: "#b6b9c0" }}>
                {day.constraints.map((c, i) => <li key={i} style={{ fontSize: 12.5, marginBottom: 2 }}>{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* who else is on this day */}
      {day.who_else?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <span className="ct-lbl">Who's called</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {day.who_else.map((p, i) => (
              <span key={i} style={whoChip}>{p.name}{p.character ? ` (${p.character})` : ""} · {p.role_type}</span>
            ))}
          </div>
        </div>
      )}

      {/* scenes (cast only) */}
      {day.my_scenes?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <span className="ct-lbl">Your scenes</span>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {day.my_scenes.map((s, i) => {
              const ts = timeStyle(s.time_of_day);
              return (
                <div key={i} style={sceneRow}>
                  <span className="disp" style={{ fontSize: 13 }}>SC {s.number}</span>
                  <span style={{ color: "#b6b9c0", fontSize: 12.5 }}>{s.int_ext}. {s.location}</span>
                  <span style={{ ...sceneTag, background: ts.bg, color: ts.fg }}>{s.time_of_day}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* availability */}
      {day.locked_date ? (
        <p style={{ color: "#3ddc84", marginTop: 14, fontSize: 13.5 }}>Confirmed date: <b>{day.locked_date}</b></p>
      ) : (
        <>
          <div style={{ marginTop: 16 }}>
            <span className="ct-lbl">Which of these can you do?</span>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {(day.candidate_dates || []).length === 0 && <div style={{ color: "#74777f", fontSize: 13 }}>No candidate dates set yet.</div>}
              {(day.candidate_dates || []).map((d) => (
                <label key={d} style={{ ...option, ...(picked.includes(d) ? optionOn : {}) }}>
                  <input type="checkbox" checked={picked.includes(d)} onChange={() => toggle(d)} />
                  <span>{d}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <span className="ct-lbl">Suggest alternate dates</span>
            <input className="ct-input" placeholder="2026-09-06, 2026-09-07" value={suggest} onChange={(e) => setSuggest(e.target.value)} />
          </div>
          <button className="ct-btn dark" style={{ marginTop: 14 }} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Submit for this day"}
          </button>
        </>
      )}

      {/* notes to production */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #2a2a2e" }}>
        {myNotes.length > 0 && (
          <div style={{ marginBottom: 14, display: "grid", gap: 10 }}>
            {myNotes.map((n) => (
              <div key={n.id} style={threadBox}>
                <div style={{ fontSize: 12.5, color: "#e6e8ec" }}>You: {n.text}</div>
                {n.reply_text ? (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #2a2a2e" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#3ddc84", textTransform: "uppercase" }}>Production replied</div>
                    <div style={{ fontSize: 12.5, color: "#e6e8ec", marginTop: 3 }}>{n.reply_text}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: "#74777f", marginTop: 6 }}>Waiting for a reply…</div>
                )}
              </div>
            ))}
          </div>
        )}
        <span className="ct-lbl">Message production</span>
        <p style={{ color: "#74777f", fontSize: 11.5, margin: "2px 0 8px" }}>Type <b style={{ color: "#f5c518" }}>@production</b> to flag something as urgent.</p>
        <textarea className="ct-ta" style={{ minHeight: 70 }} value={noteText} onChange={(e) => setNoteText(e.target.value)}
          placeholder="e.g. Running 15 min late, or @production can't find parking at the location" />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <button className="ct-btn ghost" onClick={sendNote} disabled={!noteText.trim()}>Send note</button>
          {noteSent && <span style={{ color: "#3ddc84", fontSize: 12.5 }}>✓ Sent</span>}
          {noteError && <span style={{ color: "#ff5c5c", fontSize: 12.5 }}>{noteError}</span>}
        </div>
      </div>
    </div>
  );
}

function Info({ label, text, tone }) {
  return <div><span className="ct-lbl">{label}</span><div style={{ fontSize: 13, color: tone || "#b6b9c0", marginTop: 3, lineHeight: 1.5 }}>{text}</div></div>;
}

const threadBox = { background: "#1d1d20", border: "1px solid #2a2a2e", borderRadius: 10, padding: 12 };
const selectStyle = { background: "#242428", color: "#fff", border: "1px solid #35353b", borderRadius: 9, padding: "10px 12px", width: "100%", fontSize: 14 };
const respondedPill = { background: "#12281c", color: "#3ddc84", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 };
const sceneRow = { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#1d1d20", border: "1px solid #2a2a2e", borderRadius: 8, flexWrap: "wrap" };
const sceneTag = { fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, marginLeft: "auto" };
const whoChip = { fontSize: 12, padding: "5px 10px", background: "#1d1d20", border: "1px solid #2a2a2e", borderRadius: 999, color: "#b6b9c0" };
const option = { display: "flex", gap: 10, alignItems: "center", padding: 10, border: "1px solid #2a2a2e", borderRadius: 8, cursor: "pointer", fontSize: 14, background: "#1d1d20" };
const optionOn = { borderColor: "#f5c518", background: "#2a2410" };
