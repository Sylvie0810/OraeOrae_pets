import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import type { Dog } from "@shared/schema";

export function DogSwitcher() {
  const { dogId, setDogId } = useDog();
  const { data: dogs } = useQuery({ queryKey: ["dogs"], queryFn: () => api<Dog[]>("/api/dogs") });
  useEffect(() => { if (dogs?.length && dogId === null) setDogId(dogs[0].id); }, [dogs, dogId, setDogId]);
  return (
    <header className="flex items-center justify-between p-4">
      <div className="flex gap-2">
        {dogs?.map((d) => (
          <button key={d.id} onClick={() => setDogId(d.id)} className={`rounded-full px-3 py-1 text-sm ${d.id === dogId ? "bg-slate-900 text-white" : "bg-slate-200"}`}>{d.name}</button>
        ))}
      </div>
      <Link href="/settings" className="text-xl">⚙️</Link>
    </header>
  );
}
