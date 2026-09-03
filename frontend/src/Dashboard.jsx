import { useEffect, useState } from "react";
import {
  getDecide, getResponses, getActivity, autoLinkCoordinators,
  lockDate, unlockDate, remindPeople, markStatus, addCandidate,
} from "./api";

const AV_COLORS = ["#7c5cff","#e0645a","#2f9e6b","#c88a2a","#3a7bd5","#8a63d2","#c8722a","#2f9e88","#d2637f"];
function initials(n){return (n||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();}
function colorFor(id){let h=0;for(const c of (id||"")) h=(h*31+c.charCodeAt(0))%AV_COLORS.length;return AV_COLORS[h];}

export default function Dashboard({ project }) {
  const projectId = project?.project_id;
  const [decide, setDecide] = useState([]);
  const [roster, setRoster] = useState([]);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  async function refresh() {
    if (!projectId) return;
    try {
      await autoLinkCoordinators(projectId);
      const [d, r, a] = await Promise.all([getDecide(projectId), getResponses(projectId), getActivity(projectId)]);
      setDecide(d); setRoster(r); setActivity(a);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); }, [projectId]);

  async function act(key, fn) {
    setBusy(key); setError("");
    try { await fn(); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(null); }
  }
  const confirmSend = (m) => window.confirm(m);

  if (!projectId) return (
    <div style={{ color: "#74777f", textAlign: "center", padding: 70 }}>
      <h2>Dashboard</h2><p>Analyze a script and set up your schedule first.</p>
    </div>
  );

  const rosterByDay = Object.fromEntries(roster.map((r) => [r.shoot_day_id, r]));
  const totalDays = decide.length;
  const lockedDays = decide.filter((d) => d.locked_date).length;
  const allRows = roster.flatMap((r) => r.rows);
  const uniquePeople = new Set(allRows.map((x) => x.person_id)).size;
  const respondedRate = allRows.length ? Math.round(allRows.filter((x) => x.responded).length / allRows.length * 100) : 0;
  const lockPct = totalDays ? Math.round(lockedDays / totalDays * 100) : 0;
  const pendingIds = [...new Set(roster.flatMap((r) => r.rows.filter((x) => !x.responded).map((x) => x.person_id)))];

  // attention
  const attention = [];
  decide.forEach((d) => {
    if (d.locked_date) return;
    const coordBlocked = d.coordinator_name && d.tally.some((t) => t.location_available !== true);
    if (coordBlocked) attention.push({ kind: "loc", day: d });
    d.suggested_alternates.forEach((s) => attention.push({ kind: "alt", day: d, date: s.date, by: s.by }));
  });
  if (pendingIds.length) attention.push({ kind: "pending" });

  const statusLine = lockedDays === totalDays && totalDays > 0
    ? "All shoot days are locked. 🎬"
    : `${lockedDays} of ${totalDays} days locked.` + (attention.length ? ` ${attention.length} item${attention.length>1?"s":""} need attention.` : "");

  const R = 42, C = 2 * Math.PI * R;

  return (
    <div style={{ fontFamily: "inherit" }}>
      {/* HERO */}
      <div style={hero}>
        <div>
          <h1 style={{ margin: "0 0 3px", fontSize: 20, letterSpacing: "-.02em" }}>
            {project.breakdown?.title || "Your production"}
          </h1>
          <div style={{ color: "#b6b9c0", fontSize: 14, marginTop: 6 }}>{statusLine}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", gap: 26 }}>
            <Mini n={`${respondedRate}%`} l="Responded" />
            <Mini n={uniquePeople} l="People" />
            <Mini n={attention.length} l="To action" color={attention.length ? "#e08b00" : undefined} />
          </div>
          <div style={{ position: "relative", width: 96, height: 96 }}>
            <svg width="96" height="96" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="48" cy="48" r={R} fill="none" stroke="#edeef1" strokeWidth="9" />
              <circle cx="48" cy="48" r={R} fill="none" stroke="#0ca750" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C - (lockPct / 100) * C} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 750 }}>{lockPct}%</div>
              <div style={{ fontSize: 10, color: "#74777f", textTransform: "uppercase", letterSpacing: .5 }}>locked</div>
            </div>
          </div>
        </div>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {/* ATTENTION */}
      {attention.length > 0 && (
        <div style={attnCard}>
          <div style={attnTitle}>Needs attention · {attention.length}</div>
          {attention.map((a, i) => (
            <div key={i} style={{ ...attn, borderTop: i ? "1px solid #ecedf1" : "none" }}>
              {a.kind === "loc" && <>
                <div style={{ ...ic, background: "#2a1414" }}>🔒</div>
                <div style={{ flex: 1, fontSize: 13.5 }}>Day {a.day.day_number} can't lock yet
                  <div style={sub}>Location {a.day.coordinator_name} hasn't confirmed a date.</div>
                </div>
                <button style={btnSoftBlueTiny} onClick={() => {
                  const c = rosterByDay[a.day.shoot_day_id]?.rows.find((x) => x.name === a.day.coordinator_name);
                  if (c && confirmSend(`Remind ${a.day.coordinator_name}?`)) act("rc"+i, () => remindPeople(projectId, [c.person_id]));
                }}>Remind {a.day.coordinator_name?.split(" ")[0]}</button>
              </>}
              {a.kind === "alt" && <>
                <div style={{ ...ic, background: "#2a2410" }}>↩</div>
                <div style={{ flex: 1, fontSize: 13.5 }}>{a.by} suggested {a.date} for Day {a.day.day_number}
                  <div style={sub}>Turn it into a candidate date for everyone.</div>
                </div>
                <button style={btnSoftBlueTiny} onClick={() => act("ac"+i, () => addCandidate(a.day.shoot_day_id, a.date))}>Add {a.date}</button>
              </>}
              {a.kind === "pending" && <>
                <div style={{ ...ic, background: "#2a2410" }}>⏳</div>
                <div style={{ flex: 1, fontSize: 13.5 }}>{pendingIds.length} people haven't responded
                  <div style={sub}>Send a one-click reminder to everyone still pending.</div>
                </div>
                <button style={btnBlueTiny} disabled={busy === "nudge"} onClick={() => {
                  if (confirmSend(`Send a reminder to ${pendingIds.length} pending people?`)) act("nudge", () => remindPeople(projectId, pendingIds));
                }}>{busy === "nudge" ? "Sending…" : `Nudge all (${pendingIds.length})`}</button>
              </>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 4px 12px" }}>
        <div style={secLabel}>Shoot days</div>
        <button style={btnSoftTiny} onClick={refresh}>↻ Refresh</button>
      </div>

      {/* DAY CARDS */}
      {decide.map((d) => {
        const r = rosterByDay[d.shoot_day_id];
        const rows = r?.rows || [];
        const confirmed = rows.filter((x) => x.responded && x.picked_dates.length).length;
        const declined = rows.filter((x) => x.responded && !x.picked_dates.length).length;
        const pending = rows.filter((x) => !x.responded).length;
        return (
          <div key={d.shoot_day_id} style={{ ...day, ...(d.locked_date ? dayLocked : {}) }}>
            <div style={{ ...dayTop, ...(d.locked_date ? { background: "linear-gradient(0deg,#fff,#f4fcf7)" } : {}) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ ...daynum, ...(d.locked_date ? { background: "#0ca750", color: "#fff" } : {}) }}>{d.day_number}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.01em" }}>{d.location_name || "No location set"}</div>
                  {d.coordinator_name && <div style={{ color: "#74777f", fontSize: 12.5, marginTop: 2 }}>Coordinator: {d.coordinator_name}</div>}
                </div>
              </div>
              {d.locked_date ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={pillGreen}>✓ {d.locked_date}</span>
                  <button style={btnSoftTiny} onClick={() => act("ul"+d.shoot_day_id, () => unlockDate(d.shoot_day_id))}>Unlock</button>
                </div>
              ) : <span style={pillAmber}>◷ Not locked</span>}
            </div>

            <div style={{ padding: "4px 22px 20px" }}>
              {!d.locked_date && (
                <div style={opts}>
                  {d.tally.length === 0 && <div style={{ color: "#74777f", fontSize: 13, padding: "8px 0" }}>No candidate dates set. Add them in the Schedule tab.</div>}
                  {d.tally.map((t) => {
                    const best = t.date === d.recommended_date;
                    const bad = t.location_available === false;
                    const pend = t.location_available === null;
                    const totalP = rows.length || 1;
                    return (
                      <div key={t.date} style={{ ...opt, ...(best ? optBest : {}), ...(bad ? optBad : {}) }}>
                        <div style={{ fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          {t.date}{best && <span style={tag}>BEST</span>}
                        </div>
                        <div style={avbar}><i style={{ display: "block", height: "100%", background: "#0ca750", borderRadius: 999, width: `${Math.round(t.available_count / totalP * 100)}%` }} /></div>
                        <div style={{ fontSize: 11.5, color: "#b6b9c0", display: "flex", justifyContent: "space-between" }}>
                          <span>{t.available_count} of {rows.length} available</span>
                          {t.location_available === true && <span style={{ color: "#0ca750", fontWeight: 600 }}>location ✓</span>}
                          {bad && <span style={{ color: "#e5484d", fontWeight: 600 }}>location ✕</span>}
                          {pend && <span style={{ color: "#e08b00", fontWeight: 600 }}>location pending</span>}
                        </div>
                        <button style={{ ...btnDarkTiny, width: "100%", marginTop: 11, ...(bad || pend ? btnDisabled : {}) }}
                          disabled={bad || pend || busy === "lk"+d.shoot_day_id+t.date}
                          onClick={() => act("lk"+d.shoot_day_id+t.date, () => lockDate(d.shoot_day_id, t.date))}>
                          {bad ? "Can't lock" : pend ? "Waiting on location" : "Lock this date"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* chips */}
              <div style={people}>
                {rows.map((row) => {
                  const st = row.responded ? (row.picked_dates.length ? "g" : "r") : "a";
                  const stColor = st === "g" ? "#0ca750" : st === "r" ? "#e5484d" : "#e08b00";
                  const roleTxt = row.responded
                    ? (row.picked_dates.length ? row.picked_dates[0] : row.suggested_dates.length ? "suggested" : "declined")
                    : row.role_type;
                  return (
                    <span key={row.person_id} style={chip}>
                      <span style={{ ...av, background: colorFor(row.person_id) }}>{initials(row.name)}</span>
                      <span style={{ ...stDot, background: stColor }} />
                      <span style={{ fontWeight: 550 }}>{row.name}</span>
                      <span style={{ color: "#74777f", fontSize: 10.5 }}>{roleTxt}</span>
                      {!row.responded && (
                        <span style={miniAct} onClick={() => {
                          if (confirmSend(`Remind ${row.name}?`)) act("r"+row.person_id+d.shoot_day_id, () => remindPeople(projectId, [row.person_id]));
                        }}>Remind</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            <div style={dayFoot}>
              <div style={{ fontSize: 12.5, color: "#b6b9c0" }}>
                <b style={{ color: "#ffffff" }}>{confirmed} of {rows.length}</b> available · {pending} pending{declined ? ` · ${declined} declined` : ""}
              </div>
              {pending > 0 && (
                <button style={btnSoftBlueTiny} onClick={() => {
                  const ids = rows.filter((x) => !x.responded).map((x) => x.person_id);
                  if (confirmSend(`Remind ${ids.length} people on Day ${d.day_number}?`)) act("day"+d.shoot_day_id, () => remindPeople(projectId, ids));
                }}>Remind everyone on this day</button>
              )}
            </div>
          </div>
        );
      })}

      {/* ACTIVITY */}
      <div style={feedcard}>
        <h3 style={{ margin: "0 0 14px", fontSize: 14, letterSpacing: "-.01em" }}>Recent activity</h3>
        {activity.length === 0 && <p style={{ color: "#74777f", fontSize: 13 }}>No activity yet.</p>}
        {activity.map((e, i) => (
          <div key={i} style={{ ...ev, borderBottom: i === activity.length - 1 ? "none" : "1px solid #ecedf1" }}>
            <span style={{ ...fdot, background: feedColor(e.type) }} />
            <span>{describe(e)}</span>
            <span style={{ color: "#74777f", fontSize: 11, marginLeft: "auto", whiteSpace: "nowrap" }}>{fmt(e.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Mini({ n, l, color }) {
  return <div><div style={{ fontSize: 20, fontWeight: 700, color: color || "#14161a" }}>{n}</div>
    <div style={{ fontSize: 11, color: "#74777f", textTransform: "uppercase", letterSpacing: .4, marginTop: 1 }}>{l}</div></div>;
}
function fmt(iso){ if(!iso) return ""; const d=new Date(iso+"Z"); const m=Math.round((Date.now()-d)/60000);
  if(m<1)return"just now"; if(m<60)return m+"m ago"; const h=Math.round(m/60); if(h<24)return h+"h ago"; return d.toLocaleDateString(); }
function feedColor(t){ return t==="day-locked"||t==="responded"||t==="marked-available"?"#0ca750":t==="suggested-alternate"?"#e5484d":t.includes("sent")||t==="candidate-added"?"#2f6bff":"#cfd3da"; }
function describe(e){ const w=e.name||"Someone"; const p=e.payload||{};
  switch(e.type){
    case "responded": return `${w} responded${p.picked?.length?` (${p.picked.join(", ")})`:""}`;
    case "suggested-alternate": return `${w} suggested ${p.suggested?.join(", ")||"alternates"}`;
    case "day-locked": return `Day locked for ${p.date||""}`;
    case "outreach-sent": return `Request sent to ${w}`;
    case "reminder-sent": return `Reminder sent to ${w}`;
    case "marked-available": return `${w} marked available (${p.date||""})`;
    case "candidate-added": return `Candidate date added (${p.date||""})`;
    default: return e.type;
  }
}

const hero={background:"#fff",border:"1px solid #ecedf1",borderRadius:18,padding:"22px 24px",boxShadow:"0 1px 2px rgba(20,22,26,.04),0 4px 16px rgba(20,22,26,.05)",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",gap:24,flexWrap:"wrap"};
const attnCard={background:"#fff",border:"1px solid #ecedf1",borderRadius:16,boxShadow:"0 1px 2px rgba(20,22,26,.04),0 4px 16px rgba(20,22,26,.05)",padding:"0 8px 8px",marginBottom:6};
const attnTitle={fontSize:12,fontWeight:700,color:"#9096a1",textTransform:"uppercase",letterSpacing:.5,padding:"14px 14px 8px"};
const attn={display:"flex",alignItems:"center",gap:12,padding:"12px 14px"};
const ic={width:30,height:30,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0};
const sub={color:"#9096a1",fontSize:12.5,marginTop:1};
const secLabel={fontSize:12,fontWeight:700,color:"#9096a1",textTransform:"uppercase",letterSpacing:.5};
const day={background:"#fff",border:"1px solid #ecedf1",borderRadius:18,boxShadow:"0 1px 2px rgba(20,22,26,.04),0 4px 16px rgba(20,22,26,.05)",marginBottom:16,overflow:"hidden"};
const dayLocked={borderColor:"#c5ebd5"};
const dayTop={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 22px",gap:16};
const daynum={width:38,height:38,borderRadius:11,background:"#f1f2f5",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:750,fontSize:15,color:"#5a616c",flexShrink:0};
const pillGreen={background:"#e9f9f0",color:"#0ca750",padding:"7px 13px",borderRadius:999,fontSize:12.5,fontWeight:650};
const pillAmber={background:"#fdf4e4",color:"#e08b00",padding:"7px 13px",borderRadius:999,fontSize:12.5,fontWeight:650};
const opts={display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:10,margin:"8px 0 4px"};
const opt={border:"1.5px solid #ecedf1",borderRadius:13,padding:"13px 14px"};
const optBest={borderColor:"#0ca750",background:"#e9f9f0"};
const optBad={opacity:.55};
const tag={fontSize:9.5,fontWeight:800,color:"#fff",background:"#0ca750",borderRadius:5,padding:"2px 6px",letterSpacing:.4};
const avbar={height:6,borderRadius:999,background:"#edeef1",margin:"10px 0 6px",overflow:"hidden"};
const people={display:"flex",flexWrap:"wrap",gap:8,marginTop:16};
const chip={display:"flex",alignItems:"center",gap:8,padding:"6px 12px 6px 6px",border:"1px solid #ecedf1",borderRadius:999,fontSize:12.5,background:"#fff"};
const av={width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff"};
const stDot={width:8,height:8,borderRadius:"50%"};
const miniAct={marginLeft:4,color:"#2f6bff",fontSize:11,cursor:"pointer",fontWeight:650};
const dayFoot={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 22px",borderTop:"1px solid #ecedf1",background:"#fbfbfc"};
const feedcard={background:"#fff",border:"1px solid #ecedf1",borderRadius:18,boxShadow:"0 1px 2px rgba(20,22,26,.04),0 4px 16px rgba(20,22,26,.05)",padding:"18px 22px",marginTop:16};
const ev={display:"flex",gap:12,alignItems:"center",padding:"9px 0",fontSize:13};
const fdot={width:7,height:7,borderRadius:"50%",flexShrink:0};
const btnDarkTiny={background:"#111318",color:"#fff",border:"none",borderRadius:9,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer"};
const btnBlueTiny={background:"#2f6bff",color:"#fff",border:"none",borderRadius:9,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer"};
const btnSoftBlueTiny={background:"#eaf1ff",color:"#2f6bff",border:"none",borderRadius:9,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer"};
const btnSoftTiny={background:"#f1f2f5",color:"#5a616c",border:"none",borderRadius:9,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer"};
const btnDisabled={background:"#ccc",cursor:"not-allowed",opacity:.7};
