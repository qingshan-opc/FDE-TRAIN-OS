import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/Toast";
import { AntdProvider } from "./ui/AntdProvider";
import "./styles/tailwind.css";
import "./styles/global.css";
import "./styles/ink-tokens.css";
import "./styles/ink-landing.css";
import "./styles/mk-home.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AntdProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </AntdProvider>
    </BrowserRouter>
  </StrictMode>,
);
