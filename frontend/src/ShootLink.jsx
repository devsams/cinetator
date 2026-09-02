import { useEffect, useState } from "react";
import { getLink, submitResponse } from "./api";

export default function ShootLink({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);

  async function load() {
    try { setData(await getLink(token)); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [token]);

  if (error) return <Center><h2>Cinetator</h2><p style={{ color: "crimson" }}>{error}</p></Center>;
  if (!data) return <Center>Loading…</Center>;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#fafafa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "40px 16px" }}>
        <h2 style={{ marginBottom: 4 }}>🎬 Hi {data.person.name},</h2>
        <p style={{ color: "#666", marginTop: 0 }}>
          Please tell us which dates work for you for each shoot day. Pick any that
          work — or suggest your own if none do.
        </p>
        {data.days.map((day) => (
          <DayCard key={day.shoot_day_id} token={token} day={day}
            saving={saving === day.shoot_day_id}
            onSaved={() => { setSaving(null); load(); }}
            onSaving={() => setSaving(day.shoot_day_id)} />
        ))}
      </div>
    </div>
  );
}

function DayCard({ token, day, saving, onSaved, onSaving }) {
  const [picked, setPicked] = useState(day.picked_dates || []);
  const [suggest, setSuggest] = useState((day.suggested_dates || []).join(", "));

  function toggle(d) {
    setPicked((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  async function save() {
    onSaving();
    const suggested = suggest.split(",").map((s) => s.trim()).filter(Boolean);
    await submitResponse(token, day.shoot_day_id, picked, suggested);
    onSaved();
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Day {day.day_number}{day.location_name ? ` — ${day.location_name}` : ""}</strong>
        {day.responded && <span style={{ color: "#181", fontSize: 12 }}>✓ responded</span>}
      </div>

      {day.locked_date ? (
        <p style={{ color: "#181", marginTop: 8 }}>Confirmed date: {day.locked_date}</p>
      ) : (
        <>
          <div style={{ marginTop: 10, fontSize: 13, color: "#888" }}>Which of these can you do?</div>
          <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
            {(day.candidate_dates || []).length === 0 && (
              <div style={{ color: "#aaa", fontSize: 13 }}>No candidate dates set yet.</div>
            )}
            {(day.candidate_dates || []).map((d) => (
              <label key={d} style={{ ...option, ...(picked.includes(d) ? optionOn : {}) }}>
                <input type="checkbox" checked={picked.includes(d)} onChange={() => toggle(d)} />
                <span>{d}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: "#888" }}>
            Can't do any? Suggest dates that work (comma-separated):
          </div>
          <input style={input} placeholder="2026-09-06, 2026-09-07"
            value={suggest} onChange={(e) => setSuggest(e.target.value)} />

          <button style={button} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Submit for this day"}
          </button>
        </>
      )}
    </div>
  );
}

function Center({ children }) {
  return <div style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", textAlign: "center" }}>
    <div>{children}</div>
  </div>;
}

const card = { background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 18, marginTop: 16 };
const option = { display: "flex", gap: 10, alignItems: "center", padding: 10, border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 14 };
const optionOn = { borderColor: "#111", background: "#f5f5f5" };
const input = { width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginTop: 6 };
const button = { marginTop: 12, padding: "10px 16px", background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 };
