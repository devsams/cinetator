import { useEffect, useState } from "react";
import { listProjects, createProject, setProjectStatus, deleteProject } from "./api";

const META = {
  live:        { label: "● LIVE",       tint: "#3ddc84", kind: "Live" },
  in_progress: { label: "◷ PLANNING",   tint: "#f5c518", kind: "In progress" },
  wrapped:     { label: "✓ WRAPPED",    tint: "#5b9dff", kind: "Archive" },
  abandoned:   { label: "✕ ABANDONED",  tint: "#74777f", kind: "Archive" },
};

export default function Home({ onOpen, onNew }) {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() { try { setProjects(await listProjects()); } catch (e) { setError(e.message); } }
  useEffect(() => { refresh(); }, []);

  async function onCreate() {
    setBusy(true); setError("");
    try { const p = await createProject("Untitled Production"); onNew(p); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function move(id, status, e) { e.stopPropagation(); await setProjectStatus(id, status); await refresh(); }
  async function remove(id, e) {
    e.stopPropagation();
    if (window.confirm("Delete this production? This can't be undone.")) { await deleteProject(id); await refresh(); }
  }
  const st = (p) => p.status || "in_progress";
  const totalDays = projects.reduce((s, p) => s + (p.shoot_days || 0), 0);
  const totalPeople = projects.reduce((s, p) => s + (p.people || 0), 0);

  function Card({ p }) {
    const m = META[st(p)] || META.in_progress;
    const pct = p.shoot_days ? Math.round(p.days_locked / p.shoot_days * 100) : 0;
    const isArch = ["wrapped", "abandoned"].includes(st(p));
    return (
      <div className="ct-pcard" style={isArch ? { opacity: st(p) === "abandoned" ? .6 : .8 } : {}} onClick={() => onOpen(p)}>
        <div className="kind">Production <span className="ct-statpill" style={{ background: m.tint + "22", color: m.tint }}>{m.label}</span></div>
        <div className="p-title">{p.title || "Untitled"}</div>
        <div className="ct-pbar"><i style={{ width: `${pct}%`, background: m.tint }} /></div>
        <div className="ct-pmeta">
          <span><b>{p.scenes}</b>Scenes</span>
          <span><b>{p.days_locked}/{p.shoot_days}</b>Days</span>
          <span><b>{p.people}</b>People</span>
        </div>
        <div className="ct-pfoot">
          {st(p) !== "live" && <button className="ct-btn soft tiny" onClick={(e) => move(p.id, "live", e)}>→ Live</button>}
          {st(p) !== "in_progress" && <button className="ct-btn soft tiny" onClick={(e) => move(p.id, "in_progress", e)}>→ In progress</button>}
          {st(p) !== "wrapped" && <button className="ct-btn soft tiny" onClick={(e) => move(p.id, "wrapped", e)}>✓ Wrapped</button>}
          {st(p) !== "abandoned" && <button className="ct-btn soft tiny" onClick={(e) => move(p.id, "abandoned", e)}>Abandon</button>}
          <span style={{ marginLeft: "auto", color: "#f5c518", fontSize: 12.5, fontWeight: 700 }}>Open →</span>
        </div>
      </div>
    );
  }
  function Section({ title, tint, rows }) {
    if (rows.length === 0) return null;
    return (
      <div>
        <div className="ct-secrow"><span className="dot" style={{ background: tint }} /><h3>{title}</h3><span className="ct-count">{rows.length}</span></div>
        <div className="ct-grid">{rows.map((p) => <Card key={p.id} p={p} />)}</div>
      </div>
    );
  }

  const byStatus = (s) => projects.filter((p) => st(p) === s);
  const archived = projects.filter((p) => ["wrapped", "abandoned"].includes(st(p)));

  return (
    <div className="ct-page">
      <div className="ct-hero">
        <h1>Your Productions</h1>
        <p>Break down scripts, research locations with Parallel, and coordinate every shoot — from first draft to shoot-ready.</p>
        <div className="ct-hero-stats">
          <div><div className="n">{projects.length}</div><div className="l">Productions</div></div>
          <div><div className="n">{totalDays}</div><div className="l">Shoot days</div></div>
          <div><div className="n">{totalPeople}</div><div className="l">People</div></div>
        </div>
        <button className="ct-btn dark" style={{ position: "absolute", right: 34, bottom: 30, zIndex: 2 }}
          onClick={onCreate} disabled={busy}>{busy ? "Creating…" : "+ New production"}</button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {projects.length === 0 && (
        <div className="ct-empty" style={{ marginTop: 24 }}>
          <div style={{ fontSize: 40 }}>🎬</div>
          <h3 className="disp" style={{ margin: "12px 0 4px", fontSize: 20 }}>No productions yet</h3>
          <p style={{ color: "#74777f", margin: "0 0 16px" }}>Create one and upload a script to begin.</p>
          <button className="ct-btn dark" onClick={onCreate}>+ New production</button>
        </div>
      )}
      <Section title="Live" tint="#3ddc84" rows={byStatus("live")} />
      <Section title="In progress" tint="#f5c518" rows={byStatus("in_progress")} />
      <Section title="Archive" tint="#74777f" rows={archived} />
    </div>
  );
}
