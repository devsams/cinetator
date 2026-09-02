import { useState } from "react";
import { analyzeScript } from "./api";

export default function Breakdown({ project, setProject }) {
  const [title, setTitle] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const breakdown = project?.breakdown;

  async function onAnalyze() {
    setLoading(true);
    setError("");
    try {
      const result = await analyzeScript({ title, scriptText, file });
      setProject(result); // { project_id, breakdown }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={card}>
        <h2 style={{ margin: 0 }}>1 · Breakdown</h2>
        <p style={{ color: "#666", marginTop: 4 }}>
          Upload a script or paste production details. The agent extracts scenes,
          cast, locations, and props.
        </p>

        <label style={label}>Production title</label>
        <input
          style={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Echo Signal"
        />

        <label style={label}>Paste script</label>
        <textarea
          style={{ ...input, minHeight: 160, fontFamily: "monospace" }}
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          placeholder="INT. COFFEE SHOP - DAY..."
        />

        <label style={label}>...or upload a PDF / .txt</label>
        <input
          type="file"
          accept=".pdf,.txt"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />

        <button style={button} onClick={onAnalyze} disabled={loading}>
          {loading ? "Analyzing..." : "Analyze script"}
        </button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </section>

      {breakdown && (
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>
            Breakdown — {project.breakdown.title || project.title || "Untitled"}
          </h3>
          <p style={{ color: "#666" }}>
            {breakdown.characters?.length || 0} characters ·{" "}
            {breakdown.locations?.length || 0} locations ·{" "}
            est. {breakdown.estimated_shoot_days || "?"} shoot day(s)
          </p>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>I/E</th>
                <th style={th}>Location</th>
                <th style={th}>Time</th>
                <th style={th}>Cast</th>
                <th style={th}>Props</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.scenes?.map((s, i) => (
                <tr key={i}>
                  <td style={td}>{s.number}</td>
                  <td style={td}>{s.int_ext}</td>
                  <td style={td}>{s.location}</td>
                  <td style={td}>{s.time_of_day}</td>
                  <td style={td}>{(s.cast || []).join(", ")}</td>
                  <td style={td}>{(s.props || []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

const card = { background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 20, display: "grid", gap: 8 };
const label = { fontSize: 13, fontWeight: 600, marginTop: 8 };
const input = { padding: 10, border: "1px solid #ddd", borderRadius: 8, fontSize: 14 };
const button = { marginTop: 12, padding: "10px 16px", background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, width: "fit-content" };
const table = { width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 13 };
const th = { textAlign: "left", borderBottom: "2px solid #eee", padding: "8px 6px", color: "#888", fontWeight: 600 };
const td = { borderBottom: "1px solid #f2f2f2", padding: "8px 6px" };
