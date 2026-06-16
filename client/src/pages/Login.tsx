import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Input, Card } from "@/components/ui";

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
      setError("로그인에 실패했어요. 이메일/비밀번호를 확인하세요.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-center text-3xl font-bold">오래오래 🐾</h1>
      <Card className="flex flex-col gap-3">
        <Input placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-sm text-red-500">{error}</div>}
        <Button onClick={submit}>{mode === "login" ? "로그인" : "회원가입"}</Button>
        <button className="text-sm text-slate-500" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
      </Card>
    </div>
  );
}
