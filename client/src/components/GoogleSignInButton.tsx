import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: any;
  }
}

// Loads Google Identity Services once and renders Google's official sign-in button.
// On success, posts the returned ID token to our server which issues a session cookie.
export function GoogleSignInButton({ onSuccess, onError }: { onSuccess: () => void; onError: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return; // not configured — button hidden

    async function handleCredential(response: { credential: string }) {
      try {
        await api("/api/auth/google", { method: "POST", body: JSON.stringify({ credential: response.credential }) });
        onSuccess();
      } catch {
        onError();
      }
    }

    function render() {
      if (!window.google || !ref.current) return;
      // Google's button takes a fixed pixel width (no "100%"), capped at 400px.
      // Measure the container so it fills the card like the other inputs.
      const measured = Math.floor(ref.current.getBoundingClientRect().width);
      const width = Math.min(400, Math.max(200, measured || 320));
      ref.current.replaceChildren(); // clear any prior render before re-rendering
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential });
      window.google.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        width,
        text: "continue_with",
        shape: "pill",
        locale: "ko",
      });
    }

    if (window.google) {
      render();
    } else {
      const existing = document.getElementById("gsi-script");
      if (existing) {
        existing.addEventListener("load", render);
      } else {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.defer = true;
        s.id = "gsi-script";
        s.onload = render;
        document.head.appendChild(s);
      }
    }

    // Re-render the fixed-width Google button when the viewport size changes.
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(t); t = setTimeout(render, 150); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) {
    return (
      <div className="rounded-xl bg-canvas px-3 py-2 text-center text-xs text-ink-soft">
        구글 로그인 준비 중 (설정 필요)
      </div>
    );
  }
  return <div className="flex w-full justify-center [&>div]:!w-full [&_iframe]:!w-full" ref={ref} />;
}
