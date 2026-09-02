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
    try { await seedCast(projectId); await refresh(); }
    finally { setLoading(false); }
  }

  async function onAdd(role) {
    await addPerson({ project_id: projectId, name: "New person", role_type: role });
    await refresh();
  }

  function onField(id, field, value) {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  async function onBlurSave(id, field, value) {
    await updatePerson(id, { [field]: value });
  }

  async function onDelete(id) {
    await deletePerson(id);
    await refresh();
  }

  if (!projectId) return null;

  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>People</h3>
        <button style={ghost} onClick={onSeed} disabled={loading}>
          {loading ? "Adding..." : "Auto-add cast from script"}
        </button>
      </div>
      <p style={{ color: "#666", marginTop: 4 }}>
        Cast, crew, and others. Fill in contact details — each person gets a personal link.
      </p>

      {GROUPS.map((group) => (
        <div key={group} style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ textTransform: "capitalize" }}>{group}</strong>
            <button style={ghost} onClick={() => onAdd(group)}>+ Add {group}</button>
          </div>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Name</th><th style={th}>Character</th>
                <th style={th}>Email</th><th style={th}>Phone</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {people.filter((p) => p.role_type === group).map((p) => (
                <tr key={p.id}>
                  <td style={td}><input style={cell} value={p.name || ""}
                    onChange={(e) => onField(p.id, "name", e.target.value)}
                    onBlur={(e) => onBlurSave(p.id, "name", e.target.value)} /></td>
                  <td style={td}><input style={cell} value={p.character || ""}
                    onChange={(e) => onField(p.id, "character", e.target.value)}
                    onBlur={(e) => onBlurSave(p.id, "character", e.target.value)} /></td>
                  <td style={td}><input style={cell} value={p.email || ""} placeholder="email"
                    onChange={(e) => onField(p.id, "email", e.target.value)}
                    onBlur={(e) => onBlurSave(p.id, "email", e.target.value)} /></td>
                  <td style={td}><input style={cell} value={p.phone || ""} placeholder="phone"
                    onChange={(e) => onField(p.id, "phone", e.target.value)}
                    onBlur={(e) => onBlurSave(p.id, "phone", e.target.value)} /></td>
                  <td style={td}><button style={del} onClick={() => onDelete(p.id)}>✕</button></td>
                </tr>
              ))}
              {people.filter((p) => p.role_type === group).length === 0 && (
                <tr><td style={{ ...td, color: "#aaa" }} colSpan={5}>None yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

const card = { background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 20 };
const table = { width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 13 };
const th = { textAlign: "left", borderBottom: "2px solid #eee", padding: "6px", color: "#888", fontWeight: 600 };
const td = { borderBottom: "1px solid #f2f2f2", padding: "4px 6px" };
const cell = { width: "100%", border: "1px solid transparent", padding: 6, borderRadius: 6, fontSize: 13, background: "#fafafa" };
const ghost = { padding: "6px 12px", background: "#fff", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const del = { border: "none", background: "none", color: "#c00", cursor: "pointer", fontSize: 14 };
