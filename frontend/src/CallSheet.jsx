import { useEffect, useState } from "react";
import {
  listDays, listStrips, listPeople, listLocations,
  setCrewCalls, setDayMeta, setCompany, updateDay,
} from "./api";

export default function CallSheet({ project }) {
  const projectId = project?.project_id;
  const breakdown = project?.breakdown;
  const [days, setDays] = useState([]);
  const [activeDay, setActiveDay] = useState(null);
  const [strips, setStrips] = useState([]);
  const [people, setPeople] = useState([]);
  const [locations, setLocations] = useState([]);
  const [crewCalls, setLocalCrewCalls] = useState([{ dept: "Crew Call", time: "07:00" }]);
  const [company, setCompanyState] = useState(project?.production_company || "");
  const [meta, setMeta] = useState({ weather: "", sunrise: "", sunset: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    if (!projectId) return;
    try {
      const [d, ppl, locs] = await Promise.all([listDays(projectId), listPeople(projectId), listLocations(projectId)]);
      setDays(d); setPeople(ppl); setLocations(locs);
      const dayId = activeDay || d[0]?.id;
      if (dayId) {
        setActiveDay(dayId);
        const day = d.find((x) => x.id === dayId);
        const s = await listStrips(dayId);
        setStrips(s);
        if (day?.crew_calls) { try { setLocalCrewCalls(JSON.parse(day.crew_calls)); } catch {} }
        setMeta({ weather: day?.weather || "", sunrise: day?.sunrise || "", sunset: day?.sunset || "" });
      }
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); }, [projectId]);

  async function switchDay(id) {
    setActiveDay(id);
    const [s] = await Promise.all([listStrips(id)]);
    setStrips(s);
    const day = days.find((x) => x.id === id);
    if (day?.crew_calls) { try { setLocalCrewCalls(JSON.parse(day.crew_calls)); } catch { setLocalCrewCalls([{ dept: "Crew Call", time: "07:00" }]); } }
    else setLocalCrewCalls([{ dept: "Crew Call", time: "07:00" }]);
    setMeta({ weather: day?.weather || "", sunrise: day?.sunrise || "", sunset: day?.sunset || "" });
  }

  const day = days.find((d) => d.id === activeDay);
  const location = locations.find((l) => l.id === day?.location_id);
  const research = location?.research;

  const sceneByNum = {};
  (breakdown?.scenes || []).forEach((sc) => { sceneByNum[sc.number] = sc; });

  function computeTimes() {
    let clock = null;
    if (crewCalls?.[0]) { const [h, m] = crewCalls[0].time.split(":").map(Number); clock = h * 60 + m; }
    const times = {};
    strips.forEach((s) => {
      times[s.id] = clock !== null ? `${String(Math.floor(clock / 60) % 24).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}` : "—";
      if (clock !== null) clock += (s.duration_mins || 0);
    });
    return times;
  }
  const times = computeTimes();

  function castNames(sc) {
    return (sc?.cast || []).map((charName) => {
      const p = people.find((pp) => (pp.character || "").toLowerCase() === charName.toLowerCase() || pp.name.toLowerCase() === charName.toLowerCase());
      return p ? `${p.name}${p.character ? ` (${p.character})` : ""}` : charName;
    }).join(", ");
  }

  async function saveCrewCalls(next) {
    setLocalCrewCalls(next);
    setSaving(true);
    try { await setCrewCalls(activeDay, next); } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  function updateCrewCall(i, field, val) {
    const next = crewCalls.map((c, idx) => (idx === i ? { ...c, [field]: val } : c));
    saveCrewCalls(next);
  }
  function addCrewCall() { saveCrewCalls([...crewCalls, { dept: "New dept", time: "08:00" }]); }
  function removeCrewCall(i) { saveCrewCalls(crewCalls.filter((_, idx) => idx !== i)); }

  async function saveMeta(next) {
    setMeta(next);
    try { await setDayMeta(activeDay, next); } catch (e) { setError(e.message); }
  }
  async function saveCompany(val) {
    setCompanyState(val);
    try { await setCompany(projectId, val); } catch (e) { setError(e.message); }
  }

  // Auto-fill hospital/safety from Parallel research when available
  const hospitalText = research?.nearby_safety || null;

  if (!projectId) return null;
  if (!breakdown) {
    return <div style={{ color: "#74777f", textAlign: "center", padding: 60 }}>
      <div className="disp" style={{ fontSize: 22 }}>Call Sheet</div>
      <p style={{ marginTop: 8 }}>Analyze a script in Breakdown first.</p>
    </div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="ct-ptitle"><span className="num">06</span>Call Sheet</div>
          <p className="ct-psub" style={{ marginBottom: 0 }}>The one-page document crew and cast rely on. Pulled live from Stripboard, People, and Plan.</p>
        </div>
        <button className="ct-btn dark" onClick={() => window.print()}>Print / Export PDF</button>
      </div>

      {error && <p style={{ color: "#ff5c5c" }}>{error}</p>}

      {days.length > 0 && (
        <div style={{ display: "flex", gap: 8, margin: "14px 0 18px", flexWrap: "wrap" }}>
          {days.map((d) => (
            <button key={d.id} className={`ct-tabbtn ${activeDay === d.id ? "active" : ""}`} onClick={() => switchDay(d.id)}>
              Day {d.day_number}
            </button>
          ))}
        </div>
      )}

      {/* Editable fields */}
      <div className="ct-card">
        <div className="disp" style={{ fontSize: 16, marginBottom: 12 }}>Project info</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          <div><span className="ct-lbl">Production company</span>
            <input className="ct-input" value={company} onChange={(e) => saveCompany(e.target.value)} placeholder="e.g. Lo-Fi Pictures" /></div>
          <div><span className="ct-lbl">Weather</span>
            <input className="ct-input" value={meta.weather} onChange={(e) => saveMeta({ ...meta, weather: e.target.value })} placeholder="Clear, 68°F" /></div>
          <div><span className="ct-lbl">Sunrise / Sunset</span>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="ct-input" value={meta.sunrise} onChange={(e) => saveMeta({ ...meta, sunrise: e.target.value })} placeholder="6:42 AM" />
              <input className="ct-input" value={meta.sunset} onChange={(e) => saveMeta({ ...meta, sunset: e.target.value })} placeholder="7:18 PM" />
            </div>
          </div>
        </div>
      </div>

      <div className="ct-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="disp" style={{ fontSize: 16 }}>Staggered call times</div>
          <button className="ct-btn ghost tiny" onClick={addCrewCall}>+ Add department</button>
        </div>
        <table className="ct-table">
          <thead><tr><th>Department</th><th>Time</th><th></th></tr></thead>
          <tbody>
            {crewCalls.map((c, i) => (
              <tr key={i}>
                <td><input className="ct-input" value={c.dept} onChange={(e) => updateCrewCall(i, "dept", e.target.value)} /></td>
                <td><input type="time" className="ct-input mono" value={c.time} onChange={(e) => updateCrewCall(i, "time", e.target.value)} /></td>
                <td><button style={delBtn} onClick={() => removeCrewCall(i)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PRINT LAYOUT */}
      <div className="disp" style={{ fontSize: 14, color: "#74777f", margin: "20px 0 8px" }}>Preview</div>
      <div id="callsheet-print" className="ct-card" style={{ background: "#0f1012" }}>
        <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 12, marginBottom: 12, borderBottom: "2px solid #2a2a2e" }}>
          <div>
            <div className="disp" style={{ fontSize: 26, color: "#f5c518" }}>{breakdown.title || project.title || "—"}</div>
            <div style={{ fontSize: 12, color: "#74777f" }}>{company || "—"}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#74777f" }}>
            <div>{day ? `Day ${day.day_number}` : "—"}</div>
            <div>{day?.locked_date || "date not yet set"}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, fontSize: 12, marginBottom: 18 }}>
          <div><b style={{ color: "#fff" }}>Weather</b><br /><span style={{ color: "#b6b9c0" }}>{meta.weather || "—"}</span></div>
          <div><b style={{ color: "#fff" }}>Sunrise / Sunset</b><br /><span style={{ color: "#b6b9c0" }}>{meta.sunrise || "—"} / {meta.sunset || "—"}</span></div>
          <div><b style={{ color: "#ff5c5c" }}>Hospital</b><br />
            <span style={{ color: "#b6b9c0" }}>
              {hospitalText ? hospitalText : location ? "Research this location in Plan for hospital info" : "No location set"}
            </span>
          </div>
        </div>

        <div className="ct-lbl">Call times</div>
        <table className="ct-table" style={{ marginBottom: 16 }}>
          <thead><tr><th>Dept</th><th>Time</th></tr></thead>
          <tbody>{crewCalls.map((c, i) => <tr key={i}><td>{c.dept}</td><td className="mono">{c.time}</td></tr>)}</tbody>
        </table>

        <div className="ct-lbl">Scenes to shoot</div>
        <table className="ct-table" style={{ marginBottom: 16 }}>
          <thead><tr><th>Time</th><th>Sc#</th><th>Location</th><th>Cast</th></tr></thead>
          <tbody>
            {strips.filter((s) => s.type === "scene").map((s) => {
              const sc = sceneByNum[s.scene_number];
              return (
                <tr key={s.id}>
                  <td className="mono">{times[s.id]}</td>
                  <td className="mono">{s.scene_number}</td>
                  <td>{sc?.location} {sc?.int_ext ? `— ${sc.int_ext}` : ""}</td>
                  <td style={{ fontSize: 11.5 }}>{castNames(sc)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="ct-lbl">Cast</div>
        <table className="ct-table">
          <thead><tr><th>Character</th><th>Name</th><th>Contact</th></tr></thead>
          <tbody>
            {people.filter((p) => p.role_type === "cast").map((p) => (
              <tr key={p.id}><td>{p.character || "—"}</td><td>{p.name}</td><td style={{ fontSize: 11.5 }}>{p.phone || p.email || "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const delBtn = { border: "none", background: "none", color: "#ff5c5c", cursor: "pointer", fontSize: 14 };
