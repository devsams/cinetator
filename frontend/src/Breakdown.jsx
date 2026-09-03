import { useEffect, useState } from "react";
import { analyzeScript, listLocations } from "./api";

function timeStyle(t) {
  const s = (t || "").toLowerCase();
  if (s.includes("magic")) return { bg: "#f5c518", fg: "#0d0d0e" };
  if (s.includes("sunset") || s.includes("dusk") || s.includes("golden")) return { bg: "#ff6ba8", fg: "#0d0d0e" };
  if (s.includes("dawn") || s.includes("sunrise")) return { bg: "#ff9d5c", fg: "#0d0d0e" };
  if (s.includes("night")) return { bg: "#2d3a66", fg: "#cfe0ff" };
  if (s.includes("morning")) return { bg: "#3a4a2a", fg: "#d6f0b0" };
  if (s.includes("day") || s.includes("afternoon") || s.includes("cont")) return { bg: "#243a4a", fg: "#b9e0f5" };
  return { bg: "#242428", fg: "#b6b9c0" };
}

export default function Breakdown({ project, setProject }) {
  const [title, setTitle] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [locations, setLocations] = useState([]);
  const [activeDay, setActiveDay] = useState(null);

  const breakdown = project?.breakdown;
  const projectId = project?.project_id;

  useEffect(() => {
    if (!projectId) return;
    listLocations(projectId).then(setLocations).catch(() => {});
  }, [projectId, breakdown]);

  async function onAnalyze() {
    setLoading(true); setError("");
    try {
      const result = await analyzeScript({ title: title || project?.title, scriptText, file, projectId });
      setProject({ ...result, project_id: result.project_id || projectId, title: result.breakdown?.title || title || project?.title });
      setShowUpload(false); setScriptText(""); setFile(null);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  // group scenes by day
  const scenes = breakdown?.scenes || [];
  const hasDays = scenes.some((s) => s.day != null);
  const dayKeys = hasDays
    ? [...new Set(scenes.map((s) => s.day ?? "?"))].sort((a, b) => a - b)
    : ["all"];
  const curDay = activeDay ?? dayKeys[0];
  const dayScenes = hasDays ? scenes.filter((s) => (s.day ?? "?") === curDay) : scenes;

  // find a researched location matching this day's scenes (no Parallel call — just read)
  function locForDay() {
    const names = new Set(dayScenes.map((s) => (s.location || "").toLowerCase()));
    return locations.find((l) => names.has((l.name || "").toLowerCase())) ||
           locations.find((l) => l.research); // fallback: any researched loc
  }
  const loc = locForDay();
  const research = loc?.research;
  const dayNote = breakdown?.day_notes?.[String(curDay)];

  // no breakdown yet → show the upload form
  if (!breakdown) {
    return (
      <div>
        <div className="ct-ptitle"><span className="num">01</span>Breakdown</div>
        <p className="ct-psub">Upload a script — the agent extracts every scene into structured data, grouped by shoot day.</p>
        <UploadForm {...{ title, setTitle, scriptText, setScriptText, setFile, onAnalyze, loading, error }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="ct-ptitle"><span className="num">01</span>Breakdown</div>
          <p className="ct-psub" style={{ marginBottom: 12 }}>The shoot, day by day — scenes, timing, cast, and logistics for the crew.</p>
        </div>
        <button className="ct-btn ghost tiny" onClick={() => setShowUpload((v) => !v)}>
          {showUpload ? "Close" : "↑ Upload revised script"}
        </button>
      </div>

      {showUpload && <UploadForm {...{ title, setTitle, scriptText, setScriptText, setFile, onAnalyze, loading, error }} revised />}

      {/* Day tabs */}
      {hasDays && (
        <div style={{ display: "flex", gap: 8, margin: "8px 0 18px", flexWrap: "wrap" }}>
          {dayKeys.map((d) => (
            <button key={d} className={`ct-tabbtn ${curDay === d ? "active" : ""}`} onClick={() => setActiveDay(d)}>
              Day {d}
            </button>
          ))}
        </div>
      )}

      {/* Call-sheet document card */}
      <div className="ct-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "24px 26px", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div className="disp" style={{ fontSize: 26, lineHeight: 1.05 }}>
              {(breakdown.title || project.title || "Untitled")} <span style={{ color: "#74777f" }}>— Call Sheet</span>
            </div>
            <div style={{ color: "#74777f", fontSize: 13, marginTop: 6 }}>
              {hasDays ? `Day ${curDay} of ${dayKeys.length}` : "All scenes"} — date not yet set
            </div>
          </div>
          {loc && (
            <div style={{ textAlign: "right", fontSize: 12.5, color: "#b6b9c0", maxWidth: 320 }}>
              <div>Location: <b style={{ color: "#fff" }}>{loc.name}</b></div>
            </div>
          )}
        </div>

        {dayNote && (
          <div style={{ margin: "0 26px 18px", padding: "12px 14px", background: "#242428", borderRadius: 10, fontSize: 13.5, color: "#e6e8ec" }}>
            {dayNote}
          </div>
        )}

        {/* Logistics from Parallel — only if this location was already researched */}
        {research ? (
          <div style={{ padding: "0 26px 8px", display: "grid", gap: 14 }}>
            {research.hours && <Box title="Hours" body={research.hours} />}
            {research.weather && <PlainList title="Weather notes" body={research.weather} />}
            {research.permits && <PlainList title="Permits" body={research.permits} />}
            {research.nearby_safety && <Box title="Safety & Emergency" body={research.nearby_safety} />}
          </div>
        ) : (
          <div style={{ margin: "0 26px 18px", fontSize: 12.5, color: "#74777f" }}>
            Confirm & research this location in the <b style={{ color: "#b6b9c0" }}>Plan</b> tab to see hours, permits, weather, and safety here.
          </div>
        )}

        {/* Scenes for this day */}
        <div style={{ padding: "10px 26px 6px" }}>
          <div className="ct-lbl">Scenes ({dayScenes.length})</div>
          {dayScenes.map((s, i) => {
            const ts = timeStyle(s.time_of_day);
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #2a2a2e", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="disp" style={{ fontSize: 14 }}>SC {s.number}</span>
                  <span style={{ color: "#b6b9c0", fontSize: 13 }}>{s.int_ext}. {s.location}</span>
                  <span style={{ ...timeTag, background: ts.bg, color: ts.fg }}>{s.time_of_day}</span>
                </div>
                <span style={{ color: "#74777f", fontSize: 12.5, whiteSpace: "nowrap" }}>{s.pages || "1"} pg</span>
              </div>
            );
          })}
        </div>

        {/* Cast for this day */}
        <div style={{ padding: "14px 26px 24px" }}>
          <div className="ct-lbl">Cast</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[...new Set(dayScenes.flatMap((s) => s.cast || []))].map((c) => (
              <span key={c} style={castChip}>{c} · 10h</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadForm({ title, setTitle, scriptText, setScriptText, setFile, onAnalyze, loading, error, revised }) {
  return (
    <div className="ct-card">
      {revised && <p className="ct-desc" style={{ marginTop: 0 }}>Re-analyze this production with a new script or updated details. This updates the current project.</p>}
      <span className="ct-lbl">Production title</span>
      <input className="ct-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Echo Signal" />
      <span className="ct-lbl">Paste script or production details</span>
      <textarea className="ct-ta" style={{ fontFamily: "monospace" }} value={scriptText}
        onChange={(e) => setScriptText(e.target.value)} placeholder="INT. COFFEE SHOP - DAY..." />
      <span className="ct-lbl">…or upload a PDF / .txt</span>
      <input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files[0] || null)} style={{ color: "#b6b9c0", fontSize: 13 }} />
      <div style={{ marginTop: 14 }}>
        <button className="ct-btn dark" onClick={onAnalyze} disabled={loading}>{loading ? "Analyzing…" : "Analyze script"}</button>
      </div>
      {error && <p style={{ color: "#ff5c5c" }}>{error}</p>}
    </div>
  );
}

function Box({ title, body }) {
  return (
    <div style={{ border: "1px solid #2a2a2e", borderRadius: 10, padding: "12px 14px", background: "#1d1d20" }}>
      <div className="ct-lbl" style={{ margin: "0 0 6px" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#e6e8ec", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}
function PlainList({ title, body }) {
  return (
    <div>
      <div className="ct-lbl" style={{ margin: "0 0 4px" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#b6b9c0", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

const timeTag = { fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999 };
const castChip = { fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 999, background: "#242428", border: "1px solid #2a2a2e" };
