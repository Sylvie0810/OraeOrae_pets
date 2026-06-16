import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Button, Input, Select, Card, SectionTitle } from "@/components/ui";
import { PhotoUpload } from "@/components/PhotoUpload";
import type { Dog } from "@shared/schema";

function ageFromBirth(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const years = Math.floor((Date.now() - Date.parse(birthDate)) / (365.25 * 86400000));
  return `${years}살`;
}

export default function Settings() {
  const { user, refetch } = useAuth();
  const { data: dogs } = useQuery({ queryKey: ["dogs"], queryFn: () => api<Dog[]>("/api/dogs") });
  const addDog = useMutation({
    mutationFn: (b: any) => api("/api/dogs", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dogs"] }),
  });
  const delDog = useMutation({
    mutationFn: (id: number) => api(`/api/dogs/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dogs"] }),
  });
  const [adding, setAdding] = useState(false);

  async function logout() { await api("/api/auth/logout", { method: "POST" }); queryClient.clear(); refetch(); }

  return (
    <div className="flex flex-col gap-4 pb-2 pt-1">
      <Card>
        <div className="text-xs text-ink-soft">보호자</div>
        <div className="font-bold text-ink">{user?.name}</div>
        <div className="text-sm text-ink-soft">{user?.email}</div>
      </Card>

      <section>
        <SectionTitle action={<button onClick={() => setAdding((v) => !v)} className="text-sm font-semibold text-brand">{adding ? "닫기" : "+ 추가"}</button>}>
          우리 아이들
        </SectionTitle>

        <div className="flex flex-col gap-2">
          {dogs?.map((d) => (
            <Card key={d.id}>
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-brand-soft text-2xl">
                  {d.photoUrl ? <img src={d.photoUrl} alt={d.name} className="h-full w-full object-cover" /> : "🐕"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{d.name}</span>
                    {d.sex && <span className="rounded-full bg-cat-walk-bg px-2 py-0.5 text-[11px] font-semibold text-cat-walk">{d.sex === "male" ? "남아" : "여아"}</span>}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-ink-soft">
                    <div>{[ageFromBirth(d.birthDate), d.breed].filter(Boolean).join(" · ") || "정보 미입력"}</div>
                    {d.registrationNo && <div>등록번호: {d.registrationNo}</div>}
                    {d.birthDate && <div>생년월일: {d.birthDate}</div>}
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm(`${d.name} 프로필을 삭제할까요?`)) delDog.mutate(d.id); }}
                  className="tap text-lg text-cat-health"
                  aria-label="삭제"
                >🗑️</button>
              </div>
            </Card>
          ))}

          {adding && (
            <Card><DogForm onAdd={(b) => { addDog.mutate(b); setAdding(false); }} /></Card>
          )}
          {!dogs?.length && !adding && (
            <Card className="text-center text-sm text-ink-soft">아직 등록된 아이가 없어요. "+ 추가"를 눌러보세요.</Card>
          )}
        </div>
      </section>

      <Card>
        <SectionTitle>설정</SectionTitle>
        <div className="flex items-center justify-between border-b border-line py-2.5">
          <span className="text-sm text-ink">앱 정보</span>
          <span className="text-sm text-ink-soft">OraeOrae v1.0.0</span>
        </div>
        <div className="flex items-center justify-between border-b border-line py-2.5">
          <span className="text-sm text-ink">데이터 백업</span>
          <span className="rounded-full bg-cat-food-bg px-2.5 py-0.5 text-xs font-semibold text-cat-food">활성</span>
        </div>
      </Card>

      <Button variant="ghost" onClick={logout} className="text-cat-health">로그아웃</Button>
    </div>
  );
}

function DogForm({ onAdd }: { onAdd: (b: any) => void }) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("포메라니안");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("female");
  const [registrationNo, setRegistrationNo] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 flex justify-center">
        <PhotoUpload value={photoUrl} onChange={setPhotoUrl} />
      </div>
      <Input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="견종" value={breed} onChange={(e) => setBreed(e.target.value)} />
      <div className="flex gap-2">
        <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <Select value={sex} onChange={(e) => setSex(e.target.value)} className="w-28"><option value="female">여아</option><option value="male">남아</option></Select>
      </div>
      <Input placeholder="등록번호 (선택)" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} />
      <Button onClick={() => { if (name) onAdd({ name, breed, birthDate: birthDate || null, sex, registrationNo: registrationNo || null, photoUrl }); }} className="mt-1">강아지 추가</Button>
    </div>
  );
}
