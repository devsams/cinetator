import { useEffect, useState } from "react";
import { getLink, submitResponse } from "./api";

function timeStyle(t) {
  const s = (t || "").toLowerCase();
  if (s.includes("magic")) return { bg: "#f5c518", fg: "#0d0d0e" };
  if (s.includes("sunset") || s.includes("dusk")) return { bg: "#ff6ba8", fg: "#0d0d0e" };
  if (s.includes("dawn") || s.includes("sunrise")) return { bg: "#ff9d5c", fg: "#0d0d0e" };
  if (s.includes("night")) return { bg: "#2d3a66", fg: "#cfe0ff" };
  if (s.includes("morning")) return { bg: "#3a4a2a", fg: "#d6f0b0" };
  return { bg: "#243a4a", fg: "#b9e0f5" };
}

export default function ShootLink({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);

  async function load() {
    try { setData(await getLink(token)); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [token]);

  if (error) return <Shell><Center><div className="disp" style={{ fontSize: 22 }}>Cinetator</div><p style={{ color: "#ff5c5c", marginTop: 10 }}>{error}</p></Center></Shell>;
  if (!data) return <Shell><Center><p style={{ color: "#74777f" }}>Loading…</p></Center></Shell>;

  const { person, days } = data;
  const roleLabel = person.role_type === "cast" ? (person.character || "Cast") : person.role_type === "crew" ? "Crew" : "Location";

  return (
    <Shell>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#f5c518" }} />
            <span className="ct-lbl" style={{ margin: 0 }}>{roleLabel}</span>
          </div>
          <div className="disp" style={{ fontSize: 28 }}>Hi {person.name.split(" ")[0]},</div>
          <p style={{ color: "#b6b9c0", fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
            Here's what you need for this production. Confirm the dates that work for you, or suggest your own.
          </p>
        </div>

        {days.length === 0 && (
          <div style={emptyCard}>You're not currently scheduled on any shoot days.</div>
        )}

        {days.map((day) => (
          <DayCard key={day.shoot_day_id} token={token} day={day} role={person.role_type}
            saving={saving === day.shoot_day_id}
            onSaved={() => { setSaving(null); load(); }}
            onSaving={() => setSaving(day.shoot_day_id)} />
        ))}
      </div>
    </Shell>
  );
}

function DayCard({ token, day, role, saving, onSaved, onSaving }) {
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="disp" style={{ fontSize: 18 }}>Day {day.day_number}{day.location_name ? ` — ${day.location_name}` : ""}</div>
          {day.call_time && <div style={{ color: "#74777f", fontSize: 12.5, marginTop: 2 }}>Call time: {day.call_time}</div>}
        </div>
        {day.responded && <span style={respondedPill}>✓ Responded</span>}
      </div>

      {/* Cast-only: their scenes for the day */}
      {day.my_scenes?.length > 0 && (
        <div style={{ marginTop: 16 }}>
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

      {day.locked_date ? (
        <p style={{ color: "#3ddc84", marginTop: 16, fontSize: 13.5 }}>Confirmed date: <b>{day.locked_date}</b></p>
      ) : (
        <>
          <div style={{ marginTop: 18 }}>
            <span className="ct-lbl">Which of these can you do?</span>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {(day.candidate_dates || []).length === 0 && (
                <div style={{ color: "#74777f", fontSize: 13 }}>No candidate dates set yet.</div>
              )}
              {(day.candidate_dates || []).map((d) => (
                <label key={d} style={{ ...option, ...(picked.includes(d) ? optionOn : {}) }}>
                  <input type="checkbox" checked={picked.includes(d)} onChange={() => toggle(d)} />
                  <span>{d}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <span className="ct-lbl">Can't do any? Suggest dates that work</span>
            <input style={inputStyle} placeholder="2026-09-06, 2026-09-07"
              value={suggest} onChange={(e) => setSuggest(e.target.value)} />
          </div>

          <button style={btnGold} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Submit for this day"}
          </button>
        </>
      )}
    </div>
  );
}

function Shell({ children }) {
  return <div style={{ minHeight: "100vh", background: "#0d0d0e", color: "#fff", fontFamily: "'Inter', sans-serif" }}>{children}</div>;
}
function Center({ children }) {
  return <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", textAlign: "center" }}><div>{children}</div></div>;
}

const card = { background: "#161618", border: "1px solid #2a2a2e", borderRadius: 14, padding: 20, marginBottom: 16 };
const emptyCard = { background: "#161618", border: "1px solid #2a2a2e", borderRadius: 14, padding: 20, color: "#74777f", fontSize: 13.5 };
const respondedPill = { background: "#12281c", color: "#3ddc84", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 };
const sceneRow = { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#1d1d20", border: "1px solid #2a2a2e", borderRadius: 8, flexWrap: "wrap" };
const sceneTag = { fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, marginLeft: "auto" };
const option = { display: "flex", gap: 10, alignItems: "center", padding: 10, border: "1px solid #2a2a2e", borderRadius: 8, cursor: "pointer", fontSize: 14, background: "#1d1d20" };
const optionOn = { borderColor: "#f5c518", background: "#2a2410" };
const inputStyle = { width: "100%", padding: 10, border: "1px solid #35353b", borderRadius: 8, fontSize: 14, marginTop: 6, background: "#242428", color: "#fff" };
const btnGold = { marginTop: 16, padding: "10px 16px", background: "#f5c518", color: "#0d0d0e", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 700 };
