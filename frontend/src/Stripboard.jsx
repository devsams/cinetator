import { useEffect, useState } from "react";
import { listStrips, autoPopulateStrips, addStrip, updateStrip, deleteStrip, reorderStrips, setCrewCalls } from "./api";
import { listDays } from "./api";
import { listPeople } from "./api";

function stripColor(intext, daynight) {
  if (intext === "INT" && daynight === "DAY") return { border: "#b8bcc4", tag: "#e8e9ec", tagText: "#1a1b1e", label: "INT DAY" };
  if (intext === "EXT" && daynight === "DAY") return { border: "#e0b400", tag: "#3a2f05", tagText: "#f2cd4d", label: "EXT DAY" };
  if (intext === "INT" && daynight === "NIGHT") return { border: "#5b9dff", tag: "#0f2036", tagText: "#8cbaff", label: "INT NIGHT" };
  if (intext === "EXT" && daynight === "NIGHT") return { border: "#3ddc84", tag: "#0f2a1b", tagText: "#7fe8ac", label: "EXT NIGHT" };
  return { border: "#6c6f78", tag: "#242428", tagText: "#a8abb3", label: "" };
}

function computeTimeline(strips, sceneByNum, crewCalls) {
  let clock = null;
  if (crewCalls?.[0]) {
    const [h, m] = crewCalls[0].time.split(":").map(Number);
    clock = h * 60 + m;
  }
  const times = {};
  let totalMins = 0, lunchSeen = false, minsSinceCall = 0, lunchWarn = false;
  strips.forEach((s) => {
    times[s.id] = clock !== null ? `${String(Math.floor(clock / 60) % 24).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}` : "";
    const dur = s.duration_mins || 0;
    if (s.type === "special" && s.label === "Lunch Break") { lunchSeen = true; minsSinceCall = 0; }
    if (clock !== null) clock += dur;
    totalMins += dur;
    if (!lunchSeen) { minsSinceCall += dur; if (minsSinceCall >= 360) lunchWarn = true; }
  });
  return { times, totalMins, lunchWarn };
}

