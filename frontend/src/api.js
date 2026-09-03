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

export async function detectedLocations(projectId) {
  const res = await fetch(`${BASE}/api/plan/detected-locations/${projectId}`);
  if (!res.ok) throw new Error("Failed to load detected locations");
  return res.json();
}

export async function listDays(projectId) {
  const res = await fetch(`${BASE}/api/schedule/days/${projectId}`);
  if (!res.ok) throw new Error("Failed to load days");
  return res.json();
}

export async function autoDays(projectId) {
  const res = await fetch(`${BASE}/api/schedule/days/auto/${projectId}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to auto-create days");
  return res.json();
}

export async function addDay(projectId, dayNumber) {
  const res = await fetch(`${BASE}/api/schedule/days`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, day_number: dayNumber, candidate_dates: [] }),
  });
  if (!res.ok) throw new Error("Failed to add day");
  return res.json();
}

export async function updateDay(dayId, patch) {
  const res = await fetch(`${BASE}/api/schedule/days/${dayId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update day");
  return res.json();
}

export async function deleteDay(dayId) {
  const res = await fetch(`${BASE}/api/schedule/days/${dayId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete day");
  return res.json();
}

export async function getLink(token) {
  const res = await fetch(`${BASE}/api/link/${token}`);
  if (!res.ok) throw new Error("Invalid or expired link");
  return res.json();
}

export async function submitResponse(token, shootDayId, pickedDates, suggestedDates) {
  const res = await fetch(`${BASE}/api/link/${token}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shoot_day_id: shootDayId, picked_dates: pickedDates, suggested_dates: suggestedDates }),
  });
  if (!res.ok) throw new Error("Failed to submit");
  return res.json();
}

export async function getDaysText(projectId) {
  const res = await fetch(`${BASE}/api/schedule/days-text/${projectId}`);
  if (!res.ok) throw new Error("Failed to load days text");
  return res.json();
}

export async function sendTemplate(projectId, personIds, subject, template) {
  const res = await fetch(`${BASE}/api/schedule/send-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, person_ids: personIds, subject, template }),
  });
  if (!res.ok) throw new Error("Send failed");
  return res.json();
}

export async function autoLinkCoordinators(projectId) {
  const res = await fetch(`${BASE}/api/schedule/auto-link-coordinators/${projectId}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to link coordinators");
  return res.json();
}

export async function getDecide(projectId) {
  const res = await fetch(`${BASE}/api/schedule/decide/${projectId}`);
  if (!res.ok) throw new Error("Failed to load decide view");
  return res.json();
}

export async function lockDate(dayId, date) {
  const res = await fetch(`${BASE}/api/schedule/days/${dayId}/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) throw new Error("Failed to lock date");
  return res.json();
}

export async function unlockDate(dayId) {
  const res = await fetch(`${BASE}/api/schedule/days/${dayId}/unlock`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to unlock date");
  return res.json();
}

export async function getEvents(projectId) {
  // reuse: we infer status from events via a small endpoint if present; fallback empty
  try {
    const res = await fetch(`${BASE}/api/schedule/decide/${projectId}`);
    return res.ok ? [] : [];
  } catch { return []; }
}

export async function getResponses(projectId) {
  const res = await fetch(`${BASE}/api/schedule/responses/${projectId}`);
  if (!res.ok) throw new Error("Failed to load responses");
  return res.json();
}
