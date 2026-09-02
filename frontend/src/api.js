const BASE = "http://localhost:8000";

export async function analyzeScript({ title, scriptText, file }) {
  const form = new FormData();
  form.append("title", title || "Untitled Production");
  if (scriptText) form.append("script_text", scriptText);
  if (file) form.append("file", file);

  const res = await fetch(`${BASE}/api/breakdown/analyze`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Analyze failed");
  }
  return res.json();
}

export async function listPeople(projectId) {
  const res = await fetch(`${BASE}/api/people/${projectId}`);
  if (!res.ok) throw new Error("Failed to load people");
  return res.json();
}

export async function seedCast(projectId) {
  const res = await fetch(`${BASE}/api/people/seed-cast/${projectId}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to seed cast");
  return res.json();
}

export async function addPerson(person) {
  const res = await fetch(`${BASE}/api/people`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(person),
  });
  if (!res.ok) throw new Error("Failed to add person");
  return res.json();
}

export async function updatePerson(personId, patch) {
  const res = await fetch(`${BASE}/api/people/${personId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update person");
  return res.json();
}

export async function deletePerson(personId) {
  const res = await fetch(`${BASE}/api/people/${personId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete person");
  return res.json();
}

export async function listLocations(projectId) {
  const res = await fetch(`${BASE}/api/plan/locations/${projectId}`);
  if (!res.ok) throw new Error("Failed to load locations");
  return res.json();
}

export async function addLocation(projectId, name, address) {
  const res = await fetch(`${BASE}/api/plan/locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, name, address }),
  });
  if (!res.ok) throw new Error("Failed to add location");
  return res.json();
}

export async function researchLocation(locationId) {
  const res = await fetch(`${BASE}/api/plan/locations/${locationId}/research`, { method: "POST" });
  if (!res.ok) throw new Error("Research failed");
  return res.json();
}

export async function deleteLocation(locationId) {
  const res = await fetch(`${BASE}/api/plan/locations/${locationId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete location");
  return res.json();
}
