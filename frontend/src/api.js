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
