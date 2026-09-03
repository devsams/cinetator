import { useEffect, useState } from "react";
import { listLocations, addLocation, researchLocation, deleteLocation, detectedLocations } from "./api";
import People from "./People";

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
      const [det, locs] = await Promise.all([detectedLocations(projectId), listLocations(projectId)]);
      setDetected(det); setLocations(locs);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); }, [projectId]);

  async function onConfirm(d) {
    setConfirming(d.name); setError("");
    try { await addLocation(projectId, d.name, d.address || null); await refresh(); }
    catch (e) { setError(e.message); } finally { setConfirming(null); }
  }
  async function onResearch(id) {
    setBusyId(id); setError("");
    try { await researchLocation(id); await refresh(); }
    catch (e) { setError(e.message); } finally { setBusyId(null); }
  }
  async function onDelete(id) {
    try { await deleteLocation(id); await refresh(); } catch (e) { setError(e.message); }
  }

  if (!projectId) {
    return (
      <div style={{ color: "#74777f", textAlign: "center", padding: 60 }}>
        <div className="disp" style={{ fontSize: 22 }}>Plan</div>
        <p style={{ marginTop: 8 }}>Analyze a script in the Breakdown tab first.</p>
      </div>
    );
  }

  const unconfirmed = detected.filter((d) => !d.confirmed);

  return (
    <div>
      <div className="ct-ptitle"><span className="num">02</span>Plan</div>
      <p className="ct-psub">Everyone and everywhere, with the real details — cast, crew, and location contacts, plus live filming logistics from Parallel.</p>

      {error && <p style={{ color: "#ff5c5c" }}>{error}</p>}

      {/* PEOPLE */}
      <div className="ct-secrow">
        <span className="dot" style={{ background: "#f5c518" }} />
        <h3>People</h3>
      </div>
      <People projectId={projectId} />

      {/* LOCATIONS */}
      <div className="ct-secrow" style={{ marginTop: 30 }}>
        <span className="dot" style={{ background: "#3ddc84" }} />
        <h3>Locations</h3>
      </div>

      <div className="ct-card">
        <p className="ct-desc" style={{ marginTop: 0, marginBottom: 4 }}>
          Confirm the locations you'll actually shoot at, then research each one with
          Parallel for real filming logistics — hours, permits, and constraints.
        </p>

        {unconfirmed.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <span className="ct-lbl">Detected in script</span>
            {unconfirmed.map((d) => (
              <div key={d.name} style={detRow}>
                <div>
                  <div className="disp" style={{ fontSize: 15 }}>{d.name}</div>
                  {d.address && <span style={{ color: "#74777f", fontSize: 12.5 }}>{d.address}</span>}
                  {d.contact_name && (
                    <div style={{ color: "#74777f", fontSize: 12 }}>
                      Contact: {d.contact_name}
                      {d.contact_phone ? ` · ${d.contact_phone}` : ""}
                      {d.contact_email ? ` · ${d.contact_email}` : ""}
                    </div>
                  )}
                </div>
                <button className="ct-btn dark tiny" onClick={() => onConfirm(d)} disabled={confirming === d.name}>
                  {confirming === d.name ? "Adding…" : "Confirm"}
                </button>
              </div>
            ))}
          </div>
        )}
        {unconfirmed.length === 0 && detected.length > 0 && (
          <p style={{ color: "#74777f", fontSize: 13, marginTop: 12 }}>All detected locations confirmed.</p>
        )}
        {detected.length === 0 && (
          <p style={{ color: "#74777f", fontSize: 13, marginTop: 12 }}>No locations detected in the script.</p>
        )}
      </div>

      {locations.map((loc) => (
        <div key={loc.id} className="ct-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
            <div>
              <div className="disp" style={{ fontSize: 19 }}>{loc.name}</div>
              {loc.address && <div style={{ color: "#74777f", fontSize: 13, marginTop: 2 }}>{loc.address}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button className="ct-btn ghost tiny" onClick={() => onResearch(loc.id)} disabled={busyId === loc.id}>
                {busyId === loc.id ? "Researching…" : loc.research ? "Re-research" : "Research with Parallel"}
              </button>
              <button className="ct-btn ghost tiny" style={{ color: "#ff5c5c" }} onClick={() => onDelete(loc.id)}>✕</button>
            </div>
          </div>

          {loc.research && (
            <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
              {loc.research.summary && (
                <p style={{ margin: 0, color: "#e6e8ec", fontSize: 13.5, lineHeight: 1.55 }}>{loc.research.summary}</p>
              )}
              {loc.research.hours && <F label="Hours" v={loc.research.hours} />}
              {loc.research.permits && <F label="Permits" v={loc.research.permits} />}
              {loc.research.weather && <F label="Weather" v={loc.research.weather} />}
              {loc.research.nearby_safety && <F label="Nearby safety" v={loc.research.nearby_safety} />}
              {loc.research.constraints?.length > 0 && (
                <div>
                  <span className="ct-lbl">Constraints</span>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#b6b9c0" }}>
                    {loc.research.constraints.map((c, i) => (
                      <li key={i} style={{ fontSize: 13, marginBottom: 3, lineHeight: 1.5 }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {loc.research.sources?.length > 0 && (
                <div style={{ fontSize: 11.5, color: "#74777f" }}>
                  Sources:{" "}
                  {loc.research.sources.slice(0, 3).map((s, i) => (
                    <a key={i} href={s} target="_blank" rel="noreferrer" style={{ marginRight: 10, color: "#f5c518", fontWeight: 600 }}>
                      [{i + 1}]
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function F({ label, v }) {
  return (
    <div>
      <span className="ct-lbl">{label}</span>
      <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", color: "#b6b9c0", lineHeight: 1.55, marginTop: 4 }}>{v}</div>
    </div>
  );
}

const detRow = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "12px 0", borderBottom: "1px solid #2a2a2e", gap: 12,
};
