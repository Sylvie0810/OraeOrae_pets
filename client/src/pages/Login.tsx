import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Input, Card } from "@/components/ui";
import { BrandMark } from "@/components/Logo";

export default function Login() {
  const { refetch } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        <div className="text-center text-sm font-semibold text-ink">계정에 로그인하거나 새로 만드세요</div>

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
          <Input type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          {error && <div className="text-sm text-brand-dark">{error}</div>}
          <Button onClick={submit} className="mt-1 py-3">{mode === "login" ? "로그인" : "회원가입"}</Button>
        </div>
      </Card>

      <p className="text-center text-xs text-ink-soft">레오 · 아미와 함께하는 매일의 건강 기록 🐾</p>
    </div>
  );
}
