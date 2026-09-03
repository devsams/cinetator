import { useState } from "react";
import Breakdown from "./Breakdown";
import Plan from "./Plan";
import Schedule from "./Schedule";
import Dashboard from "./Dashboard";

const TABS = ["Breakdown", "Plan", "Schedule", "Dashboard"];

export default function App() {
  const [tab, setTab] = useState("Breakdown");
  const [project, setProject] = useState(null);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f6f7f9", minHeight: "100vh" }}>
      <header style={header}>
        <strong style={{ fontSize: 18 }}>🎬 Cinetator</strong>
        <span style={{ color: "#999", fontSize: 13 }}>
          {project ? `${project.breakdown?.title || "Project"} · ${project.project_id.slice(0, 8)}…` : "No project yet"}
        </span>
      </header>

      <nav style={nav}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...tabBtn, ...(tab === t ? tabActive : {}) }}>{t}</button>
        ))}
      </nav>

      <main style={{ maxWidth: 980, margin: "24px auto", padding: "0 16px" }}>
        {tab === "Breakdown" && <Breakdown project={project} setProject={setProject} />}
        {tab === "Plan" && <Plan project={project} />}
        {tab === "Schedule" && <Schedule project={project} />}
        {tab === "Dashboard" && <Dashboard project={project} />}
      </main>
    </div>
  );
}

const header = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "#fff", borderBottom: "1px solid #e9ebef" };
const nav = { display: "flex", gap: 8, padding: "10px 20px", background: "#fff", borderBottom: "1px solid #e9ebef" };
const tabBtn = { padding: "8px 16px", border: "1px solid #e9ebef", background: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 14 };
const tabActive = { background: "#111", color: "#fff", borderColor: "#111" };