export default function Stripboard({ project }) {
  const projectId = project?.project_id;
  const breakdown = project?.breakdown;
  const [days, setDays] = useState([]);
  const [activeDay, setActiveDay] = useState(null);
  const [strips, setStrips] = useState([]);
  const [people, setPeople] = useState([]);
  const [crewCalls, setCrewCallsState] = useState([{ dept: "Crew Call", time: "07:00" }]);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customMins, setCustomMins] = useState(30);

  async function refresh() {
    if (!projectId) return;
    try {
      const [d, ppl] = await Promise.all([listDays(projectId), listPeople(projectId)]);
      setDays(d); setPeople(ppl);
      const day = activeDay || d[0]?.id;
      if (day) {
        setActiveDay(day);
        const s = await listStrips(day);
        setStrips(s);
      }
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); }, [projectId]);

  async function switchDay(id) {
    setActiveDay(id);
    const s = await listStrips(id);
    setStrips(s);
  }

  async function onAutoPopulate() {
    setError("");
    try { const s = await autoPopulateStrips(activeDay); setStrips(s); } catch (e) { setError(e.message); }
  }
  async function onAddSpecial(label) {
    const defaults = { "Crew Call": 0, "Company Move": 30, "Lunch Break": 60, "Wrap": 0 };
    const s = await addStrip(activeDay, projectId, { type: "special", label, duration_mins: defaults[label] ?? 0 });
    setStrips((prev) => [...prev, s]);
  }
  async function onAddCustom() {
    const label = customLabel.trim();
    if (!label) { setError("Give the custom strip a label first."); return; }
    setError("");
    const s = await addStrip(activeDay, projectId, { type: "special", label, duration_mins: customMins || 0 });
    setStrips((prev) => [...prev, s]);
    setCustomLabel(""); setCustomMins(30); setShowCustom(false);
  }
  async function onDeleteStrip(id) {
    await deleteStrip(id);
    setStrips((prev) => prev.filter((s) => s.id !== id));
  }
  async function onDurationChange(id, mins) {
    await updateStrip(id, { duration_mins: mins });
    setStrips((prev) => prev.map((s) => (s.id === id ? { ...s, duration_mins: mins } : s)));
  }
  async function onDrop(targetId) {
    if (!dragId || dragId === targetId) return;
    const from = strips.findIndex((s) => s.id === dragId);
    const to = strips.findIndex((s) => s.id === targetId);
    const next = [...strips];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setStrips(next);
    setDragId(null);
    await reorderStrips(activeDay, next.map((s) => s.id));
  }

  const sceneByNum = {};
  (breakdown?.scenes || []).forEach((sc) => { sceneByNum[sc.number] = sc; });
  const tl = computeTimeline(strips, sceneByNum, crewCalls);

  function castNames(sc) {
    return (sc?.cast || []).map((charName) => {
      const p = people.find((pp) => (pp.character || "").toLowerCase() === charName.toLowerCase() || pp.name.toLowerCase() === charName.toLowerCase());
      return p ? `${p.name}${p.character ? ` (${p.character})` : ""}` : charName;
    }).join(", ");
  }

  if (!projectId) return null;
  if (!breakdown) {
    return <div style={{ color: "#74777f", textAlign: "center", padding: 60 }}>
      <div className="disp" style={{ fontSize: 22 }}>Stripboard</div>
      <p style={{ marginTop: 8 }}>Analyze a script in Breakdown first.</p>
    </div>;
  }

  return (
    <div>
      <div className="ct-ptitle"><span className="num">05</span>Stripboard</div>
      <p className="ct-psub">Order the day's scenes, insert breaks, and see the running clock update live.</p>
      {error && <p style={{ color: "#ff5c5c" }}>{error}</p>}

      {days.length > 0 && (
        <div style={{ display: "flex", gap: 8, margin: "10px 0 18px", flexWrap: "wrap" }}>
          {days.map((d) => (
            <button key={d.id} className={`ct-tabbtn ${activeDay === d.id ? "active" : ""}`} onClick={() => switchDay(d.id)}>
              Day {d.day_number}
            </button>
          ))}
        </div>
      )}

      {tl.lunchWarn && (
        <div style={{ background: "#2a1c05", border: "1px solid #55380a", color: "#f2b84d", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 14 }}>
          ⚠ 6 hours since crew call with no lunch break inserted — add one to the timeline.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button className="ct-btn dark tiny" onClick={onAutoPopulate}>Auto-populate from breakdown</button>
        <button className="ct-btn ghost tiny" onClick={() => onAddSpecial("Crew Call")}>+ Crew Call</button>
        <button className="ct-btn ghost tiny" onClick={() => onAddSpecial("Company Move")}>+ Company Move</button>
        <button className="ct-btn ghost tiny" onClick={() => onAddSpecial("Lunch Break")}>+ Lunch</button>
        <button className="ct-btn ghost tiny" onClick={() => onAddSpecial("Wrap")}>+ Wrap</button>
        <button className="ct-btn softblue tiny" onClick={() => setShowCustom((v) => !v)}>+ Custom</button>
      </div>

      {showCustom && (
        <div className="ct-card" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <span className="ct-lbl">Label</span>
            <input className="ct-input" placeholder="e.g. Safety meeting, Camera reset"
              value={customLabel} onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAddCustom()} />
          </div>
          <div style={{ width: 120 }}>
            <span className="ct-lbl">Minutes</span>
            <input type="number" className="ct-input" value={customMins}
              onChange={(e) => setCustomMins(parseInt(e.target.value) || 0)} />
          </div>
          <button className="ct-btn dark tiny" onClick={onAddCustom}>Add strip</button>
          <button className="ct-btn ghost tiny" onClick={() => setShowCustom(false)}>Cancel</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <div className="ct-card" style={{ margin: 0 }}>
          <div className="ct-lbl">Total est. hours</div>
          <div className="disp" style={{ fontSize: 26, color: "#f5c518" }}>{(tl.totalMins / 60).toFixed(1)}</div>
        </div>
        <div className="ct-card" style={{ margin: 0 }}>
          <div className="ct-lbl">Strips</div>
          <div className="disp" style={{ fontSize: 26 }}>{strips.length}</div>
        </div>
        <div className="ct-card" style={{ margin: 0 }}>
          <div className="ct-lbl">Scenes</div>
          <div className="disp" style={{ fontSize: 26 }}>{strips.filter((s) => s.type === "scene").length}</div>
        </div>
      </div>

      {strips.map((s) => {
        const sc = s.type === "scene" ? sceneByNum[s.scene_number] : null;
        const c = sc ? stripColor(sc.int_ext, (sc.time_of_day || "").toUpperCase().includes("NIGHT") ? "NIGHT" : "DAY") : { border: "#6c6f78" };
        return (
          <div key={s.id} draggable
            onDragStart={() => setDragId(s.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(s.id)}
            style={{ ...stripRow, borderLeftColor: c.border }}>
            <span className="mono" style={{ fontSize: 12, color: "#74777f", width: 50 }}>{tl.times[s.id]}</span>
            {s.type === "special" ? (
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</div>
              </div>
            ) : (
              <>
                <span className="disp" style={{ fontSize: 15, color: "#f5c518", width: 30 }}>{s.scene_number}</span>
                {c.label && <span style={{ ...tagStyle, background: c.tag, color: c.tagText }}>{c.label}</span>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5 }}>{sc?.location} {sc?.int_ext ? `— ${sc.int_ext}` : ""}</div>
                  <div style={{ fontSize: 11.5, color: "#74777f" }}>{castNames(sc)}</div>
                </div>
              </>
            )}
            <input type="number" className="ct-input" style={{ width: 70, padding: "6px 8px" }}
              value={s.duration_mins} onChange={(e) => onDurationChange(s.id, parseInt(e.target.value) || 0)} />
            <button style={delBtn} onClick={() => onDeleteStrip(s.id)}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

const stripRow = { display: "flex", alignItems: "center", gap: 12, borderLeft: "4px solid #6c6f78", background: "#161618", borderRadius: "0 8px 8px 0", padding: "10px 14px", marginBottom: 8, cursor: "grab" };
const tagStyle = { fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 5 };
const delBtn = { border: "none", background: "none", color: "#ff5c5c", cursor: "pointer", fontSize: 14 };
