const BASE = import.meta.env.DEV
  ? "http://localhost:8000"
  : "https://cinetator-backend-844278617352.us-central1.run.app";

export async function analyzeScript({ title, scriptText, file, projectId, mode }) {
  const form = new FormData();
  form.append("title", title || "Untitled Production");
  if (scriptText) form.append("script_text", scriptText);
  if (file) form.append("file", file);
  if (projectId) form.append("project_id", projectId);
  form.append("mode", mode || "script");

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

export async function getActivity(projectId) {
  const res = await fetch(`${BASE}/api/schedule/activity/${projectId}`);
  if (!res.ok) throw new Error("Failed to load activity");
  return res.json();
}

export async function remindPeople(projectId, personIds) {
  const res = await fetch(`${BASE}/api/schedule/remind`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, person_ids: personIds }),
  });
  if (!res.ok) throw new Error("Failed to send reminders");
  return res.json();
}

export async function markStatus(projectId, personId, shootDayId, date) {
  const res = await fetch(`${BASE}/api/schedule/mark-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, person_id: personId, shoot_day_id: shootDayId, date }),
  });
  if (!res.ok) throw new Error("Failed to mark status");
  return res.json();
}

export async function addCandidate(dayId, date) {
  const res = await fetch(`${BASE}/api/schedule/days/${dayId}/add-candidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) throw new Error("Failed to add candidate date");
  return res.json();
}

export async function listProjects() {
  const res = await fetch(`${BASE}/api/projects`);
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

export async function createProject(title) {
  const res = await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title || "Untitled Production" }),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function setProjectStatus(projectId, status) {
  const res = await fetch(`${BASE}/api/projects/${projectId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update status");
  return res.json();
}

export async function deleteProject(projectId) {
  const res = await fetch(`${BASE}/api/projects/${projectId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete project");
  return res.json();
}

export async function getProject(projectId) {
  const res = await fetch(`${BASE}/api/projects/${projectId}`);
  if (!res.ok) throw new Error("Failed to load project");
  return res.json();
}





export async function listChatSessions(projectId) {
  const res = await fetch(`${BASE}/api/chat/sessions/${projectId}`);
  if (!res.ok) throw new Error("Failed to load chat history");
  return res.json();
}
export async function newChatSession(projectId) {
  const res = await fetch(`${BASE}/api/chat/sessions/${projectId}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start new chat");
  return res.json();
}
export async function getChatMessages(projectId, sessionId) {
  const res = await fetch(`${BASE}/api/chat/sessions/${projectId}/${sessionId}/messages`);
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}
export async function sendChat(projectId, sessionId, message) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, session_id: sessionId, message }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err || "Chat failed"); }
  return res.json();
}
export async function executeChatAction(projectId, name, args) {
  const res = await fetch(`${BASE}/api/chat/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, name, args }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err || "Action failed"); }
  return res.json();
}

// ---- Stripboard ----
export async function listStrips(shootDayId) {
  const res = await fetch(`${BASE}/api/stripboard/${shootDayId}`);
  if (!res.ok) throw new Error("Failed to load strips");
  return res.json();
}
export async function autoPopulateStrips(shootDayId) {
  const res = await fetch(`${BASE}/api/stripboard/${shootDayId}/auto-populate`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to auto-populate");
  return res.json();
}
export async function addStrip(shootDayId, projectId, body) {
  const res = await fetch(`${BASE}/api/stripboard/${shootDayId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, ...body }),
  });
  if (!res.ok) throw new Error("Failed to add strip");
  return res.json();
}
export async function updateStrip(stripId, patch) {
  const res = await fetch(`${BASE}/api/stripboard/strips/${stripId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update strip");
  return res.json();
}
export async function deleteStrip(stripId) {
  const res = await fetch(`${BASE}/api/stripboard/strips/${stripId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete strip");
  return res.json();
}
export async function reorderStrips(shootDayId, orderedIds) {
  const res = await fetch(`${BASE}/api/stripboard/${shootDayId}/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder");
  return res.json();
}
export async function setCrewCalls(shootDayId, crewCalls) {
  const res = await fetch(`${BASE}/api/stripboard/${shootDayId}/crew-calls`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ crew_calls: crewCalls }),
  });
  if (!res.ok) throw new Error("Failed to set crew calls");
  return res.json();
}
export async function setDayMeta(shootDayId, meta) {
  const res = await fetch(`${BASE}/api/stripboard/${shootDayId}/meta`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  if (!res.ok) throw new Error("Failed to set day meta");
  return res.json();
}
export async function setCompany(projectId, company) {
  const res = await fetch(`${BASE}/api/projects/${projectId}/company`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ production_company: company }),
  });
  if (!res.ok) throw new Error("Failed to set company");
  return res.json();
}

