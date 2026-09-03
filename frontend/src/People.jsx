import { useEffect, useState } from "react";
import { listPeople, seedCast, addPerson, updatePerson, deletePerson } from "./api";

const GROUPS = ["cast", "crew", "other"];

export default function People({ projectId }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    if (!projectId) return;
    setPeople(await listPeople(projectId));
  }
  useEffect(() => { refresh(); }, [projectId]);

  async function onSeed() {
    setLoading(true);
    try { await seedCast(projectId); await refresh(); } finally { setLoading(false); }
  }
  async function onAdd(role) {
    await addPerson({ project_id: projectId, name: "New person", role_type: role });
    await refresh();
  }
  function onField(id, field, value) {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }
  async function onBlurSave(id, field, value) { await updatePerson(id, { [field]: value }); }
  async function onDelete(id) { await deletePerson(id); await refresh(); }

  if (!projectId) return null;

  return (
    <div className="ct-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div className="disp" style={{ fontSize: 19 }}>People</div>
        <button className="ct-btn ghost tiny" onClick={onSeed} disabled={loading}>
          {loading ? "Adding…" : "Auto-add cast from script"}
        </button>
      </div>
      <p className="ct-desc" style={{ marginBottom: 0 }}>
        Cast, crew, and others. Fill in contact details — each person gets a personal link.
      </p>

      {GROUPS.map((group) => (
        <div key={group} style={{ marginTop: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="ct-lbl" style={{ fontSize: 12, margin: 0 }}>{group}</span>
            <button className="ct-btn ghost tiny" onClick={() => onAdd(group)}>+ Add {group}</button>
          </div>
          <table className="ct-table">
            <thead>
              <tr><th>Name</th><th>Character</th><th>Email</th><th>Phone</th><th></th></tr>
            </thead>
            <tbody>
              {people.filter((p) => p.role_type === group).map((p) => (
                <tr key={p.id}>
                  <td><input className="ct-input" style={cell} value={p.name || ""}
                    onChange={(e) => onField(p.id, "name", e.target.value)}
                    onBlur={(e) => onBlurSave(p.id, "name", e.target.value)} /></td>
                  <td><input className="ct-input" style={cell} value={p.character || ""}
                    onChange={(e) => onField(p.id, "character", e.target.value)}
                    onBlur={(e) => onBlurSave(p.id, "character", e.target.value)} /></td>
                  <td><input className="ct-input" style={cell} value={p.email || ""} placeholder="email"
                    onChange={(e) => onField(p.id, "email", e.target.value)}
                    onBlur={(e) => onBlurSave(p.id, "email", e.target.value)} /></td>
                  <td><input className="ct-input" style={cell} value={p.phone || ""} placeholder="phone"
                    onChange={(e) => onField(p.id, "phone", e.target.value)}
                    onBlur={(e) => onBlurSave(p.id, "phone", e.target.value)} /></td>
                  <td><button style={delBtn} onClick={() => onDelete(p.id)}>✕</button></td>
                </tr>
              ))}
              {people.filter((p) => p.role_type === group).length === 0 && (
                <tr><td style={{ color: "#74777f", padding: "10px 8px" }} colSpan={5}>None yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

const cell = { padding: "8px 10px", fontSize: 13, background: "#242428" };
const delBtn = { border: "none", background: "none", color: "#ff5c5c", cursor: "pointer", fontSize: 14 };
