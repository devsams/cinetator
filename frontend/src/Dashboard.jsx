import { useEffect, useState } from "react";
import {
  getDecide, getResponses, getActivity, autoLinkCoordinators,
  lockDate, unlockDate, remindPeople, markStatus, addCandidate,
  listNotes, resolveNote, getReadiness, setPropReady,
  getShootDayStatus, setArrival, setSceneComplete,
} from "./api";

const AV_COLORS = ["#7c5cff","#e0645a","#2f9e6b","#c88a2a","#3a7bd5","#8a63d2","#c8722a","#2f9e88","#d2637f"];
function initials(n){return (n||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();}
function colorFor(id){let h=0;for(const c of (id||"")) h=(h*31+c.charCodeAt(0))%AV_COLORS.length;return AV_COLORS[h];}

export default function Dashboard({ project }) {
  const projectId = project?.project_id;
  const [decide, setDecide] = useState([]);
  const [roster, setRoster] = useState([]);
  const [activity, setActivity] = useState([]);
  const [notes, setNotes] = useState([]);
  const [readiness, setReadiness] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  async function refresh() {
    if (!projectId) return;
    try {
      await autoLinkCoordinators(projectId);
      const [d, r, a, n] = await Promise.all([getDecide(projectId), getResponses(projectId), getActivity(projectId), listNotes(projectId)]);
      setDecide(d); setRoster(r); setActivity(a); setNotes(n);
      const readyEntries = await Promise.all(d.map(async (day) => {
        try { return [day.shoot_day_id, await getReadiness(day.shoot_day_id)]; }
        catch { return [day.shoot_day_id, null]; }
      }));
      setReadiness(Object.fromEntries(readyEntries));
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
      <div className="disp" style={{ fontSize: 22 }}>Dashboard</div>
      <p style={{ marginTop: 8 }}>Analyze a script and set up your schedule first.</p>
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
    <div>
      <div className="ct-ptitle"><span className="num">04</span>Dashboard</div>
      <p className="ct-psub">The live state of your shoot — what's locked, who's confirmed, and what still needs action.</p>

      {/* HERO */}
      <div style={hero}>
        <div>
          <div className="disp" style={{ fontSize: 20 }}>{project.breakdown?.title || "Your production"}</div>
          <div style={{ color: "#b6b9c0", fontSize: 14, marginTop: 6 }}>{statusLine}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", gap: 26 }}>
            <Mini n={`${respondedRate}%`} l="Responded" />
            <Mini n={uniquePeople} l="People" />
            <Mini n={attention.length} l="To action" color={attention.length ? "#f5c518" : undefined} />
          </div>
          <div style={{ position: "relative", width: 96, height: 96 }}>
            <svg width="96" height="96" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="48" cy="48" r={R} fill="none" stroke="#2a2a2e" strokeWidth="9" />
              <circle cx="48" cy="48" r={R} fill="none" stroke="#f5c518" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C - (lockPct / 100) * C} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div className="disp" style={{ fontSize: 20 }}>{lockPct}%</div>
              <div style={{ fontSize: 10, color: "#74777f", textTransform: "uppercase", letterSpacing: .5 }}>locked</div>
            </div>
          </div>
        </div>
      </div>

      {error && <p style={{ color: "#ff5c5c" }}>{error}</p>}

      {/* ATTENTION */}
      {attention.length > 0 && (
        <div style={attnCard}>
          <div style={attnTitle}>Needs attention · {attention.length}</div>
          {attention.map((a, i) => (
            <div key={i} style={{ ...attn, borderTop: i ? "1px solid #2a2a2e" : "none" }}>
              {a.kind === "loc" && <>
                <div style={{ ...ic, background: "#2a1414" }}>🔒</div>
                <div style={{ flex: 1, fontSize: 13.5 }}>Day {a.day.day_number} can't lock yet
                  <div style={sub}>Location {a.day.coordinator_name} hasn't confirmed a date.</div>
                </div>
                <button style={btnGoldTiny} onClick={() => {
                  const c = rosterByDay[a.day.shoot_day_id]?.rows.find((x) => x.name === a.day.coordinator_name);
                  if (c && confirmSend(`Remind ${a.day.coordinator_name}?`)) act("rc"+i, () => remindPeople(projectId, [c.person_id]));
                }}>Remind {a.day.coordinator_name?.split(" ")[0]}</button>
              </>}
              {a.kind === "alt" && <>
                <div style={{ ...ic, background: "#2a2410" }}>↩</div>
                <div style={{ flex: 1, fontSize: 13.5 }}>{a.by} suggested {a.date} for Day {a.day.day_number}
                  <div style={sub}>Turn it into a candidate date for everyone.</div>
                </div>
                <button style={btnGoldTiny} onClick={() => act("ac"+i, () => addCandidate(a.day.shoot_day_id, a.date))}>Add {a.date}</button>
              </>}
              {a.kind === "pending" && <>
                <div style={{ ...ic, background: "#2a2410" }}>⏳</div>
                <div style={{ flex: 1, fontSize: 13.5 }}>{pendingIds.length} people haven't responded
                  <div style={sub}>Send a one-click reminder to everyone still pending.</div>
                </div>
                <button style={btnGoldTiny} disabled={busy === "nudge"} onClick={() => {
                  if (confirmSend(`Send a reminder to ${pendingIds.length} pending people?`)) act("nudge", () => remindPeople(projectId, pendingIds));
                }}>{busy === "nudge" ? "Sending…" : `Nudge all (${pendingIds.length})`}</button>
              </>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 4px 12px" }}>
        <span className="ct-lbl" style={{ margin: 0 }}>Shoot days</span>
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
            <div style={{ ...dayTop, ...(d.locked_date ? { background: "linear-gradient(0deg,#161618,#12281c)" } : {}) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ ...daynum, ...(d.locked_date ? { background: "#3ddc84", color: "#0d0d0e" } : {}) }}>{d.day_number}</div>
                <div>
                  <div className="disp" style={{ fontSize: 17 }}>{d.location_name || "No location set"}</div>
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
              <ReadinessBlock rd={readiness[d.shoot_day_id]} projectId={projectId} onPropToggle={refresh} />
              {d.locked_date && <ShootDayPanel shootDayId={d.shoot_day_id} projectId={projectId} />}

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
                        <div style={avbar}><i style={{ display: "block", height: "100%", background: "#3ddc84", borderRadius: 999, width: `${Math.round(t.available_count / totalP * 100)}%` }} /></div>
                        <div style={{ fontSize: 11.5, color: "#b6b9c0", display: "flex", justifyContent: "space-between" }}>
                          <span>{t.available_count} of {rows.length} available</span>
                          {t.location_available === true && <span style={{ color: "#3ddc84", fontWeight: 600 }}>location ✓</span>}
                          {bad && <span style={{ color: "#ff5c5c", fontWeight: 600 }}>location ✕</span>}
                          {pend && <span style={{ color: "#f5c518", fontWeight: 600 }}>location pending</span>}
                        </div>
                        <button style={{ ...btnGoldTiny, width: "100%", marginTop: 11, ...(bad || pend ? btnDisabled : {}) }}
                          disabled={bad || pend || busy === "lk"+d.shoot_day_id+t.date}
                          onClick={() => act("lk"+d.shoot_day_id+t.date, () => lockDate(d.shoot_day_id, t.date))}>
                          {bad ? "Can't lock" : pend ? "Waiting on location" : "Lock this date"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={people}>
                {rows.map((row) => {
                  const st = row.responded ? (row.picked_dates.length ? "g" : "r") : "a";
                  const stColor = st === "g" ? "#3ddc84" : st === "r" ? "#ff5c5c" : "#f5c518";
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
                <button style={btnGoldSoftTiny} onClick={() => {
                  const ids = rows.filter((x) => !x.responded).map((x) => x.person_id);
                  if (confirmSend(`Remind ${ids.length} people on Day ${d.day_number}?`)) act("day"+d.shoot_day_id, () => remindPeople(projectId, ids));
                }}>Remind everyone on this day</button>
              )}
            </div>
          </div>
        );
      })}

      {/* NOTES */}
      {notes.length > 0 && (
        <div style={feedcard}>
          <div className="disp" style={{ fontSize: 15, marginBottom: 14 }}>
            Notes from the team {notes.filter(n => n.flags_production && !n.resolved).length > 0 &&
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#f5c518", background: "#2a2410", padding: "3px 8px", borderRadius: 999 }}>
                {notes.filter(n => n.flags_production && !n.resolved).length} flagged
              </span>}
          </div>
          {[...notes].sort((a, b) => (b.flags_production - a.flags_production) || (a.resolved - b.resolved)).map((n) => (
            <div key={n.id} style={{ ...noteRow, ...(n.flags_production && !n.resolved ? noteFlagged : {}), ...(n.resolved ? noteResolved : {}) }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#fff" }}>
                  <b>{n.person_name}</b>{n.day_number ? ` · Day ${n.day_number}` : ""}
                  {n.flags_production && !n.resolved && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, color: "#f5c518" }}>@PRODUCTION</span>}
                </div>
                <div style={{ fontSize: 13, color: "#b6b9c0", marginTop: 3 }}>{n.text}</div>
                <div style={{ fontSize: 11, color: "#74777f", marginTop: 4 }}>{fmt(n.created_at)}</div>
              </div>
              {!n.resolved && (
                <button style={btnSoftTiny} onClick={async () => { await resolveNote(n.id, true); await refresh(); }}>Mark resolved</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ACTIVITY */}
      <div style={feedcard}>
        <div className="disp" style={{ fontSize: 15, marginBottom: 14 }}>Recent activity</div>
        {activity.length === 0 && <p style={{ color: "#74777f", fontSize: 13 }}>No activity yet.</p>}
        {activity.map((e, i) => (
          <div key={i} style={{ ...ev, borderBottom: i === activity.length - 1 ? "none" : "1px solid #2a2a2e" }}>
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
  return <div><div className="disp" style={{ fontSize: 20, color: color || "#ffffff" }}>{n}</div>
    <div style={{ fontSize: 11, color: "#74777f", textTransform: "uppercase", letterSpacing: .4, marginTop: 1 }}>{l}</div></div>;
}
function fmt(iso){ if(!iso) return ""; const d=new Date(iso+"Z"); const m=Math.round((Date.now()-d)/60000);
  if(m<1)return"just now"; if(m<60)return m+"m ago"; const h=Math.round(m/60); if(h<24)return h+"h ago"; return d.toLocaleDateString(); }
function feedColor(t){ return t==="day-locked"||t==="responded"||t==="marked-available"?"#3ddc84":t==="suggested-alternate"?"#ff5c5c":t.includes("sent")||t==="candidate-added"?"#f5c518":"#35353b"; }
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

function ReadinessBlock({ rd, projectId, onPropToggle }) {
  if (!rd) return null;
  const color = rd.readiness_pct >= 90 ? "#3ddc84" : rd.readiness_pct >= 60 ? "#f5c518" : "#ff5c5c";
  const grouped = {};
  rd.items.forEach((i) => { (grouped[i.category] = grouped[i.category] || []).push(i); });

  async function toggleProp(name, ready) {
    await setPropReady(rd.shoot_day_id, projectId, name, ready);
    onPropToggle();
  }

  return (
    <div style={readyBox}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="ct-lbl" style={{ margin: 0 }}>Shoot readiness</span>
        <span className="disp" style={{ fontSize: 20, color }}>{rd.readiness_pct}%</span>
      </div>
      <div style={readyBar}><i style={{ display: "block", height: "100%", width: `${rd.readiness_pct}%`, background: color, borderRadius: 999 }} /></div>

      {rd.blocking.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#ff9d9d" }}>{rd.blocking.length} thing{rd.blocking.length > 1 ? "s" : ""} blocking this shoot</span>
        </div>
      )}

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#74777f", textTransform: "uppercase", letterSpacing: .5 }}>{cat}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
              {items.map((it, i) => {
                const st = it.status === "confirmed" ? { bg: "#12281c", fg: "#3ddc84", icon: "✓" }
                  : it.status === "pending" ? { bg: "#2a2410", fg: "#f5c518", icon: "◷" }
                  : { bg: "#2a1414", fg: "#ff5c5c", icon: "✕" };
                const isProp = cat === "Props";
                return (
                  <span key={i} style={{ ...readyChip, background: st.bg, color: st.fg, cursor: isProp ? "pointer" : "default" }}
                    onClick={isProp ? () => toggleProp(it.name, it.status !== "confirmed") : undefined}>
                    {st.icon} {it.name}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const readyBox={background:"#1a1a1c",border:"1px solid #2a2a2e",borderRadius:12,padding:16,marginBottom:16};
const readyBar={height:7,borderRadius:999,background:"#242428",overflow:"hidden"};
const readyChip={fontSize:11.5,fontWeight:600,padding:"5px 10px",borderRadius:999};

function ShootDayPanel({ shootDayId, projectId }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try { setStatus(await getShootDayStatus(shootDayId)); } catch (e) { setError(e.message); }
  }
  useEffect(() => { if (open && !status) load(); }, [open]);

  async function toggleArrival(personId, arrived) {
    await setArrival(shootDayId, projectId, personId, arrived);
    await load();
  }
  async function toggleScene(sceneNumber, completed) {
    await setSceneComplete(shootDayId, projectId, sceneNumber, completed);
    await load();
  }

  return (
    <div style={shootDayBox}>
      <button style={shootDayToggle} onClick={() => setOpen((v) => !v)}>
        {open ? "▾" : "▸"} {status?.wrapped ? "🎬 Shoot day completed" : "Start shoot day"}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {error && <p style={{ color: "#ff5c5c", fontSize: 12 }}>{error}</p>}
          {!status ? <p style={{ color: "#74777f", fontSize: 13 }}>Loading…</p> : (
            <>
              <div style={{ marginBottom: 14 }}>
                <span className="ct-lbl">Who's arrived</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {status.roster.map((r) => (
                    <button key={r.person_id} style={{ ...arriveChip, ...(r.arrived ? arriveChipOn : {}) }}
                      onClick={() => toggleArrival(r.person_id, !r.arrived)}>
                      {r.arrived ? "✓" : "○"} {r.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="ct-lbl">Scenes</span>
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  {status.scenes.map((sc) => (
                    <button key={sc.number} style={{ ...sceneRow2, ...(sc.completed ? sceneRow2On : {}) }}
                      onClick={() => toggleScene(sc.number, !sc.completed)}>
                      <span>{sc.completed ? "✓" : "○"} SC {sc.number} — {sc.int_ext}. {sc.location}</span>
                    </button>
                  ))}
                  {status.scenes.length === 0 && <span style={{ color: "#74777f", fontSize: 12.5 }}>No scenes tagged to this day.</span>}
                </div>
              </div>
              {status.wrapped && (
                <div style={{ marginTop: 14, padding: "10px 14px", background: "#12281c", color: "#3ddc84", borderRadius: 9, fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                  🎬 Everyone arrived, all scenes shot. That's a wrap!
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const shootDayBox={background:"#1a1a1c",border:"1px solid #2a2a2e",borderRadius:12,padding:14,marginBottom:16};
const shootDayToggle={background:"none",border:"none",color:"#f5c518",fontWeight:700,fontSize:13,cursor:"pointer",padding:0};
const arriveChip={fontSize:12,fontWeight:600,padding:"6px 11px",borderRadius:999,background:"#242428",color:"#b6b9c0",border:"1px solid #2a2a2e",cursor:"pointer"};
const arriveChipOn={background:"#12281c",color:"#3ddc84",borderColor:"#1f4a30"};
const sceneRow2={display:"block",width:"100%",textAlign:"left",fontSize:12.5,padding:"8px 10px",borderRadius:8,background:"#242428",color:"#b6b9c0",border:"1px solid #2a2a2e",cursor:"pointer"};
const sceneRow2On={background:"#12281c",color:"#3ddc84",borderColor:"#1f4a30"};

const hero={background:"#161618",border:"1px solid #2a2a2e",borderRadius:18,padding:"22px 24px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",gap:24,flexWrap:"wrap"};
const attnCard={background:"#161618",border:"1px solid #2a2a2e",borderRadius:16,padding:"0 8px 8px",marginBottom:6};
const attnTitle={fontSize:12,fontWeight:700,color:"#74777f",textTransform:"uppercase",letterSpacing:.5,padding:"14px 14px 8px"};
const attn={display:"flex",alignItems:"center",gap:12,padding:"12px 14px"};
const ic={width:30,height:30,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0};
const sub={color:"#74777f",fontSize:12.5,marginTop:1};
const day={background:"#161618",border:"1px solid #2a2a2e",borderRadius:18,marginBottom:16,overflow:"hidden"};
const dayLocked={borderColor:"#1f4a30"};
const dayTop={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 22px",gap:16};
const daynum={width:38,height:38,borderRadius:11,background:"#242428",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:750,fontSize:15,color:"#b6b9c0",flexShrink:0};
const pillGreen={background:"#12281c",color:"#3ddc84",padding:"7px 13px",borderRadius:999,fontSize:12.5,fontWeight:650};
const pillAmber={background:"#2a2410",color:"#f5c518",padding:"7px 13px",borderRadius:999,fontSize:12.5,fontWeight:650};
const opts={display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:10,margin:"8px 0 4px"};
const opt={border:"1.5px solid #2a2a2e",borderRadius:13,padding:"13px 14px",background:"#1d1d20"};
const optBest={borderColor:"#3ddc84",background:"#12281c"};
const optBad={opacity:.55};
const tag={fontSize:9.5,fontWeight:800,color:"#0d0d0e",background:"#3ddc84",borderRadius:5,padding:"2px 6px",letterSpacing:.4};
const avbar={height:6,borderRadius:999,background:"#242428",margin:"10px 0 6px",overflow:"hidden"};
const people={display:"flex",flexWrap:"wrap",gap:8,marginTop:16};
const chip={display:"flex",alignItems:"center",gap:8,padding:"6px 12px 6px 6px",border:"1px solid #2a2a2e",borderRadius:999,fontSize:12.5,background:"#1d1d20"};
const av={width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff"};
const stDot={width:8,height:8,borderRadius:"50%"};
const miniAct={marginLeft:4,color:"#f5c518",fontSize:11,cursor:"pointer",fontWeight:650};
const dayFoot={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 22px",borderTop:"1px solid #2a2a2e",background:"#1a1a1c"};
const feedcard={background:"#161618",border:"1px solid #2a2a2e",borderRadius:18,padding:"18px 22px",marginTop:16};
const ev={display:"flex",gap:12,alignItems:"center",padding:"9px 0",fontSize:13};
const fdot={width:7,height:7,borderRadius:"50%",flexShrink:0};
const btnGoldTiny={background:"#f5c518",color:"#0d0d0e",border:"none",borderRadius:9,padding:"7px 11px",fontSize:12,fontWeight:700,cursor:"pointer"};
const btnGoldSoftTiny={background:"#2a2410",color:"#f5c518",border:"none",borderRadius:9,padding:"6px 11px",fontSize:12,fontWeight:650,cursor:"pointer"};
const btnSoftTiny={background:"#242428",color:"#b6b9c0",border:"none",borderRadius:9,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer"};
const btnDisabled={background:"#35353b",cursor:"not-allowed",opacity:.7};

const noteRow={display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,padding:"12px 0",borderBottom:"1px solid #2a2a2e"};
const noteFlagged={background:"#2a2410",margin:"0 -8px",padding:"12px 8px",borderRadius:8};
const noteResolved={opacity:.5};
