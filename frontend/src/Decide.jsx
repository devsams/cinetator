import { useEffect, useState } from "react";
import { getDecide, lockDate, unlockDate, autoLinkCoordinators, getResponses } from "./api";

export default function Decide({ projectId }) {
  const [days, setDays] = useState([]);
  const [roster, setRoster] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  async function refresh() {
    if (!projectId) return;
    try {
      await autoLinkCoordinators(projectId);
      const [dec, resp] = await Promise.all([getDecide(projectId), getResponses(projectId)]);
      setDays(dec);
      setRoster(resp);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); }, [projectId]);

  async function onLock(dayId, date) {
    setBusy(dayId + date);
    try { await lockDate(dayId, date); await refresh(); } finally { setBusy(null); }
  }
  async function onUnlock(dayId) {
    setBusy(dayId + "unlock");
    try { await unlockDate(dayId); await refresh(); } finally { setBusy(null); }
  }

  if (!projectId) return null;
  const rosterByDay = Object.fromEntries(roster.map((r) => [r.shoot_day_id, r]));

  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Responses & decide</h3>
        <button style={ghost} onClick={refresh}>↻ Refresh</button>
      </div>
      <p style={{ color: "#666", marginTop: 4 }}>
        See who's responded, then lock the date that works for the most people and the location.
      </p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {days.map((d) => {
        const r = rosterByDay[d.shoot_day_id];
        return (
          <div key={d.shoot_day_id} style={dayBox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Day {d.day_number}{d.location_name ? ` — ${d.location_name}` : ""}</strong>
              {r && <span style={{ fontSize: 12, color: "#999" }}>{r.responded_count}/{r.total} responded</span>}
            </div>
            {d.coordinator_name && (
              <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>Location coordinator: {d.coordinator_name}</div>
            )}

            {/* Who responded */}
            {r && (
              <div style={{ marginTop: 10 }}>
                <div style={fieldLabel}>Who responded</div>
                <div style={{ display: "grid", gap: 4 }}>
                  {r.rows.map((row) => (
                    <div key={row.person_id} style={rosterRow}>
                      <span>
                        {row.responded
                          ? <span style={{ color: "#181" }}>✓</span>
                          : <span style={{ color: "#c80" }}>⏳</span>}
                        {" "}{row.name}
                        <span style={{ color: "#aaa", fontSize: 11 }}> · {row.role_type}</span>
                      </span>
                      <span style={{ fontSize: 12, color: "#777" }}>
                        {row.responded
                          ? (row.picked_dates.length
                              ? `can do: ${row.picked_dates.join(", ")}`
                              : (row.suggested_dates.length ? `suggested: ${row.suggested_dates.join(", ")}` : "none of the dates"))
                          : "waiting"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decide */}
            {d.locked_date ? (
              <div style={lockedBanner}>
                <span>✓ Locked for <strong>{d.locked_date}</strong></span>
                <button style={ghost} onClick={() => onUnlock(d.shoot_day_id)} disabled={busy === d.shoot_day_id + "unlock"}>Unlock</button>
              </div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <div style={fieldLabel}>Pick the date</div>
                {d.candidate_dates.length === 0 && <div style={{ color: "#aaa", fontSize: 13 }}>No candidate dates set.</div>}
                {d.tally.map((t) => {
                  const isRec = t.date === d.recommended_date;
                  const locBad = t.location_available === false;
                  return (
                    <div key={t.date} style={{ ...dateRow, ...(isRec ? recRow : {}), ...(locBad ? badRow : {}) }}>
                      <div>
                        <strong>{t.date}</strong>
                        {isRec && <span style={recTag}>Recommended</span>}
                        <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>
                          {t.available_count} available{t.available_names.length ? `: ${t.available_names.join(", ")}` : ""}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 2 }}>
                          {t.location_available === true && <span style={{ color: "#181" }}>Location available ✓</span>}
                          {t.location_available === false && <span style={{ color: "#c00" }}>Location NOT available ✕</span>}
                          {t.location_available === null && <span style={{ color: "#999" }}>Location: awaiting response</span>}
                        </div>
                      </div>
                      <button style={{ ...lockBtn, ...(locBad ? disabledBtn : {}) }} disabled={locBad || busy === d.shoot_day_id + t.date}
                        onClick={() => onLock(d.shoot_day_id, t.date)}>
                        {busy === d.shoot_day_id + t.date ? "Locking…" : "Lock this date"}
                      </button>
                    </div>
                  );
                })}
                {d.suggested_alternates.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#a60" }}>
                    Suggested alternates: {d.suggested_alternates.map((s) => `${s.date} (${s.by})`).join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

const card = { background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 20, marginTop: 24 };
const dayBox = { border: "1px solid #eee", borderRadius: 10, padding: 14, marginTop: 14 };
const rosterRow = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "3px 0" };
const dateRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, border: "1px solid #eee", borderRadius: 8 };
const recRow = { borderColor: "#181", background: "#f2fbf4" };
const badRow = { opacity: 0.7, background: "#fdf3f3" };
const recTag = { marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#fff", background: "#181", borderRadius: 6, padding: "2px 6px" };
const lockedBanner = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: 12, background: "#f2fbf4", border: "1px solid #bde5c8", borderRadius: 8, fontSize: 14 };
const lockBtn = { padding: "8px 14px", background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const disabledBtn = { background: "#ccc", cursor: "not-allowed" };
const ghost = { padding: "6px 12px", background: "#fff", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const fieldLabel = { fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 };
