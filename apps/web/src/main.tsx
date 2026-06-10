import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/typography.css";
import "./styles/theme.css";
import "./styles/brand-palette.css";
import "./styles/account-profile.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
