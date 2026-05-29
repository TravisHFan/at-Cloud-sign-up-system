import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { getDirectPathHashRouteReplacement } from "./utils/hashRouting";

const legacyVerificationToken = new URLSearchParams(
  window.location.search
).get("verifyEmailToken");
const directPathHashRoute = getDirectPathHashRouteReplacement(window.location);

if (directPathHashRoute) {
  window.history.replaceState(null, "", directPathHashRoute);
} else if (legacyVerificationToken && !window.location.hash) {
  window.history.replaceState(
    null,
    "",
    `/#/verify-email/${encodeURIComponent(legacyVerificationToken)}`
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
