import { useEffect, useState } from "react";
import { listDays, autoDays, addDay, updateDay, deleteDay, listLocations } from "./api";
import SendPanel from "./SendPanel";
import Decide from "./Decide";

export default function Schedule({ project }) {
  const projectId = project?.project_id;
  const [days, setDays] = useState([]);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState("");

  async function refresh() {
    if (!projectId) return;
    try {
      const [d, l] = await Promise.all([listDays(projectId), listLocations(projectId)]);
      setDays(d); setLocations(l);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); }, [projectId]);

  async function onAuto() { setError(""); try { await autoDays(projectId); await refresh(); } catch (e) { setError(e.message); } }
  async function onAddDay() { const next = (days.at(-1)?.day_number || 0) + 1; await addDay(projectId, next); await refresh(); }
  async function onSetLocation(dayId, location_id) { await updateDay(dayId, { location_id: location_id || null }); await refresh(); }
  async function onSetDate(day, idx, value) {
    const dates = [...(day.candidate_dates || [])]; dates[idx] = value;
    await updateDay(day.id, { candidate_dates: dates.filter(Boolean).slice(0, 3) }); await refresh();
  }
  async function onDeleteDay(dayId) { await deleteDay(dayId); await refresh(); }

  if (!projectId) {
    return <div style={{ color: "#74777f", textAlign: "center", padding: 60 }}>
      <h2>Schedule</h2><p>Analyze a script in the Breakdown tab first.</p>
    </div>;
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={card}>
        <h2 style={{ margin: 0 }}>2 · Schedule</h2>
        <p style={{ color: "#b6b9c0", marginTop: 4 }}>
          Set each shoot day's location and up to 3 candidate dates, send requests,
          then lock the date that works best once responses arrive.
        </p>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {days.length === 0 && <button style={button} onClick={onAuto}>Auto-create days from breakdown</button>}
          <button style={ghost} onClick={onAddDay}>+ Add a day</button>
        </div>
      </section>

      {days.map((day) => (
        <section key={day.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Day {day.day_number}</h3>
            <button style={del} onClick={() => onDeleteDay(day.id)}>✕</button>
          </div>
          <label style={fieldLabel}>Location</label>
          <select style={input} value={day.location_id || ""} onChange={(e) => onSetLocation(day.id, e.target.value)}>
            <option value="">— select a confirmed location —</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {locations.length === 0 && <div style={{ color: "#c80", fontSize: 12, marginTop: 4 }}>No confirmed locations yet — confirm one in the Plan tab first.</div>}
          <label style={fieldLabel}>Candidate dates (up to 3)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[0, 1, 2].map((i) => (
              <input key={i} type="date" style={dateInput}
                value={(day.candidate_dates || [])[i] || ""}
                onChange={(e) => onSetDate(day, i, e.target.value)} />
            ))}
          </div>
          {day.locked_date && <div style={{ marginTop: 8, color: "#181", fontSize: 13 }}>✓ Locked: {day.locked_date}</div>}
        </section>
      ))}

      <SendPanel projectId={projectId} />
      <Decide projectId={projectId} />
    </div>
  );
}

const card = { background: "#161618", border: "1px solid #2a2a2e", borderRadius: 12, padding: 20 };
const input = { padding: 10, border: "1px solid #35353b", borderRadius: 8, fontSize: 14, width: "100%", marginTop: 4 };
const dateInput = { padding: 8, border: "1px solid #35353b", borderRadius: 8, fontSize: 13 };
const button = { padding: "10px 16px", background: "#f5c518", color: "#0d0d0e", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 };
const ghost = { padding: "10px 14px", background: "#161618", border: "1px solid #35353b", borderRadius: 8, cursor: "pointer", fontSize: 14 };
const del = { border: "none", background: "none", color: "#c00", cursor: "pointer", fontSize: 14 };
const fieldLabel = { fontSize: 12, fontWeight: 700, color: "#74777f", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 12, marginBottom: 2, display: "block" };
