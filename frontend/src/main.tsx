import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";

const legacyVerificationToken = new URLSearchParams(
  window.location.search
).get("verifyEmailToken");

if (legacyVerificationToken && !window.location.hash) {
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
