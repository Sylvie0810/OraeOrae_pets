import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useDog } from "@/lib/auth";
import { InsightCardView } from "@/components/InsightCard";
import { QuickRecord } from "@/components/QuickRecord";
import { Card, SectionTitle } from "@/components/ui";
import type { AggregatedMetrics, InsightCard } from "@shared/types";
import type { Dog, WeightLog } from "@shared/schema";
import { todayKST } from "@shared/date";

const todayStr = todayKST; // Asia/Seoul "today" — never UTC

export default function Home() {
  const { dogId } = useDog();
  const { data: dogs } = useQuery({ queryKey: ["dogs"], queryFn: () => api<Dog[]>("/api/dogs") });
  const { data, isLoading } = useQuery({
    queryKey: ["insights", dogId],
    queryFn: () => api<{ metrics: AggregatedMetrics; cards: InsightCard[] }>(`/api/insights/${dogId}`),
    enabled: !!dogId,
  });

  // Manual refresh: force the server to regenerate the coach (?refresh=1) and
  // drop the cached result in. Data edits auto-refresh via the server-side
  // fingerprint; this button is for "regenerate anyway".
  const [refreshing, setRefreshing] = useState(false);
  async function refreshCoach() {
    if (!dogId || refreshing) return;
    setRefreshing(true);
    try {
      const fresh = await api<{ metrics: AggregatedMetrics; cards: InsightCard[] }>(`/api/insights/${dogId}?refresh=1`);
      queryClient.setQueryData(["insights", dogId], fresh);
    } catch { /* keep showing the existing cards on failure */ }
    finally { setRefreshing(false); }
  }

  if (!dogs?.length) {
    return (
      <Card className="mt-2 text-center">
        <div className="mb-1 text-2xl">🐶</div>
        <div className="font-bold text-ink">아직 등록된 아이가 없어요</div>
        <p className="mt-1 text-sm text-ink-soft">⚙️ 설정에서 레오·아미를 추가하면<br />오늘의 현황과 분석을 보여드릴게요.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-2">
      {/* 오늘의 현황 */}
      <section>
        <SectionTitle>오늘의 현황</SectionTitle>
        <div className="flex flex-col gap-2">
          {dogs.map((d) => <DogStatusRow key={d.id} dog={d} active={d.id === dogId} />)}
        </div>
      </section>

      {/* AI 인사이트 */}
      <section>
        <SectionTitle
          action={
            <button
              onClick={refreshCoach}
              disabled={refreshing || isLoading}
              className="tap flex items-center gap-1 text-xs font-semibold text-ink-soft disabled:opacity-50"
              aria-label="오늘의 코치 새로고침"
            >
              <span className={refreshing ? "inline-block animate-spin" : ""}>↻</span>
              {refreshing ? "갱신 중" : "새로고침"}
            </button>
          }
        >
          오늘의 코치
        </SectionTitle>
        {isLoading || refreshing ? (
          <Card className="text-sm text-ink-soft">분석 중…</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {data?.cards?.map((c, i) => <InsightCardView key={i} card={c} />)}
          </div>
        )}
      </section>

      {/* 빠른 기록 */}
      <section>
        <SectionTitle>빠른 기록</SectionTitle>
        <Card><QuickRecord /></Card>
      </section>
    </div>
  );
}

function DogStatusRow({ dog, active }: { dog: Dog; active: boolean }) {
  const { setDogId } = useDog();
  const { data: daily } = useQuery({
    queryKey: ["daily", dog.id, todayStr()],
    queryFn: () => api<{ walks: unknown[]; feedings: unknown[] }>(`/api/daily/${dog.id}/${todayStr()}`),
  });
  // Weight comes from the fast weights endpoint, independent of the slow coach
  // LLM call — so it shows immediately for every dog, even before one is selected.
  const { data: weights } = useQuery({
    queryKey: ["weights", dog.id],
    queryFn: () => api<WeightLog[]>(`/api/weights/${dog.id}`),
  });
  const latestWeightKg = weights?.length ? weights[weights.length - 1].weightKg : null;
  const walked = (daily?.walks?.length ?? 0) > 0;
  const fed = (daily?.feedings?.length ?? 0) > 0;

  return (
    // Tapping anywhere on the card switches to this dog (matches the habit of
    // clicking the photo box, not just the name pill in the header).
    <Card onClick={() => setDogId(dog.id)} className={active ? "ring-2 ring-brand/30" : "ring-1 ring-transparent hover:ring-brand/15"}>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-brand-soft text-xl">
          {dog.photoUrl ? <img src={dog.photoUrl} alt={dog.name} className="h-full w-full object-cover" /> : "🐕"}
        </div>
        <div className="flex-1">
          <div className="font-bold text-ink">{dog.name}</div>
          <div className="text-xs text-ink-soft">{dog.breed ?? "견종 미입력"}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-soft">몸무게</div>
          <div className="font-bold text-ink">{latestWeightKg != null ? `${latestWeightKg}kg` : "—"}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatusPill ok={walked} okText="산책 완료" noText="산책 미완료" icon="🐾" />
        <StatusPill ok={fed} okText="식사 완료" noText="식사 미완료" icon="🍚" />
      </div>
    </Card>
  );
}

function StatusPill({ ok, okText, noText, icon }: { ok: boolean; okText: string; noText: string; icon: string }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold ${ok ? "bg-cat-food-bg text-cat-food" : "bg-cat-health-bg text-cat-health"}`}>
      <span>{icon}</span>
      {ok ? okText : noText}
    </div>
  );
}