export async function getPersonView(personId) {
  const res = await fetch(`${BASE}/api/link/by-person/${personId}`);
  if (!res.ok) throw new Error("Failed to load person view");
  return res.json();
}
export async function submitPersonResponse(personId, shootDayId, pickedDates, suggestedDates) {
  const res = await fetch(`${BASE}/api/link/by-person/${personId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shoot_day_id: shootDayId, picked_dates: pickedDates, suggested_dates: suggestedDates }),
  });
  if (!res.ok) throw new Error("Failed to submit");
  return res.json();
}


export async function getScript(projectId) {
  const res = await fetch(`${BASE}/api/breakdown/${projectId}/script`);
  if (!res.ok) throw new Error("Failed to load script");
  return res.json();
}

export async function addNote(personId, text, shootDayId) {
  const res = await fetch(`${BASE}/api/link/by-person/${personId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, shoot_day_id: shootDayId || null }),
  });
  if (!res.ok) throw new Error("Failed to add note");
  return res.json();
}


export async function listNotes(projectId) {
  const res = await fetch(`${BASE}/api/link/notes/${projectId}`);
  if (!res.ok) throw new Error("Failed to load notes");
  return res.json();
}
export async function resolveNote(noteId, resolved = true) {
  const res = await fetch(`${BASE}/api/link/notes/${noteId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolved }),
  });
  if (!res.ok) throw new Error("Failed to update note");
  return res.json();
}

export async function getReadiness(shootDayId) {
  const res = await fetch(`${BASE}/api/schedule/readiness/${shootDayId}`);
  if (!res.ok) throw new Error("Failed to load readiness");
  return res.json();
}
export async function setPropReady(shootDayId, projectId, propName, ready) {
  const res = await fetch(`${BASE}/api/schedule/readiness/${shootDayId}/prop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, prop_name: propName, ready }),
  });
  if (!res.ok) throw new Error("Failed to update prop");
  return res.json();
}

export async function getShootDayStatus(shootDayId) {
  const res = await fetch(`${BASE}/api/schedule/shootday/${shootDayId}`);
  if (!res.ok) throw new Error("Failed to load shoot day status");
  return res.json();
}
export async function setArrival(shootDayId, projectId, personId, arrived) {
  const res = await fetch(`${BASE}/api/schedule/shootday/${shootDayId}/arrival`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, person_id: personId, arrived }),
  });
  if (!res.ok) throw new Error("Failed to update arrival");
  return res.json();
}
export async function setSceneComplete(shootDayId, projectId, sceneNumber, completed) {
  const res = await fetch(`${BASE}/api/schedule/shootday/${shootDayId}/scene`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, scene_number: sceneNumber, completed }),
  });
  if (!res.ok) throw new Error("Failed to update scene");
  return res.json();
}

export async function replyToNote(noteId, replyText) {
  const res = await fetch(`${BASE}/api/link/notes/${noteId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reply_text: replyText }),
  });
  if (!res.ok) throw new Error("Failed to send reply");
  return res.json();
}
export async function listMyNotes(personId) {
  const res = await fetch(`${BASE}/api/link/by-person/${personId}/notes`);
  if (!res.ok) throw new Error("Failed to load notes");
  return res.json();
}

export async function listUploads(projectId) {
  const res = await fetch(`${BASE}/api/breakdown/uploads/${projectId}`);
  if (!res.ok) throw new Error("Failed to load upload history");
  return res.json();
}
export async function getUpload(uploadId) {
  const res = await fetch(`${BASE}/api/breakdown/uploads/one/${uploadId}`);
  if (!res.ok) throw new Error("Failed to load upload");
  return res.json();
}
export async function reapplyUpload(uploadId) {
  const res = await fetch(`${BASE}/api/breakdown/uploads/${uploadId}/reapply`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reapply upload");
  return res.json();
}

export async function addScene(projectId, scene) {
  const res = await fetch(`${BASE}/api/breakdown/${projectId}/add-scene`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scene),
  });
  if (!res.ok) throw new Error("Failed to add scene");
  return res.json();
}

export async function getBreakdown(projectId) {
  const res = await fetch(`${BASE}/api/breakdown/${projectId}`);
  if (!res.ok) throw new Error("Failed to load breakdown");
  return res.json();
}
