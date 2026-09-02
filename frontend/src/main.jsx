import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ShootLink from "./ShootLink.jsx";

const path = window.location.pathname;
const shootMatch = path.match(/^\/shoot\/([A-Za-z0-9]+)/);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {shootMatch ? <ShootLink token={shootMatch[1]} /> : <App />}
  </StrictMode>
);
