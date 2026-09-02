import { useEffect, useState } from "react";
import { listLocations, addLocation, researchLocation, deleteLocation, detectedLocations } from "./api";

export default function Plan({ project }) {
  const projectId = project?.project_id;
  const [detected, setDetected] = useState([]);
  const [locations, setLocations] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState("");

  async function refresh() {
    if (!projectId) return;
    try {
      const [det, locs] = await Promise.all([
        detectedLocations(projectId),
        listLocations(projectId),
      ]);
      setDetected(det);
      setLocations(locs);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); }, [projectId]);

  async function onConfirm(d) {
    setConfirming(d.name); setError("");
    try {
      await addLocation(projectId, d.name, d.address || null);
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setConfirming(null); }
  }

  async function onResearch(id) {
    setBusyId(id); setError("");
    try { await researchLocation(id); await refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  }

  async function onDelete(id) {
    try { await deleteLocation(id); await refresh(); }
    catch (e) { setError(e.message); }
  }

  if (!projectId) {
    return <div style={{ color: "#888", textAlign: "center", padding: 60 }}>
      <h2>Plan</h2><p>Analyze a script in the Breakdown tab first.</p>
    </div>;
  }

  const unconfirmed = detected.filter((d) => !d.confirmed);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={card}>
        <h2 style={{ margin: 0 }}>2 · Plan</h2>
        <p style={{ color: "#666", marginTop: 4 }}>
          Confirm the locations you'll actually shoot at, then research each one to
          pull real filming logistics — hours, permits, and constraints — via Parallel.
        </p>
        {error && <p style={{ color: "crimson" }}>{error}</p>}

        {unconfirmed.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={fieldLabel}>Detected in script</div>
            {unconfirmed.map((d) => (
              <div key={d.name} style={detRow}>
                <div>
                  <strong>{d.name}</strong>
                  {d.address && <span style={{ color: "#888", fontSize: 13 }}> · {d.address}</span>}
                  {d.contact_name && (
                    <div style={{ color: "#888", fontSize: 12 }}>
                      Contact: {d.contact_name}
                      {d.contact_phone ? ` · ${d.contact_phone}` : ""}
                      {d.contact_email ? ` · ${d.contact_email}` : ""}
                    </div>
                  )}
                </div>
                <button style={button} onClick={() => onConfirm(d)} disabled={confirming === d.name}>
                  {confirming === d.name ? "Adding…" : "Confirm"}
                </button>
              </div>
            ))}
          </div>
        )}
        {unconfirmed.length === 0 && detected.length > 0 && (
          <p style={{ color: "#aaa", fontSize: 13 }}>All detected locations confirmed.</p>
        )}
        {detected.length === 0 && (
          <p style={{ color: "#aaa", fontSize: 13 }}>No locations detected in the script.</p>
        )}
      </section>

      {locations.map((loc) => (
        <section key={loc.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div>
              <h3 style={{ margin: 0 }}>{loc.name}</h3>
              {loc.address && <div style={{ color: "#888", fontSize: 13 }}>{loc.address}</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={ghost} onClick={() => onResearch(loc.id)} disabled={busyId === loc.id}>
                {busyId === loc.id ? "Researching…" : loc.research ? "Re-research" : "Research with Parallel"}
              </button>
              <button style={del} onClick={() => onDelete(loc.id)}>✕</button>
            </div>
          </div>

          {loc.research && (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {loc.research.summary && <p style={{ margin: 0 }}>{loc.research.summary}</p>}
              {loc.research.hours && <Field label="Hours" value={loc.research.hours} />}
              {loc.research.permits && <Field label="Permits" value={loc.research.permits} />}
              {loc.research.weather && <Field label="Weather" value={loc.research.weather} />}
              {loc.research.nearby_safety && <Field label="Nearby safety" value={loc.research.nearby_safety} />}
              {loc.research.constraints?.length > 0 && (
                <div>
                  <div style={fieldLabel}>Constraints</div>
                  <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                    {loc.research.constraints.map((c, i) => <li key={i} style={{ fontSize: 13 }}>{c}</li>)}
                  </ul>
                </div>
              )}
              {loc.research.sources?.length > 0 && (
                <div style={{ fontSize: 12, color: "#999" }}>
                  Sources: {loc.research.sources.slice(0, 3).map((s, i) => (
                    <a key={i} href={s} target="_blank" rel="noreferrer" style={{ marginRight: 8, color: "#4a7" }}>[{i + 1}]</a>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}

const card = { background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 20 };
const detRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f2f2f2" };
const button = { padding: "8px 16px", background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const ghost = { padding: "8px 14px", background: "#fff", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const del = { border: "none", background: "none", color: "#c00", cursor: "pointer", fontSize: 14 };
const fieldLabel = { fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 };
