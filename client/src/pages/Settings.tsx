import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card } from "@/components/ui";
import type { Dog } from "@shared/schema";

export default function Settings() {
  const { user, refetch } = useAuth();
  const { data: dogs } = useQuery({ queryKey: ["dogs"], queryFn: () => api<Dog[]>("/api/dogs") });
  const addDog = useMutation({
    mutationFn: (b: any) => api("/api/dogs", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dogs"] }),
  });
  async function logout() { await api("/api/auth/logout", { method: "POST" }); queryClient.clear(); refetch(); }

  return (
    <div className="flex flex-col gap-4">
      <Card><div className="text-sm text-slate-500">보호자</div><div className="font-semibold">{user?.name} ({user?.email})</div></Card>
      <Card>
        <h3 className="mb-2 font-semibold">🐕 우리 아이들</h3>
        <ul className="mb-2 text-sm">{dogs?.map((d) => <li key={d.id}>{d.name} · {d.breed ?? "견종 미입력"}</li>)}</ul>
        <DogForm onAdd={(b) => addDog.mutate(b)} />
      </Card>
      <Button className="bg-red-500" onClick={logout}>로그아웃</Button>
    </div>
  );
}

function DogForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("포메라니안");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("female");
  return (
    <div className="flex flex-col gap-2">
      <Input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="견종" value={breed} onChange={(e) => setBreed(e.target.value)} />
      <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
      <Select value={sex} onChange={(e) => setSex(e.target.value)}><option value="female">여아</option><option value="male">남아</option></Select>
      <Button onClick={() => { if (name) { onAdd({ name, breed, birthDate: birthDate || null, sex }); setName(""); } }}>강아지 추가</Button>
    </div>
  );
}
