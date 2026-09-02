import { useEffect, useState } from "react";
import { listLocations, addLocation, researchLocation, deleteLocation } from "./api";

export default function Plan({ project }) {
  const projectId = project?.project_id;
  const [locations, setLocations] = useState([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    if (!projectId) return;
    setLocations(await listLocations(projectId));
  }
  useEffect(() => { refresh(); }, [projectId]);

  async function onAdd() {
    if (!name.trim()) return;
    await addLocation(projectId, name.trim(), address.trim() || null);
    setName(""); setAddress("");
    await refresh();
  }

  async function onResearch(id) {
    setBusyId(id);
    try { await researchLocation(id); await refresh(); }
    finally { setBusyId(null); }
  }

  async function onDelete(id) {
    await deleteLocation(id);
    await refresh();
  }

  if (!projectId) {
    return <div style={{ color: "#888", textAlign: "center", padding: 60 }}>
      <h2>Plan</h2><p>Analyze a script in the Breakdown tab first.</p>
    </div>;
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={card}>
        <h2 style={{ margin: 0 }}>2 · Plan</h2>
        <p style={{ color: "#666", marginTop: 4 }}>
          Start with locations. Research each one to pull real filming logistics —
          hours, permits, and constraints — powered by Parallel.
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input style={{ ...input, flex: 2, minWidth: 200 }} placeholder="Location name (e.g. Tel Aviv Savidor Central Station)"
            value={name} onChange={(e) => setName(e.target.value)} />
          <input style={{ ...input, flex: 1, minWidth: 140 }} placeholder="City / address (optional)"
            value={address} onChange={(e) => setAddress(e.target.value)} />
          <button style={button} onClick={onAdd}>+ Add location</button>
        </div>
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
                    <a key={i} href={s} target="_blank" rel="noreferrer" style={{ marginRight: 8, color: "#4a7" }}>
                      [{i + 1}]
                    </a>
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
const input = { padding: 10, border: "1px solid #ddd", borderRadius: 8, fontSize: 14 };
const button = { padding: "10px 16px", background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 };
const ghost = { padding: "8px 14px", background: "#fff", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const del = { border: "none", background: "none", color: "#c00", cursor: "pointer", fontSize: 14 };
const fieldLabel = { fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 };
