import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const uiKitEnabled = String(import.meta.env.VITE_UI_V2_ENABLED ?? "false").toLowerCase() === "true";
if (uiKitEnabled) {
  document.body.dataset.uiTheme = "v2";
}

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((error) => {
        console.error("service-worker.registration_failed", error);
      });
  });
}
