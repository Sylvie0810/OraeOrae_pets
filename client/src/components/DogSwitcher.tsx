import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { Logo } from "./Logo";
import type { Dog } from "@shared/schema";

export function DogSwitcher() {
  const { dogId, setDogId } = useDog();
  const { data: dogs } = useQuery({ queryKey: ["dogs"], queryFn: () => api<Dog[]>("/api/dogs") });
  useEffect(() => {
    if (dogs?.length && dogId === null) setDogId(dogs[0].id);
  }, [dogs, dogId, setDogId]);

  return (
    <header className="sticky top-0 z-10 bg-canvas/90 px-4 pb-2 pt-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={38} />
          <div className="leading-tight">
            <div className="font-display text-lg font-bold text-ink">OraeOrae</div>
            <div className="text-[11px] text-ink-soft">건강하게 오래오래</div>
          </div>
        </div>
        <Link href="/settings" className="tap grid h-9 w-9 place-items-center rounded-full bg-white text-lg shadow-sm">⚙️</Link>
      </div>

      {dogs && dogs.length > 0 && (
        <div className="mt-3 flex gap-2">
          {dogs.map((d) => {
            const active = d.id === dogId;
            return (
              <button
                key={d.id}
                onClick={() => setDogId(d.id)}
                className={`tap flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold transition ${active ? "bg-brand text-white shadow-sm" : "bg-white text-ink-soft"}`}
              >
                <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-brand-soft text-xs">
                  {d.photoUrl ? <img src={d.photoUrl} alt="" className="h-full w-full object-cover" /> : "🐕"}
                </span>
                {d.name}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
