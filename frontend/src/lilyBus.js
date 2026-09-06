// Tiny pub/sub so any tab's AI layer can hand a recommendation straight to
// Lily's chat panel — open it, pre-fill the input with the recommendation —
// without every tab needing to know how CommandCenter is mounted or reach
// into its state. Nothing here ever sends anything on its own; it only
// stages a message for the person to review and send themselves.
const listeners = new Set();

export function askLily(message) {
  listeners.forEach((fn) => fn(message));
}

export function onAskLily(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
