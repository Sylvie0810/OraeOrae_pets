import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, DogProvider } from "./lib/auth";

// Fade out and remove the instant HTML splash once the app is ready to show content.
export function dismissSplash() {
  const el = document.getElementById("splash");
  if (!el) return;
  el.style.opacity = "0";
  setTimeout(() => el.remove(), 260);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DogProvider>
          <App />
        </DogProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
