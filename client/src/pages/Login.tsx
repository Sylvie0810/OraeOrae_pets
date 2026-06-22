import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Input, Card } from "@/components/ui";
import { BrandMark } from "@/components/Logo";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function Login() {
  const { refetch } = useAuth();
  const [showEmail, setShowEmail] = useState(false); // email/pw hidden by default
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify({ email, password }) });
      refetch();
    } catch {
      setError(mode === "login" ? "로그인에 실패했어요. 이메일/비밀번호를 확인하세요." : "가입에 실패했어요. 다른 이메일을 시도해보세요.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-7 p-6">
      <BrandMark tagline />

      <Card className="flex flex-col gap-4">
        {/* Google sign-in — the only option shown by default */}
        <GoogleSignInButton onSuccess={refetch} onError={() => setError("구글 로그인에 실패했어요.")} />
        {error && <div className="text-center text-sm text-brand-dark">{error}</div>}

        {!showEmail ? (
          <button onClick={() => { setShowEmail(true); setError(""); }} className="text-center text-xs text-ink-soft underline">
            다른 방법으로 로그인
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3 text-xs text-ink-soft">
              <div className="h-px flex-1 bg-line" /> 또는 이메일로 <div className="h-px flex-1 bg-line" />
            </div>

            {/* segmented toggle */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  className={`tap rounded-lg py-2 text-sm font-semibold transition ${mode === m ? "bg-white text-brand shadow-sm" : "text-ink-soft"}`}
                >
                  {m === "login" ? "로그인" : "회원가입"}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <Input placeholder="이메일" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="비밀번호 (6자 이상)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="tap absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-lg"
                  aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
              <Button onClick={submit} className="mt-1 py-3">{mode === "login" ? "로그인" : "회원가입"}</Button>
            </div>
          </>
        )}
      </Card>

      <p className="text-center text-xs text-ink-soft">레오 · 아미와 함께하는 매일의 건강 기록 🐾</p>
    </div>
  );
}
