import { useEffect, useState } from "react";
import { analyzeScript, listLocations, listUploads, getUpload, reapplyUpload } from "./api";

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
  const [startMode, setStartMode] = useState(null); // null | "script" | "details"
  const [title, setTitle] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState(null); // null | "revise" | "add-details"
  const [locations, setLocations] = useState([]);
  const [activeDay, setActiveDay] = useState(null);
  const [addResult, setAddResult] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [viewingUpload, setViewingUpload] = useState(null);

  const breakdown = project?.breakdown;
  const projectId = project?.project_id;

  useEffect(() => {
    if (!projectId) return;
    listLocations(projectId).then(setLocations).catch(() => {});
  }, [projectId, breakdown]);

  async function refreshUploads() {
    if (!projectId) return;
    try { setUploads(await listUploads(projectId)); } catch {}
  }
  useEffect(() => { refreshUploads(); }, [projectId, breakdown]);

  async function onViewUpload(id) {
    try { setViewingUpload(await getUpload(id)); } catch (e) { setError(e.message); }
  }
  async function onUseUpload(u) {
    const msg = u.mode === "script"
      ? "This will replace your current scenes with what was in this earlier upload. Continue?"
      : "This will re-import this upload's people/locations into the current production. Continue?";
    if (!window.confirm(msg)) return;
    setLoading(true); setError("");
    try {
      const result = await reapplyUpload(u.id);
      if (result.breakdown) {
        setProject({ project_id: projectId, breakdown: result.breakdown, title: result.breakdown?.title || project.title });
      } else {
        setAddResult(result);
      }
      await refreshUploads();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function onAnalyze(mode) {
    setLoading(true); setError(""); setAddResult(null);
    try {
      const result = await analyzeScript({
        title: title || project?.title, scriptText, file, mode,
        projectId: mode === "details" && projectId ? projectId : (panel === "revise" ? projectId : undefined),
      });
      if (mode === "details" && projectId) {
        // merged into existing project — refetch breakdown to reflect new locations, keep scenes
        setAddResult(result);
        // re-pull the merged breakdown from the analyze response shape used for existing projects
      } else {
        setProject({
          ...result,
          project_id: result.project_id || projectId,
          title: result.breakdown?.title || title || project?.title,
        });
      }
      setPanel(null); setScriptText(""); setFile(null); setStartMode(null);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  const scenes = breakdown?.scenes || [];
  const hasDays = scenes.some((s) => s.day != null);
  const dayKeys = hasDays ? [...new Set(scenes.map((s) => s.day ?? "?"))].sort((a, b) => a - b) : (scenes.length ? ["all"] : []);
  const curDay = activeDay ?? dayKeys[0];
  const dayScenes = hasDays ? scenes.filter((s) => (s.day ?? "?") === curDay) : scenes;

  function locForDay() {
    const names = new Set(dayScenes.map((s) => (s.location || "").toLowerCase()));
    return locations.find((l) => names.has((l.name || "").toLowerCase())) || locations.find((l) => l.research);
  }
  const loc = locForDay();
  const research = loc?.research;
  const dayNote = breakdown?.day_notes?.[String(curDay)];

  // ---------- No project yet: choose how to start ----------
  if (!breakdown) {
    return (
      <div>
        <div className="ct-ptitle"><span className="num">01</span>Breakdown</div>
        <p className="ct-psub">How would you like to start?</p>

        {!startMode ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <button style={choiceCard} onClick={() => setStartMode("script")}>
              <div className="disp" style={{ fontSize: 18 }}>I have a script</div>
              <p style={{ color: "#74777f", fontSize: 13, marginTop: 6 }}>
                Upload a PDF or paste the script — we'll break it down into scenes, cast, locations, and props.
              </p>
            </button>
            <button style={choiceCard} onClick={() => setStartMode("details")}>
              <div className="disp" style={{ fontSize: 18 }}>I have production details</div>
              <p style={{ color: "#74777f", fontSize: 13, marginTop: 6 }}>
                No script yet — just a cast/crew list, location list, or contact sheet. We'll build your people and locations directly.
              </p>
            </button>
          </div>
        ) : (
          <div className="ct-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="disp" style={{ fontSize: 16 }}>
                {startMode === "script" ? "Upload your script" : "Upload production details"}
              </div>
              <button style={{ background: "none", border: "none", color: "#74777f", cursor: "pointer", fontSize: 12 }} onClick={() => setStartMode(null)}>← Back</button>
            </div>
            <span className="ct-lbl">Production title</span>
            <input className="ct-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Echo Signal" />
            <span className="ct-lbl">{startMode === "script" ? "Paste script" : "Paste cast/crew/location details"}</span>
            <textarea className="ct-ta" style={{ fontFamily: "monospace" }} value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder={startMode === "script" ? "INT. COFFEE SHOP - DAY..." : "CAST\\nAlex Miller — Lead — alex@example.com — +1 555 0100\\n..."} />
            <span className="ct-lbl">…or upload a PDF / .txt</span>
            <input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files[0] || null)} style={{ color: "#b6b9c0", fontSize: 13 }} />
            <div style={{ marginTop: 14 }}>
              <button className="ct-btn dark" onClick={() => onAnalyze(startMode)} disabled={loading}>
                {loading ? "Analyzing…" : startMode === "script" ? "Analyze script" : "Import details"}
              </button>
            </div>
            {error && <p style={{ color: "#ff5c5c" }}>{error}</p>}
          </div>
        )}
      </div>
    );
  }

  // ---------- Existing project ----------
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="ct-ptitle"><span className="num">01</span>Breakdown</div>
          <p className="ct-psub" style={{ marginBottom: 12 }}>The shoot, day by day — scenes, timing, cast, and logistics for the crew.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ct-btn ghost tiny" onClick={() => setPanel(panel === "add-details" ? null : "add-details")}>
            {panel === "add-details" ? "Close" : "+ Add production details"}
          </button>
          <button className="ct-btn ghost tiny" onClick={() => setPanel(panel === "revise" ? null : "revise")}>
            {panel === "revise" ? "Close" : "↑ Upload revised script"}
          </button>
          <button className="ct-btn ghost tiny" onClick={() => setPanel(panel === "history" ? null : "history")}>
            {panel === "history" ? "Close" : `History (${uploads.length})`}
          </button>
          <button className="ct-btn dark tiny" onClick={() => setPanel(panel === "add-scene" ? null : "add-scene")}>
            {panel === "add-scene" ? "Close" : "+ Add a day / scene"}
          </button>
        </div>
      </div>

      {panel === "add-scene" && (
        <div className="ct-card">
          <p className="ct-desc" style={{ marginTop: 0 }}>
            Add a new shoot day or a scene to an existing day — nothing else changes.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><span className="ct-lbl">Day number</span>
              <input type="number" className="ct-input" value={newScene.day} onChange={(e) => setNewScene({ ...newScene, day: e.target.value })} /></div>
            <div><span className="ct-lbl">INT / EXT</span>
              <select className="ct-select" style={{ width: "100%", background: "#242428", color: "#fff", border: "1px solid #35353b", borderRadius: 9, padding: "10px 12px" }}
                value={newScene.int_ext} onChange={(e) => setNewScene({ ...newScene, int_ext: e.target.value })}>
                <option value="EXT">EXT</option><option value="INT">INT</option>
              </select></div>
            <div><span className="ct-lbl">Time of day</span>
              <input className="ct-input" value={newScene.time_of_day} onChange={(e) => setNewScene({ ...newScene, time_of_day: e.target.value })} placeholder="DAY / NIGHT / SUNSET…" /></div>
          </div>
          <span className="ct-lbl">Location</span>
          <input className="ct-input" value={newScene.location} onChange={(e) => setNewScene({ ...newScene, location: e.target.value })} placeholder="e.g. Rooftop Deck" />
          <span className="ct-lbl">Cast (comma-separated)</span>
          <input className="ct-input" value={newScene.cast} onChange={(e) => setNewScene({ ...newScene, cast: e.target.value })} placeholder="Alex, Elena" />
          <span className="ct-lbl">Props (comma-separated)</span>
          <input className="ct-input" value={newScene.props} onChange={(e) => setNewScene({ ...newScene, props: e.target.value })} placeholder="camera, timer" />
          <div style={{ marginTop: 14 }}>
            <button className="ct-btn dark" onClick={onAddScene} disabled={sceneSaving}>{sceneSaving ? "Adding…" : "Add scene"}</button>
          </div>
          {sceneError && <p style={{ color: "#ff5c5c" }}>{sceneError}</p>}
        </div>
      )}

      {panel === "history" && (
        <div className="ct-card">
          <div className="disp" style={{ fontSize: 16, marginBottom: 4 }}>Previous uploads</div>
          <p className="ct-desc" style={{ marginTop: 0 }}>Everything ever uploaded to this production, most recent first.</p>
          {uploads.length === 0 && <p style={{ color: "#74777f", fontSize: 13 }}>No uploads yet.</p>}
          {uploads.map((u) => (
            <div key={u.id} style={uploadRow}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ ...modeTag, ...(u.mode === "script" ? modeTagScript : modeTagDetails) }}>
                    {u.mode === "script" ? "Script" : "Details"}
                  </span>
                  <span style={{ fontSize: 12, color: "#74777f" }}>{fmtDate(u.created_at)}</span>
                  {u.filename && <span style={{ fontSize: 11.5, color: "#74777f" }}>· {u.filename}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: "#b6b9c0", marginTop: 4 }}>{u.preview}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="ct-btn ghost tiny" onClick={() => onViewUpload(u.id)}>View</button>
                <button className="ct-btn dark tiny" onClick={() => onUseUpload(u)} disabled={loading}>Use this</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingUpload && (
        <div className="ct-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div className="disp" style={{ fontSize: 15 }}>{viewingUpload.mode === "script" ? "Script" : "Details"} — {fmtDate(viewingUpload.created_at)}</div>
            <button style={{ background: "none", border: "none", color: "#74777f", cursor: "pointer", fontSize: 12 }} onClick={() => setViewingUpload(null)}>✕ Close</button>
          </div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, color: "#b6b9c0", background: "#1d1d20", padding: 14, borderRadius: 8, maxHeight: 320, overflowY: "auto", fontFamily: "monospace" }}>
            {viewingUpload.text}
          </pre>
        </div>
      )}

      {panel === "revise" && (
        <div className="ct-card">
          <p className="ct-desc" style={{ marginTop: 0 }}>Re-analyze this production with a new script. This replaces the current breakdown.</p>
          <span className="ct-lbl">Production title</span>
          <input className="ct-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={project.title} />
          <span className="ct-lbl">Paste script or production details</span>
          <textarea className="ct-ta" style={{ fontFamily: "monospace" }} value={scriptText} onChange={(e) => setScriptText(e.target.value)} placeholder="INT. COFFEE SHOP - DAY..." />
          <span className="ct-lbl">…or upload a PDF / .txt</span>
          <input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files[0] || null)} style={{ color: "#b6b9c0", fontSize: 13 }} />
          <div style={{ marginTop: 14 }}>
            <button className="ct-btn dark" onClick={() => onAnalyze("script")} disabled={loading}>{loading ? "Analyzing…" : "Analyze script"}</button>
          </div>
          {error && <p style={{ color: "#ff5c5c" }}>{error}</p>}
        </div>
      )}

      {panel === "add-details" && (
        <div className="ct-card">
          <p className="ct-desc" style={{ marginTop: 0 }}>
            Add more cast, crew, or locations without touching your existing scenes — e.g. a late-arriving cast list or updated location contacts.
          </p>
          <span className="ct-lbl">Paste or upload details</span>
          <textarea className="ct-ta" style={{ fontFamily: "monospace" }} value={scriptText} onChange={(e) => setScriptText(e.target.value)}
            placeholder="CAST&#10;Alex Miller — Lead — alex@example.com — +1 555 0100" />
          <input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files[0] || null)} style={{ color: "#b6b9c0", fontSize: 13, marginTop: 8 }} />
          <div style={{ marginTop: 14 }}>
            <button className="ct-btn dark" onClick={() => onAnalyze("details")} disabled={loading}>{loading ? "Importing…" : "Add to production"}</button>
          </div>
          {error && <p style={{ color: "#ff5c5c" }}>{error}</p>}
          {addResult && (
            <p style={{ color: "#3ddc84", fontSize: 13, marginTop: 10 }}>
              ✓ Added {addResult.added_people} new {addResult.added_people === 1 ? "person" : "people"}. Check the Plan tab.
            </p>
          )}
        </div>
      )}

      {hasDays && (
        <div style={{ display: "flex", gap: 8, margin: "8px 0 18px", flexWrap: "wrap" }}>
          {dayKeys.map((d) => (
            <button key={d} className={`ct-tabbtn ${curDay === d ? "active" : ""}`} onClick={() => setActiveDay(d)}>Day {d}</button>
          ))}
        </div>
      )}

      {scenes.length === 0 ? (
        <div className="ct-card" style={{ color: "#74777f", fontSize: 13.5 }}>
          No scenes yet — this production started from details only. Use "Upload revised script" above if you get a script later.
        </div>
      ) : (
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
            <div style={{ margin: "0 26px 18px", padding: "12px 14px", background: "#242428", borderRadius: 10, fontSize: 13.5, color: "#e6e8ec" }}>{dayNote}</div>
          )}

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

          <div style={{ padding: "14px 26px 24px" }}>
            <div className="ct-lbl">Cast</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[...new Set(dayScenes.flatMap((s) => s.cast || []))].map((c) => (
                <span key={c} style={castChip}>{c} · 10h</span>
              ))}
            </div>
          </div>
        </div>
      )}
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

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const uploadRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid #2a2a2e" };
const modeTag = { fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999 };
const modeTagScript = { background: "#132033", color: "#5b9dff" };
const modeTagDetails = { background: "#2a2410", color: "#f5c518" };
const choiceCard = { textAlign: "left", background: "#161618", border: "1px solid #2a2a2e", borderRadius: 14, padding: 20, cursor: "pointer" };
const timeTag = { fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999 };
const castChip = { fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 999, background: "#242428", border: "1px solid #2a2a2e" };
