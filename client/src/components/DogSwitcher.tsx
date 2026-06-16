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
                className={`tap rounded-full px-4 py-1.5 text-sm font-semibold transition ${active ? "bg-brand text-white shadow-sm" : "bg-white text-ink-soft"}`}
              >
                {d.name}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
