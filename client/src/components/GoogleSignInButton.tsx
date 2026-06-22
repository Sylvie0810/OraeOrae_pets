import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: any;
  }
}

// Renders a generic "Google로 로그인" button (no account/email shown for privacy).
// Google's own GIS button is rendered hidden underneath; our button forwards the
// click to it, so we still use the official Identity Services flow.
export function GoogleSignInButton({ onSuccess, onError }: { onSuccess: () => void; onError: () => void }) {
  const hiddenRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;

    async function handleCredential(response: { credential: string }) {
      try {
        await api("/api/auth/google", { method: "POST", body: JSON.stringify({ credential: response.credential }) });
        onSuccess();
      } catch {
        onError();
      }
    }

    function render() {
      if (!window.google || !hiddenRef.current) return;
      hiddenRef.current.replaceChildren();
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential });
      // Rendered hidden; we only need its click target. Generic look is our own button.
      window.google.accounts.id.renderButton(hiddenRef.current, { type: "standard", theme: "outline", size: "large", text: "signin_with" });
      setReady(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clickGoogle() {
    // forward to the hidden GIS button (its inner div / iframe is the click target)
    const target = hiddenRef.current?.querySelector('div[role="button"], iframe, div') as HTMLElement | null;
    target?.click();
  }

  if (!CLIENT_ID) {
    return (
      <div className="rounded-xl bg-canvas px-3 py-2 text-center text-xs text-ink-soft">구글 로그인 준비 중 (설정 필요)</div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={clickGoogle}
        disabled={!ready}
        className="tap flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm disabled:opacity-60"
      >
        <GoogleG />
        Google로 로그인
      </button>
      {/* hidden real GIS button — provides the actual click target */}
      <div ref={hiddenRef} className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden />
    </>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 36.9 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
