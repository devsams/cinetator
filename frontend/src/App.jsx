import { useState } from "react";
import Home from "./Home";
import Profile from "./Profile";
import Breakdown from "./Breakdown";
import Plan from "./Plan";
import Schedule from "./Schedule";
import Dashboard from "./Dashboard";
import Stripboard from "./Stripboard";
import CallSheet from "./CallSheet";
import CommandCenter from "./CommandCenter";
import { getProject } from "./api";

const TABS = [
  { key: "Breakdown", no: "01" },
  { key: "Plan", no: "02" },
  { key: "Schedule", no: "03" },
  { key: "Dashboard", no: "04" },
  { key: "Stripboard", no: "05" },
  { key: "Call Sheet", no: "06" },
];

export default function App() {
  const [view, setView] = useState("home");
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState("Breakdown");

  async function openProject(p) {
    try {
      const full = await getProject(p.id);
      setProject({ project_id: full.id, title: full.title, breakdown: full.breakdown });
    } catch {
      setProject({ project_id: p.id, title: p.title, breakdown: null });
    }
    setTab("Breakdown"); setView("project");
  }
  function openNew(p) {
    setProject({ project_id: p.id, title: p.title, breakdown: null });
    setTab("Breakdown"); setView("project");
  }

  return (
    <div>
      <div className="ct-nav">
        <div className="ct-logo" onClick={() => setView("home")}>
          <span className="mk" /> CINE<em>TATOR</em>
        </div>
        <div className="ct-navlinks">
          <button className={`ct-nl ${view === "home" ? "active" : ""}`} onClick={() => setView("home")}>Productions</button>
          <button className={`ct-nl ${view === "profile" ? "active" : ""}`} onClick={() => setView("profile")}>Profile</button>
          <button className="ct-avatarbtn" onClick={() => setView("profile")}>D</button>
        </div>
      </div>
      <hr className="perf" />

      {view === "home" && <Home onOpen={openProject} onNew={openNew} />}
      {view === "profile" && <Profile />}

      {view === "project" && (
        <>
          <div className="ct-attnbar">
            <div className="badge"><span className="warn">!</span> {project?.title || "Project"}</div>
            <div className="detail">Coordinate cast, crew, and locations — every request is drafted for your review.</div>
            <button className="right" onClick={() => setTab("Dashboard")}>Open dashboard →</button>
          </div>
          <div className="ct-projbar">
            <div className="ct-pillnav">
              <button className="ct-backbtn" onClick={() => setView("home")}>← All</button>
              {TABS.map((t) => (
                <button key={t.key} className={`ct-tabbtn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                  <span className="no">{t.no}</span> {t.key}
                </button>
              ))}
            </div>
          </div>
          <hr className="perf" />
          <main className="ct-page">
            {tab === "Breakdown" && <Breakdown project={project} setProject={setProject} />}
            {tab === "Plan" && <Plan project={project} />}
            {tab === "Schedule" && <Schedule project={project} />}
            {tab === "Dashboard" && <Dashboard project={project} />}
            {tab === "Stripboard" && <Stripboard project={project} />}
            {tab === "Call Sheet" && <CallSheet project={project} />}
          </main>
          <CommandCenter project={project} />
        </>
      )}
    </div>
  );
}
