import { useEffect, useState } from "react";
import { getInsights } from "./api";
import { askLily } from "./lilyBus";

// Drop-in AI summary/alerts/recommendations strip for a tab. Read-only: it
// makes one small, scoped Gemini call over just that tab's own data and
// renders what comes back. It never changes anything itself — every
// recommendation hands off to Lily's existing propose-then-confirm chat via
// the "Ask Lily to ___" link, which only pre-fills the chat input.
export default function AiLayer({ projectId, tab, dayId, refreshKey }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    getInsights(projectId, tab, dayId)
      .then((data) => { if (!cancelled) setState({ loading: false, error: "", data }); })
      .catch((e) => { if (!cancelled) setState({ loading: false, error: e.message, data: null }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, tab, dayId, refreshKey]);

  if (!projectId) return null;

  if (state.loading) {
    return (
      <div className="ai-layer">
        <div className="ai-tag"><span className="dot" /><span>Lily's read</span></div>
        <div className="ai-loading">Reading the {tab}…</div>
      </div>
    );
  }

  // Fail quiet: the real tab underneath is fully functional on its own, so a
  // slow or failed AI call should never block or clutter it.
  if (state.error) return null;

  const { summary, alerts = [], recommendations = [] } = state.data || {};
  if (!summary && alerts.length === 0 && recommendations.length === 0) return null;

  return (
    <div className="ai-layer">
      <div className="ai-tag"><span className="dot" /><span>Lily's read</span></div>

      {summary && (
        <div className="ai-row summary">
          <div className="ai-lbl">Summary</div>
          <div className="ai-txt">{summary}</div>
        </div>
      )}

      {alerts.map((a, i) => (
        <div key={`a${i}`} className={`ai-row alert ${a.severity || ""}`}>
          <div className="ai-lbl">Alert</div>
          <div className="ai-txt">{a.text}</div>
        </div>
      ))}

      {recommendations.map((r, i) => (
        <div key={`r${i}`} className="ai-row rec">
          <div className="ai-lbl">Recommend</div>
          <div className="ai-txt">
            {r.text}
            <br />
            <a
              className="ai-ask"
              href="#"
              onClick={(e) => { e.preventDefault(); askLily(r.text); }}
            >
              Ask Lily to {r.ask || "help with this"}
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
