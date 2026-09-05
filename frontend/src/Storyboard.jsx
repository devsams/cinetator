import { Fragment, useEffect, useState } from "react";
import { listLocations, listDays } from "./api";

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

const NO_LOCATION = "— no location set —";
const UNSCHEDULED = "unscheduled";

export default function Storyboard({ project }) {
  const projectId = project?.project_id;
  const breakdown = project?.breakdown;
  const [locations, setLocations] = useState([]);
  const [days, setDays] = useState([]);

  useEffect(() => {
    if (!projectId) return;
    listLocations(projectId).then(setLocations).catch(() => {});
    listDays(projectId).then(setDays).catch(() => {});
  }, [projectId, breakdown]);

  const scenes = breakdown?.scenes || [];

  if (!breakdown || scenes.length === 0) {
    return (
      <div>
        <div className="ct-ptitle"><span className="num">06</span>Storyboard</div>
        <p className="ct-psub">A visual map of the whole shoot — every location, every day, at a glance.</p>
        <div className="ct-card" style={{ color: "#74777f", fontSize: 13.5 }}>
          No scenes yet — build out your Breakdown first, then come back here to see the shoot mapped out.
        </div>
      </div>
    );
  }

  const dayNumbers = [...new Set(scenes.map((s) => s.day).filter((d) => d != null))].sort((a, b) => a - b);
  const hasUnscheduled = scenes.some((s) => s.day == null);
  const columns = hasUnscheduled ? [...dayNumbers, UNSCHEDULED] : dayNumbers;

  const dayMeta = {};
  days.forEach((d) => { dayMeta[d.day_number] = d; });

  const locByName = {};
  locations.forEach((l) => { locByName[(l.name || "").toLowerCase()] = l; });

  // Row order: each distinct location, ordered by the earliest day it's shot at
  // (locations with no day info, or no location at all, sink to the bottom) —
  // so scanning top-to-bottom roughly follows the shooting order.
  const firstDaySeen = {};
  scenes.forEach((s) => {
    const name = s.location || NO_LOCATION;
    const d = s.day ?? 9999;
    if (firstDaySeen[name] === undefined || d < firstDaySeen[name]) firstDaySeen[name] = d;
  });
  const locOrder = Object.keys(firstDaySeen).sort((a, b) => firstDaySeen[a] - firstDaySeen[b]);

  // Cell map: location name -> column (day number or "unscheduled") -> scenes[]
  const grid = {};
  scenes.forEach((s) => {
    const name = s.location || NO_LOCATION;
    const col = s.day ?? UNSCHEDULED;
    grid[name] = grid[name] || {};
    grid[name][col] = grid[name][col] || [];
    grid[name][col].push(s);
  });

  return (
    <div>
      <div className="ct-ptitle"><span className="num">06</span>Storyboard</div>
      <p className="ct-psub" style={{ marginBottom: 18 }}>
        A visual map of the whole shoot — every location, every day, at a glance.
      </p>

      <div style={{ overflowX: "auto", paddingBottom: 8 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `190px repeat(${columns.length}, minmax(190px, 1fr))`,
            gap: 10,
            minWidth: 190 + columns.length * 200,
          }}
        >
          <div />
          {columns.map((c) => (
            <div key={c} style={dayHeader}>
              {c === UNSCHEDULED ? "Unscheduled" : `Day ${c}`}
              {c !== UNSCHEDULED && dayMeta[c]?.locked_date && (
                <div style={{ fontWeight: 400, fontSize: 11, color: "#74777f", marginTop: 2 }}>{dayMeta[c].locked_date}</div>
              )}
            </div>
          ))}

          {locOrder.map((locName) => {
            const loc = locByName[locName.toLowerCase()];
            return (
              <Fragment key={locName}>
                <div style={locHeader}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: locName === NO_LOCATION ? "#74777f" : "#e6e8ec" }}>{locName}</div>
                  {loc && (
                    <span style={{ ...researchTag, ...(loc.research ? researchTagYes : researchTagNo) }}>
                      {loc.research ? "Researched" : "Not researched"}
                    </span>
                  )}
                </div>
                {columns.map((c) => {
                  const cellScenes = grid[locName]?.[c] || [];
                  return (
                    <div key={locName + c} style={cell}>
                      {cellScenes.map((s, i) => {
                        const ts = timeStyle(s.time_of_day);
                        return (
                          <div key={i} style={sceneCard}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                              <span className="disp" style={{ fontSize: 13 }}>SC {s.number}</span>
                              <span style={{ ...intExtTag }}>{s.int_ext}</span>
                            </div>
                            <div style={{ marginTop: 6 }}>
                              <span style={{ ...timeTag, background: ts.bg, color: ts.fg }}>{s.time_of_day || "—"}</span>
                            </div>
                            {s.cast?.length > 0 && (
                              <div style={{ fontSize: 11, color: "#b6b9c0", marginTop: 6, lineHeight: 1.4 }}>{s.cast.join(", ")}</div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10.5, color: "#74777f" }}>
                              <span>{s.pages || "1"} pg</span>
                              {s.props?.length > 0 && <span style={{ color: "#5b9dff" }}>{s.props.length} prop{s.props.length === 1 ? "" : "s"}</span>}
                            </div>
                          </div>
                        );
                      })}
                      {cellScenes.length === 0 && <div style={emptyCell}>—</div>}
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const dayHeader = { fontWeight: 800, fontSize: 12.5, textTransform: "uppercase", letterSpacing: ".04em", color: "#e6e8ec", padding: "8px 4px" };
const locHeader = { display: "flex", flexDirection: "column", gap: 5, padding: "10px 10px 10px 0", borderRight: "1px solid #2a2a2e" };
const cell = { display: "flex", flexDirection: "column", gap: 8, padding: 4, minHeight: 44 };
const sceneCard = { background: "#161618", border: "1px solid #2a2a2e", borderRadius: 10, padding: "9px 11px" };
const emptyCell = { color: "#35353b", fontSize: 16, textAlign: "center", padding: "12px 0" };
const timeTag = { fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap" };
const intExtTag = { fontSize: 10, fontWeight: 700, color: "#74777f" };
const researchTag = { fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, width: "fit-content" };
const researchTagYes = { background: "#0f2a1b", color: "#7fe8ac" };
const researchTagNo = { background: "#2a2410", color: "#f5c518" };
